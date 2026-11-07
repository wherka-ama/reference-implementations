import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { chromium, type Browser, type Page } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { parseSkill, applySkillAction } from '../src/skill-model.ts';
import { skillEditorHtml } from '../src/skill-html.ts';

let browser: Browser;
let origin: string;
const server = createServer((request, response) => {
  if (request.url === '/skill.js') {
    response.setHeader('Content-Type', 'application/javascript');
    response.end(readFileSync(new URL('../dist/skill-webview.js', import.meta.url)));
  } else if (request.url === '/style.css') {
    response.setHeader('Content-Type', 'text/css');
    response.end(readFileSync(new URL('../media/style.css', import.meta.url)));
  } else {
    response.setHeader('Content-Type', 'text/html');
    response.end(skillEditorHtml(origin, `${origin}/skill.js`, `${origin}/style.css`, 'test'));
  }
});
before(async () => {
  server.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test address');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ channel: process.env['PLAYWRIGHT_CHANNEL'] || 'chrome' });
});
after(async () => {
  await browser?.close();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

const original = '---\n# Keep comment\nname: example\ndescription: Write reports. Use when reporting.\nmetadata:\n  author: Author\n---\n\n# Instructions\n\nRead the source.\n';
async function openSkill(initial = original) {
  let text = initial;
  let version = 1;
  const context = await browser.newContext();
  const page = await context.newPage();
  page.once('close', () => { void context.close(); });
  const messages: Record<string, unknown>[] = [];
  const update = async () => {
    let message: unknown;
    try { message = { type: 'document', version, data: parseSkill(text), directoryName: 'example' }; }
    catch (error) { message = { type: 'document', version, error: String(error) }; }
    await page.evaluate(data => dispatchEvent(new MessageEvent('message', { data })), message);
  };
  await page.exposeFunction('sendToHost', async (message: Record<string, unknown>) => {
    messages.push(message);
    if (message['type'] === 'ready') await update();
    if (message['type'] === 'edit') {
      let error: string | undefined;
      try {
        if (message['version'] !== version) throw new Error('Document changed. Discard to reload.');
        text = applySkillAction(text, message['action'], 'example');
        version++;
      } catch (caught) { error = String(caught); }
      await page.evaluate(data => dispatchEvent(new MessageEvent('message', { data })),
        { type: 'result', requestId: message['requestId'], ...(error ? { error } : {}) });
      await update();
    }
  });
  await page.addInitScript(() => {
    Object.assign(globalThis, { acquireVsCodeApi: () => ({
      postMessage: (value: unknown) => {
        const host = globalThis as typeof globalThis & { sendToHost: (value: unknown) => Promise<void> };
        void host.sendToHost(value);
      },
      getState: () => JSON.parse(sessionStorage.getItem('skill-state') || 'null'),
      setState: (value: unknown) => sessionStorage.setItem('skill-state', JSON.stringify(value))
    }) });
  });
  await page.goto(origin);
  await page.getByRole('heading', { name: 'Skill authoring', exact: true }).waitFor();
  return { page, messages, text: () => text, external: async (value: string) => { text = value; version++; await update(); } };
}
async function apply(page: Page) {
  assert.equal(await page.getByRole('button', { name: 'Apply skill', exact: true }).isDisabled(), false,
    await page.locator('#validation').textContent() ?? 'Apply unexpectedly disabled');
  await page.getByRole('button', { name: 'Apply skill', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Applied to document' }).waitFor();
}

test('guided fields validate live, link to docs and preserve untouched Markdown', async () => {
  const editor = await openSkill();
  try {
    await editor.page.getByLabel('Skill name', { exact: true }).fill('Upper');
    await editor.page.locator('#validation').filter({ hasText: 'lowercase' }).waitFor();
    assert.equal(await editor.page.getByRole('button', { name: 'Apply skill', exact: true }).isDisabled(), true);
    await editor.page.getByLabel('Skill name', { exact: true }).fill('example');
    await editor.page.getByLabel('What the skill does and when to use it', { exact: true }).fill('Quotes "work".\nUse when writing.');
    await apply(editor.page);
    assert.equal(parseSkill(editor.text()).body, parseSkill(original).body);
    assert.ok(editor.text().includes('# Keep comment'));
    await editor.page.getByRole('link', { name: 'Official target documentation', exact: true }).click();
    assert.ok(editor.messages.some(m => m['type'] === 'documentation' && m['id'] === 'portable'));
  } finally { await editor.page.close(); }
});

test('rich text and optional guided sections work without requiring fixed headings', async () => {
  const editor = await openSkill();
  try {
    const rich = editor.page.getByRole('textbox', { name: 'Skill instructions', exact: true });
    await rich.fill('Plain sentence');
    await rich.press('ControlOrMeta+A');
    await editor.page.getByRole('button', { name: 'Heading 2', exact: true }).click();
    await apply(editor.page);
    assert.ok(parseSkill(editor.text()).body.includes('## Plain sentence'));
    await editor.page.getByLabel('Suggested section', { exact: true }).selectOption('examples');
    await editor.page.getByRole('button', { name: 'Add suggested section', exact: true }).click();
    await apply(editor.page);
    assert.ok(parseSkill(editor.text()).body.includes('## Examples'));
    assert.equal(parseSkill(editor.text()).metadata['name'], 'example');
  } finally { await editor.page.close(); }
});

test('harness-specific fields and metadata rows guide users without hand-written YAML', async () => {
  const editor = await openSkill();
  try {
    await editor.page.getByLabel('Target harness', { exact: true }).selectOption('claude-code');
    await editor.page.getByText('Harness options', { exact: true }).click();
    await editor.page.getByLabel('Disable automatic invocation', { exact: true }).selectOption('true');
    await editor.page.getByText('Additional metadata', { exact: true }).click();
    await editor.page.getByRole('button', { name: 'Add metadata entry', exact: true }).click();
    await editor.page.getByLabel('Metadata key 2', { exact: true }).fill('version');
    await editor.page.getByLabel('Metadata value 2', { exact: true }).fill('1.0');
    await apply(editor.page);
    const skill = parseSkill(editor.text());
    assert.equal(skill.metadata['disable-model-invocation'], true);
    assert.deepEqual(skill.metadata['metadata'], { author: 'Author', version: '1.0' });
    await editor.page.getByLabel('Target harness', { exact: true }).selectOption('portable');
    await editor.page.locator('#validation').filter({ hasText: 'not a portable' }).waitFor();
  } finally { await editor.page.close(); }
});

test('unknown syntax uses lossless Markdown mode; unsafe contents never become active HTML', async () => {
  const editor = await openSkill(original + '\n<!-- retain this -->\n<img src="https://example.com/x" onerror="alert(1)">\n');
  try {
    await editor.page.getByLabel('Markdown instructions', { exact: true }).waitFor();
    assert.equal(await editor.page.locator('img').count(), 0);
    assert.equal(await editor.page.getByRole('button', { name: 'Visual editing', exact: true }).isDisabled(), true);
    await editor.page.getByLabel('What the skill does and when to use it', { exact: true }).fill('Use when requested.');
    await apply(editor.page);
    assert.ok(parseSkill(editor.text()).body.includes('<!-- retain this -->'));
    assert.ok(parseSkill(editor.text()).body.includes('<img'));
  } finally { await editor.page.close(); }
});

test('malformed YAML recovers, new skills retain body, and conflicts retain drafts', async () => {
  const editor = await openSkill('---\nname: [broken\n---\n# Body');
  try {
    await editor.page.getByRole('alert').waitFor();
    await editor.page.getByRole('button', { name: 'Open Markdown source', exact: true }).click();
    assert.ok(editor.messages.some(m => m['type'] === 'source'));
    await editor.external('# Existing body\n');
    await editor.page.getByLabel('Skill name', { exact: true }).fill('example');
    await editor.page.getByLabel('What the skill does and when to use it', { exact: true }).fill('Use for existing tasks.');
    await apply(editor.page);
    assert.equal(parseSkill(editor.text()).body, '# Existing body\n');
    await editor.page.getByLabel('What the skill does and when to use it', { exact: true }).fill('Retain this draft');
    await editor.page.reload();
    await editor.page.getByLabel('What the skill does and when to use it', { exact: true }).waitFor();
    assert.equal(await editor.page.getByLabel('What the skill does and when to use it', { exact: true }).inputValue(), 'Retain this draft');
    await editor.external(original);
    await editor.page.getByRole('alert').filter({ hasText: 'Document changed' }).waitFor();
    assert.equal(await editor.page.getByRole('button', { name: 'Apply skill', exact: true }).isDisabled(), true);
    await editor.page.getByRole('button', { name: 'Discard draft', exact: true }).click();
    assert.equal(await editor.page.getByLabel('What the skill does and when to use it', { exact: true }).inputValue(), 'Write reports. Use when reporting.');
  } finally { await editor.page.close(); }
});

test('guided editor has labeled controls, keyboard actions and no narrow viewport overflow', async () => {
  const editor = await openSkill();
  try {
    await editor.page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await editor.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const result = await new AxeBuilder({ page: editor.page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert.deepEqual(result.violations.map(v => v.id), []);
  } finally { await editor.page.close(); }
});

test('advanced YAML and malformed field drafts stay visible across recreation and can be discarded', async () => {
  const editor = await openSkill();
  try {
    await editor.page.getByLabel('Target harness', { exact: true }).selectOption('claude-code');
    await editor.page.getByText('Harness options', { exact: true }).click();
    await editor.page.getByLabel('Session hooks (advanced YAML)', { exact: true }).fill('PreToolUse: [broken');
    assert.equal(await editor.page.getByRole('button', { name: 'Discard draft', exact: true }).isDisabled(), false);
    await editor.page.reload();
    await editor.page.getByText('Harness options', { exact: true }).click();
    assert.equal(await editor.page.getByLabel('Session hooks (advanced YAML)', { exact: true }).inputValue(), 'PreToolUse: [broken');
    assert.equal(await editor.page.getByRole('button', { name: 'Apply skill', exact: true }).isDisabled(), true);
    await editor.page.getByRole('button', { name: 'Discard draft', exact: true }).click();
    await editor.page.getByText('Advanced frontmatter (YAML)', { exact: true }).click();
    await editor.page.getByLabel('Frontmatter YAML', { exact: true }).fill('name: [broken');
    await editor.page.reload();
    await editor.page.getByText('Advanced frontmatter (YAML)', { exact: true }).click();
    assert.equal(await editor.page.getByLabel('Frontmatter YAML', { exact: true }).inputValue(), 'name: [broken');
    assert.equal(await editor.page.getByRole('button', { name: 'Apply skill', exact: true }).isDisabled(), true);
    await editor.page.getByRole('button', { name: 'Discard draft', exact: true }).click();
    assert.equal(editor.text(), original);
  } finally { await editor.page.close(); }
});
