import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { applyAction, parseEvals } from '../src/model.ts';
import { editorHtml } from '../src/html.ts';

let browser: Browser;
let origin: string;
const server = createServer((request, response) => {
  if (request.url === '/webview.js') {
    response.setHeader('Content-Type', 'application/javascript');
    response.end(readFileSync(new URL('../dist/webview.js', import.meta.url)));
  } else if (request.url === '/style.css') {
    response.setHeader('Content-Type', 'text/css');
    response.end(readFileSync(new URL('../media/style.css', import.meta.url)));
  } else {
    response.setHeader('Content-Type', 'text/html');
    response.end(editorHtml(origin, `${origin}/webview.js`, `${origin}/style.css`, 'test-nonce'));
  }
});
before(async () => {
  server.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test server address');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ channel: process.env['PLAYWRIGHT_CHANNEL'] || 'chrome' });
});
after(async () => {
  await browser?.close();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

async function openEditor(initial?: string) {
  let text = initial ?? readFileSync(new URL('./fixtures/evals.json', import.meta.url), 'utf8');
  let version = 1;
  const context = await browser.newContext();
  const page = await context.newPage();
  page.once('close', () => { void context.close(); });
  const messages: Record<string, unknown>[] = [];
  async function update() {
    let message: unknown;
    try { message = { type: 'document', version, data: parseEvals(text) }; }
    catch (error) { message = { type: 'document', version, error: String(error) }; }
    await page.evaluate(payload => globalThis.dispatchEvent(new MessageEvent('message', { data: payload })), message);
  }
  await page.exposeFunction('sendToHost', async (message: Record<string, unknown>) => {
    messages.push(message);
    if (message['type'] === 'ready') await update();
    if (message['type'] === 'edit') {
      let error: string | undefined;
      try {
        if (message['version'] !== version) throw new Error('Document changed. Discard the draft and reload before applying.');
        text = applyAction(text, message['action']);
        version++;
      } catch (caught) { error = String(caught); }
      await page.evaluate(payload => globalThis.dispatchEvent(new MessageEvent('message', { data: payload })),
        { type: 'result', requestId: message['requestId'], ...(error ? { error } : {}) });
      await update();
    }
  });
  await page.addInitScript(() => {
    Object.assign(globalThis, { acquireVsCodeApi: () => ({
      postMessage: (message: unknown) => {
        const host = globalThis as typeof globalThis & { sendToHost: (value: unknown) => Promise<void> };
        void host.sendToHost(message);
      },
      getState: () => JSON.parse(sessionStorage.getItem('editor-state') || 'null'),
      setState: (state: unknown) => sessionStorage.setItem('editor-state', JSON.stringify(state))
    }) });
  });
  await page.goto(origin);
  await page.getByRole('heading', { name: 'Skill evals', exact: true }).waitFor();
  return {
    page, messages, text: () => text,
    external: async (replacement: string) => { text = replacement; version++; await update(); }
  };
}

async function apply(page: Page) {
  await page.getByRole('button', { name: 'Apply case', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Applied to document' }).waitFor();
}

test('forty-case search, multiline edits and expectation CRUD survive JSON round-trip', async () => {
  const editor = await openEditor();
  const { page } = editor;
  try {
    await page.getByLabel('Search cases').fill('unbounded tool');
    assert.equal(await page.locator('#case-list button').count(), 1);
    await page.locator('#case-list button').click();
    await page.getByLabel('Prompt', { exact: true }).fill('A "quoted" prompt\nwith two lines');
    await page.getByRole('button', { name: 'Add expectation', exact: true }).click();
    await page.getByLabel('Expectation 7', { exact: true }).fill('New assertion\nsecond line');
    await apply(page);
    const item = parseEvals(editor.text()).evals[2]!;
    assert.equal(item.prompt, 'A "quoted" prompt\nwith two lines');
    assert.equal(item.expectations?.at(-1), 'New assertion\nsecond line');
    await page.getByRole('button', { name: 'Remove expectation 7', exact: true }).click();
    await apply(page);
    assert.equal(parseEvals(editor.text()).evals[2]?.expectations?.length, 6);
  } finally { await page.close(); }
});

test('drafts block navigation, show invalid IDs, and cannot overwrite external changes', async () => {
  const editor = await openEditor();
  const { page } = editor;
  try {
    await page.getByLabel('Prompt', { exact: true }).fill('My unsaved draft');
    await page.locator('#case-list button').nth(1).click();
    assert.equal(await page.getByLabel('Prompt', { exact: true }).inputValue(), 'My unsaved draft');
    await page.getByRole('alert').filter({ hasText: 'Apply or discard' }).waitFor();
    await page.getByLabel('Case ID', { exact: true }).fill('2');
    await page.getByRole('button', { name: 'Apply case', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'unique' }).waitFor();
    await page.getByLabel('Case ID', { exact: true }).fill('1');
    const changed = applyAction(editor.text(), { type: 'updateCase', index: 0, fields: { prompt: 'External edit' } });
    await editor.external(changed);
    await page.getByRole('alert').filter({ hasText: 'Document changed' }).waitFor();
    assert.equal(await page.getByLabel('Prompt', { exact: true }).inputValue(), 'My unsaved draft');
    assert.equal(await page.getByRole('button', { name: 'Apply case', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Discard draft', exact: true }).click();
    assert.equal(await page.getByLabel('Prompt', { exact: true }).inputValue(), 'External edit');
  } finally { await page.close(); }
});

test('adds, duplicates, moves and confirms deletion, including an empty suite', async () => {
  const editor = await openEditor('{"skill_name":"new-skill","evals":[]}');
  const { page } = editor;
  try {
    await page.getByRole('button', { name: 'Add case', exact: true }).click();
    await page.getByLabel('Prompt', { exact: true }).waitFor();
    assert.equal(parseEvals(editor.text()).evals.length, 1);
    await page.getByRole('button', { name: 'Duplicate case', exact: true }).click();
    await page.getByLabel('Case ID', { exact: true }).filter({ visible: true }).waitFor();
    await page.waitForFunction(() => (document.querySelector('#case-id') as HTMLInputElement)?.value === '2');
    await page.getByRole('button', { name: 'Move case up', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#case-list button')?.textContent?.includes('#2'));
    await page.getByRole('button', { name: 'Delete case', exact: true }).click();
    assert.equal(parseEvals(editor.text()).evals.length, 2);
    await page.getByRole('button', { name: 'Confirm deletion', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('#case-list button').length === 1);
    assert.deepEqual(parseEvals(editor.text()).evals.map(e => e.id), [1]);
  } finally { await page.close(); }
});

test('invalid JSON is recoverable and file contents cannot become HTML', async () => {
  const editor = await openEditor('{ invalid');
  const { page } = editor;
  try {
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByRole('button', { name: 'Add case', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Open JSON source', exact: true }).click();
    assert.ok(editor.messages.some(m => m['type'] === 'source'));
    await editor.external(JSON.stringify({ skill_name: '<img src=x onerror=alert(1)>',
      evals: [{ id: 1, name: '<script>bad()</script>', prompt: '</textarea><img src=x>',
        expected_output: 'Expected', expectations: ['<b>literal</b>'] }] }));
    await page.getByLabel('Prompt', { exact: true }).waitFor();
    assert.equal(await page.locator('img').count(), 0);
    assert.equal(await page.getByLabel('Prompt', { exact: true }).inputValue(), '</textarea><img src=x>');
  } finally { await page.close(); }
});

test('metadata and optional arrays are edited without introducing untouched empty fields', async () => {
  const editor = await openEditor('{"skill_name":"minimal","evals":[{"id":0,"prompt":"p","expected_output":"e"}]}');
  const { page } = editor;
  try {
    await page.getByText('Suite metadata', { exact: true }).click();
    await page.getByLabel('Description', { exact: true }).fill('Wrapped\nmetadata');
    await page.getByRole('button', { name: 'Apply metadata', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Applied to document' }).waitFor();
    assert.equal(parseEvals(editor.text()).description, 'Wrapped\nmetadata');
    await page.getByLabel('Prompt', { exact: true }).fill('Changed');
    await apply(page);
    assert.ok(!('files' in parseEvals(editor.text()).evals[0]!));
    await page.getByRole('button', { name: 'Add file', exact: true }).click();
    await page.getByLabel('File 1', { exact: true }).fill('files/sample.txt');
    await apply(page);
    assert.deepEqual(parseEvals(editor.text()).evals[0]?.files, ['files/sample.txt']);
  } finally { await page.close(); }
});

test('restores drafts across webview reloads and keeps case drafts valid after applying metadata', async () => {
  const editor = await openEditor();
  const { page } = editor;
  try {
    await page.locator('#case-list button').nth(2).click();
    await page.getByLabel('Prompt', { exact: true }).fill('Retained draft');
    await page.reload();
    await page.getByLabel('Prompt', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Prompt', { exact: true }).inputValue(), 'Retained draft');
    assert.equal(await page.getByLabel('Case ID', { exact: true }).inputValue(), '3');
    await page.getByText('Suite metadata', { exact: true }).click();
    await page.getByLabel('Description', { exact: true }).fill('New suite description');
    await page.getByRole('button', { name: 'Apply metadata', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Applied to document' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Apply case', exact: true }).isDisabled(), false);
    await apply(page);
    assert.equal(parseEvals(editor.text()).evals[2]?.prompt, 'Retained draft');
    assert.equal(parseEvals(editor.text()).description, 'New suite description');
    await page.getByLabel('Case ID', { exact: true }).fill('99');
    await apply(page);
    assert.equal(await page.getByLabel('Case ID', { exact: true }).inputValue(), '99');
  } finally { await page.close(); }
});

test('expectations reorder with keyboard focus and editor remains accessible at narrow widths', async () => {
  const editor = await openEditor();
  const { page } = editor;
  try {
    const original = parseEvals(editor.text()).evals[0]?.expectations!;
    await page.getByRole('button', { name: 'Move expectation 1 down', exact: true }).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.getByLabel('Expectation 2', { exact: true }).inputValue(), original[0]);
    assert.equal(await page.getByLabel('Expectation 2', { exact: true }).evaluate(el => el === document.activeElement), true);
    await apply(page);
    assert.equal(parseEvals(editor.text()).evals[0]?.expectations?.[1], original[0]);
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert.deepEqual(accessibility.violations.map(v => ({ id: v.id, description: v.description })), []);
  } finally { await page.close(); }
});
