import * as vscode from 'vscode';
import { applyAction, parseEvals } from './model.ts';
import { editorHtml } from './html.ts';
import { TextEditorProvider } from './text-editor.ts';
import { applySkillAction, parseSkill } from './skill-model.ts';
import { skillEditorHtml } from './skill-html.ts';

const evalViewType = 'gsf.skillEditor.evals';
const skillViewType = 'gsf.skillEditor.skill';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(evalViewType, new EvalsEditorProvider(context.extensionUri), {
      supportsMultipleEditorsPerDocument: true
    }),
    vscode.window.registerCustomEditorProvider(skillViewType, new SkillEditorProvider(context.extensionUri), {
      supportsMultipleEditorsPerDocument: true
    }),
    vscode.commands.registerCommand('skillEditor.open', (uri?: vscode.Uri) => openEditor(uri, 'evals.json', evalViewType)),
    vscode.commands.registerCommand('skillEditor.openSkill', (uri?: vscode.Uri) => openEditor(uri, 'SKILL.md', skillViewType))
  );
}
async function openEditor(uri: vscode.Uri | undefined, filename: string, viewType: string): Promise<void> {
  const target = uri ?? vscode.window.activeTextEditor?.document.uri;
  if (!target || !target.path.endsWith(`/${filename}`)) {
    await vscode.window.showErrorMessage(`Select a ${filename} file to open its Skill Editor.`);
    return;
  }
  await vscode.commands.executeCommand('vscode.openWith', target, viewType);
}
export class EvalsEditorProvider extends TextEditorProvider {
  constructor(extensionUri: vscode.Uri) {
    super(extensionUri, { script: 'webview.js', html: editorHtml, parse: parseEvals, apply: applyAction });
  }
}
export class SkillEditorProvider extends TextEditorProvider {
  constructor(extensionUri: vscode.Uri) {
    super(extensionUri, { script: 'skill-webview.js', html: skillEditorHtml, parse: parseSkill, apply: applySkillAction });
  }
}
