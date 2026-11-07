import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { EvalsEditorProvider, SkillEditorProvider } from '../src/extension.ts';
import { isRecord, parseEvals, type EditAction } from '../src/model.ts';
import { parseSkill, type SkillAction } from '../src/skill-model.ts';

export async function run(): Promise<void> {
  const directory = process.env['SKILL_EDITOR_TEST_DIR'];
  if (!directory) throw new Error('Missing isolated test directory.');
  const uri = vscode.Uri.file(join(directory, 'evals.json'));
  const original = '{"skill_name":"test","evals":[{"id":1,"prompt":"Original","expected_output":"Success","custom":42}]}\n';
  await writeFile(uri.fsPath, original);
  const extension = vscode.extensions.getExtension('gsf-reference-implementations.skill-editor');
  assert.ok(extension, 'Extension is discovered by VS Code');
  await extension.activate();
  assert.ok((await vscode.commands.getCommands()).includes('skillEditor.open'));
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.commands.executeCommand('vscode.openWith', uri, 'gsf.skillEditor.evals');
  await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  const provider = new EvalsEditorProvider(extension.extensionUri);
  const panels: vscode.WebviewPanel[] = [];

  function createPanel(editorProvider = provider, model = document): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel('skillEditor.test', 'Test eval editor',
      vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
    editorProvider.resolveCustomTextEditor(model, panel);
    panels.push(panel);
    return panel;
  }
  async function drive(panel: vscode.WebviewPanel, action: EditAction | SkillAction, version = document.version): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        subscription.dispose();
        reject(new Error('Timed out waiting for a real webview/provider edit result.'));
      }, 15000);
      const subscription = panel.webview.onDidReceiveMessage((message: unknown) => {
        if (isRecord(message) && isRecord(message['testResult'])) {
          clearTimeout(timeout);
          subscription.dispose();
          resolve(message['testResult']);
        }
      });
      const payload = JSON.stringify({ type: 'edit', requestId: 1, version, action }).replaceAll('<', '\\u003c');
      panel.webview.html = `<!doctype html><html><head>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-test';">
        </head><body><script nonce="test">
        const api = acquireVsCodeApi();
        window.addEventListener('message', event => {
          if (event.data.type === 'result') api.postMessage({ type: 'ready', testResult: event.data });
        });
        api.postMessage(${payload});
        </script></body></html>`;
    });
  }
  async function assertSkillUiBoots(panel: vscode.WebviewPanel): Promise<void> {
    const nonce = /<script nonce="([^"]+)"/.exec(panel.webview.html)?.[1];
    assert.ok(nonce);
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        subscription.dispose();
        reject(new Error('Actual guided rich UI did not boot in this VS Code version.'));
      }, 15000);
      const subscription = panel.webview.onDidReceiveMessage((message: unknown) => {
        if (isRecord(message) && message['testUiBoot'] === true) {
          clearTimeout(timeout);
          subscription.dispose();
          resolve();
        }
      });
      const driver = `<script nonce="${nonce}">
        const testApi = (() => {
          const original = window.acquireVsCodeApi;
          let api;
          window.acquireVsCodeApi = () => api ??= original();
          return () => api;
        })();
        const timer = setInterval(() => {
          if (document.querySelector('.tiptap')) {
            clearInterval(timer);
            testApi()?.postMessage({ type: 'ready', testUiBoot: true });
          }
        }, 50);
      </script>`;
      panel.webview.html = panel.webview.html.replace(/<script nonce=/, `${driver}<script nonce=`);
    });
  }
  try {
    const panel = createPanel();
    const response = await drive(panel, { type: 'updateCase', index: 0,
      fields: { prompt: 'Edited\n"quoted"', expectations: ['An assertion'] } });
    assert.equal(response['error'], undefined);
    assert.equal(parseEvals(document.getText()).evals[0]?.prompt, 'Edited\n"quoted"');
    assert.equal(parseEvals(document.getText()).evals[0]?.custom, 42);
    assert.equal(document.isDirty, true);
    assert.equal(await readFile(uri.fsPath, 'utf8'), original, 'Apply does not force-save');
    await vscode.window.showTextDocument(document, vscode.ViewColumn.Two);
    await vscode.commands.executeCommand('undo');
    assert.equal(document.getText(), original, 'One Apply is one native undo step');
    await vscode.commands.executeCommand('redo');
    assert.equal(parseEvals(document.getText()).evals[0]?.prompt, 'Edited\n"quoted"');
    await document.save();
    assert.equal(await readFile(uri.fsPath, 'utf8'), document.getText());
    console.log('PASS: real webview bridge, native Apply/Save/Undo/Redo and unknown-field preservation');

    const staleVersion = document.version;
    const edit = new vscode.WorkspaceEdit();
    edit.insert(uri, new vscode.Position(0, 0), ' ');
    assert.equal(await vscode.workspace.applyEdit(edit), true);
    const externalText = document.getText();
    const stale = await drive(panel, { type: 'deleteCase', index: 0 }, staleVersion);
    assert.match(String(stale['error']), /Document changed/);
    assert.equal(document.getText(), externalText);
    console.log('PASS: stale webview requests cannot overwrite external document edits');

    const second = createPanel();
    const sharedVersion = document.version;
    const outcomes = await Promise.all([
      drive(panel, { type: 'updateCase', index: 0, fields: { prompt: 'First concurrent view' } }, sharedVersion),
      drive(second, { type: 'updateCase', index: 0, fields: { prompt: 'Second concurrent view' } }, sharedVersion)
    ]);
    assert.equal(outcomes.filter(result => result['error'] === undefined).length, 1);
    assert.equal(outcomes.filter(result => String(result['error']).includes('Document changed')).length, 1);
    console.log('PASS: concurrent views serialize and reject the losing stale edit');

    const skillDirectory = join(directory, 'example');
    await mkdir(skillDirectory);
    const skillUri = vscode.Uri.file(join(skillDirectory, 'SKILL.md'));
    const skillOriginal = '---\n# Preserve YAML comment\nname: example\ndescription: Use for example tasks.\n---\n\n# Arbitrary instructions\n\nDo the work.\n';
    await writeFile(skillUri.fsPath, skillOriginal);
    const skillDocument = await vscode.workspace.openTextDocument(skillUri);
    await vscode.window.showTextDocument(skillDocument, vscode.ViewColumn.Two);
    await vscode.commands.executeCommand('skillEditor.openSkill');
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    const skillPanel = createPanel(new SkillEditorProvider(extension.extensionUri), skillDocument);
    await assertSkillUiBoots(skillPanel);
    const skillResult = await drive(skillPanel, { type: 'updateSkill', profile: 'claude-code',
      fields: { description: 'A multiline description.\nUse when testing.', 'disable-model-invocation': true } }, skillDocument.version);
    assert.equal(skillResult['error'], undefined);
    assert.equal(parseSkill(skillDocument.getText()).metadata['disable-model-invocation'], true);
    assert.equal(parseSkill(skillDocument.getText()).body, parseSkill(skillOriginal).body);
    assert.ok(skillDocument.getText().includes('# Preserve YAML comment'));
    assert.equal(await readFile(skillUri.fsPath, 'utf8'), skillOriginal);
    await vscode.window.showTextDocument(skillDocument, vscode.ViewColumn.Two);
    await vscode.commands.executeCommand('undo');
    assert.equal(skillDocument.getText(), skillOriginal);
    await vscode.commands.executeCommand('redo');
    await skillDocument.save();
    assert.equal(await readFile(skillUri.fsPath, 'utf8'), skillDocument.getText());
    const beforeInvalid = skillDocument.getText();
    const invalid = await drive(skillPanel, { type: 'updateSkill', profile: 'portable',
      fields: { name: 'Upper' } }, skillDocument.version);
    assert.ok(invalid['error']);
    assert.equal(skillDocument.getText(), beforeInvalid);
    console.log('PASS: guided SKILL editor registration, native YAML Apply/Save/Undo/Redo and host validation');
  } finally {
    for (const panel of panels) panel.dispose();
    await document.save();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  }
}
