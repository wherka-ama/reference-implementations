import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import { applyAction, isRecord, parseEvals } from './model.ts';
import { editorHtml } from './html.ts';

const viewType = 'gsf.skillEditor.evals';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(viewType, new EvalsEditorProvider(context.extensionUri), {
      supportsMultipleEditorsPerDocument: true
    }),
    vscode.commands.registerCommand('skillEditor.open', async (uri?: vscode.Uri) => {
      const target = uri ?? vscode.window.activeTextEditor?.document.uri;
      if (!target || !target.path.endsWith('/evals.json')) {
        await vscode.window.showErrorMessage('Select an evals.json file to open the Skill Evals Editor.');
        return;
      }
      await vscode.commands.executeCommand('vscode.openWith', target, viewType);
    })
  );
}

export class EvalsEditorProvider implements vscode.CustomTextEditorProvider {
  private readonly extensionUri: vscode.Uri;

  constructor(extensionUri: vscode.Uri) {
    this.extensionUri = extensionUri;
  }

  resolveCustomTextEditor(document: vscode.TextDocument, panel: vscode.WebviewPanel): void {
    const webview = panel.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
        vscode.Uri.joinPath(this.extensionUri, 'media')
      ]
    };
    webview.html = editorHtml(
      webview.cspSource,
      webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js')).toString(),
      webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', 'style.css')).toString(),
      randomBytes(24).toString('hex')
    );
    let disposed = false;
    function publish() {
      if (disposed) return;
      try {
        void webview.postMessage({ type: 'document', version: document.version, data: parseEvals(document.getText()) });
      } catch (error) {
        void webview.postMessage({ type: 'document', version: document.version, error: errorMessage(error) });
      }
    }
    // Serializing requests prevents two views from passing the version check simultaneously.
    const receive = webview.onDidReceiveMessage((message: unknown) => {
      if (!isRecord(message)) return;
      if (message['type'] === 'ready') publish();
      else if (message['type'] === 'source') {
        void vscode.commands.executeCommand('vscode.openWith', document.uri, 'default').then(undefined, error => {
          void vscode.window.showErrorMessage(`Cannot open JSON source: ${errorMessage(error)}`);
        });
      } else if (message['type'] === 'edit') {
        enqueue(document, async () => {
          try {
            if (message['version'] !== document.version) {
              throw new Error('Document changed. Discard the draft and reload before applying.');
            }
            const before = document.getText();
            const after = applyAction(before, message['action']);
            if (before !== after) {
              const edit = new vscode.WorkspaceEdit();
              // A minimal contiguous replacement leaves unrelated text out of the native edit.
              let start = 0;
              while (start < before.length && start < after.length && before[start] === after[start]) start++;
              let oldEnd = before.length;
              let newEnd = after.length;
              while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) {
                oldEnd--; newEnd--;
              }
              edit.replace(document.uri, new vscode.Range(document.positionAt(start), document.positionAt(oldEnd)),
                after.slice(start, newEnd));
              if (!await vscode.workspace.applyEdit(edit)) throw new Error('VS Code could not apply the edit. The document was not updated.');
            }
            if (!disposed) await webview.postMessage({ type: 'result', requestId: message['requestId'] });
          } catch (error) {
            if (!disposed) await webview.postMessage({
              type: 'result', requestId: message['requestId'], error: errorMessage(error)
            });
          }
          publish();
        });
      } else {
        void webview.postMessage({ type: 'error', error: 'Unsupported editor message.' });
      }
    });
    const changes = vscode.workspace.onDidChangeTextDocument(event => {
      if (event.document === document) publish();
    });
    const visibility = panel.onDidChangeViewState(event => {
      if (event.webviewPanel.visible) publish();
    });
    panel.onDidDispose(() => {
      disposed = true;
      receive.dispose();
      changes.dispose();
      visibility.dispose();
    });
  }
}

const queues = new WeakMap<vscode.TextDocument, Promise<void>>();

function enqueue(document: vscode.TextDocument, operation: () => Promise<void>): void {
  const previous = queues.get(document) ?? Promise.resolve();
  const next = previous.then(operation).catch(error => {
    void vscode.window.showErrorMessage(`Skill Editor: ${errorMessage(error)}`);
  });
  queues.set(document, next);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
