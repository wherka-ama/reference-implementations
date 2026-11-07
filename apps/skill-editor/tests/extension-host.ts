import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import * as vscode from 'vscode';
import { EvalsEditorProvider } from '../src/extension.ts';
import { isRecord, parseEvals, type EditAction } from '../src/model.ts';

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

  function createPanel(): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel('skillEditor.test', 'Test eval editor',
      vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
    provider.resolveCustomTextEditor(document, panel);
    panels.push(panel);
    return panel;
  }
  async function drive(panel: vscode.WebviewPanel, action: EditAction, version = document.version): Promise<Record<string, unknown>> {
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
  } finally {
    for (const panel of panels) panel.dispose();
    await document.save();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  }
}
