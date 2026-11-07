import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import { isRecord } from './model.ts';
import { bestPracticesUrl, getProfile, specUrl } from './skill-profiles.ts';

interface EditorDefinition {
  script: string;
  html: (source: string, script: string, style: string, nonce: string) => string;
  parse: (text: string) => unknown;
  apply: (text: string, action: unknown, directoryName: string) => string;
}
export class TextEditorProvider implements vscode.CustomTextEditorProvider {
  private readonly extensionUri: vscode.Uri;
  private readonly definition: EditorDefinition;
  constructor(extensionUri: vscode.Uri, definition: EditorDefinition) {
    this.extensionUri = extensionUri;
    this.definition = definition;
  }
  resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): void {
    const webview = panel.webview;
    const directoryName = document.uri.path.split('/').at(-2) ?? '';
    webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'dist'), vscode.Uri.joinPath(this.extensionUri, 'media')]
    };
    webview.html = this.definition.html(webview.cspSource,
      webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', this.definition.script)).toString(),
      webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'style.css')).toString(),
      randomBytes(24).toString('hex'));
    let disposed = false;
    const publish = () => {
      if (disposed) return;
      try {
        void webview.postMessage({ type: 'document', version: document.version, directoryName,
          data: this.definition.parse(document.getText()) });
      } catch (error) {
        void webview.postMessage({ type: 'document', version: document.version, error: errorMessage(error) });
      }
    };
    const receive = webview.onDidReceiveMessage((message: unknown) => {
      if (!isRecord(message)) {
        void webview.postMessage({ type: 'error', error: 'Invalid editor message.' });
        return;
      }
      if (message['type'] === 'ready') publish();
      else if (message['type'] === 'source') {
        void vscode.commands.executeCommand('vscode.openWith', document.uri, 'default').then(undefined, error => {
          void vscode.window.showErrorMessage(`Cannot open source: ${errorMessage(error)}`);
        });
      } else if (message['type'] === 'documentation') {
        void openDocumentation(message['id']).catch(error => {
          void webview.postMessage({ type: 'error', error: errorMessage(error) });
        });
      } else if (message['type'] === 'edit') {
        // Serialize all views of a document before checking their version.
        enqueue(document, async () => {
          try {
            if (message['version'] !== document.version) throw new Error('Document changed. Discard the draft and reload before applying.');
            const before = document.getText();
            const after = this.definition.apply(before, message['action'], directoryName);
            if (before !== after) {
              const edit = new vscode.WorkspaceEdit();
              let start = 0;
              while (start < before.length && start < after.length && before[start] === after[start]) start++;
              let oldEnd = before.length;
              let newEnd = after.length;
              while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) { oldEnd--; newEnd--; }
              edit.replace(document.uri, new vscode.Range(document.positionAt(start), document.positionAt(oldEnd)), after.slice(start, newEnd));
              if (!await vscode.workspace.applyEdit(edit)) throw new Error('VS Code could not apply the edit. The document was not updated.');
            }
            if (!disposed) await webview.postMessage({ type: 'result', requestId: message['requestId'] });
          } catch (error) {
            if (!disposed) await webview.postMessage({ type: 'result', requestId: message['requestId'], error: errorMessage(error) });
          }
          publish();
        });
      } else void webview.postMessage({ type: 'error', error: 'Unsupported editor message.' });
    });
    const changes = vscode.workspace.onDidChangeTextDocument(event => { if (event.document === document) publish(); });
    const visibility = panel.onDidChangeViewState(event => { if (event.webviewPanel.visible) publish(); });
    panel.onDidDispose(() => { disposed = true; receive.dispose(); changes.dispose(); visibility.dispose(); });
  }
}
const queues = new WeakMap<vscode.TextDocument, Promise<void>>();
function enqueue(document: vscode.TextDocument, operation: () => Promise<void>): void {
  const next = (queues.get(document) ?? Promise.resolve()).then(operation).catch(error => {
    void vscode.window.showErrorMessage(`Skill Editor: ${errorMessage(error)}`);
  });
  queues.set(document, next);
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
async function openDocumentation(id: unknown): Promise<void> {
  if (typeof id !== 'string') throw new Error('Invalid documentation reference.');
  const url = id === 'standard' ? specUrl : id === 'best-practices' ? bestPracticesUrl
    : id === 'claude-hooks' ? 'https://code.claude.com/docs/en/hooks#hooks-in-skills-and-agents' : getProfile(id).docs;
  if (!await vscode.env.openExternal(vscode.Uri.parse(url))) throw new Error('VS Code could not open the official documentation.');
}
