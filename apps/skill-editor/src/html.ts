function attribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function editorHtml(source: string, script: string, style: string, nonce: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${attribute(source)}; script-src 'nonce-${attribute(nonce)}';">
  <link rel="stylesheet" href="${attribute(style)}">
  <title>Skill evals</title>
</head>
<body>
  <header><div><h1>Skill evals</h1><p id="suite-title"></p></div>
    <button id="source" type="button">Open JSON source</button></header>
  <p class="hint">Edit readable fields, then Apply to update the document. Use VS Code Save to write to disk.</p>
  <p id="notice" role="alert" hidden></p>
  <p id="status" role="status" aria-live="polite"></p>
  <details id="metadata"><summary>Suite metadata</summary>
    <div id="metadata-fields" class="metadata-grid"></div>
    <button id="apply-metadata" type="button" disabled>Apply metadata</button>
  </details>
  <div class="layout">
    <nav aria-label="Evaluation cases">
      <label for="search">Search cases</label>
      <input type="search" id="search" placeholder="ID, name, prompt or expectations">
      <p id="case-count" class="hint" aria-live="polite"></p>
      <button id="add-case" type="button" disabled>Add case</button>
      <div id="case-list"></div>
    </nav>
    <main id="detail">
      <p id="empty">Loading evaluations...</p>
      <section id="case-editor" hidden aria-label="Case editor">
        <div class="toolbar">
          <h2 id="case-heading"></h2>
          <button id="duplicate" type="button">Duplicate case</button>
          <button id="move-up" type="button">Move case up</button>
          <button id="move-down" type="button">Move case down</button>
          <button id="delete" type="button">Delete case</button>
        </div>
        <div id="delete-confirm" hidden>
          <p>Delete this case? You can undo the document edit in VS Code.</p>
          <button id="confirm-delete" type="button">Confirm deletion</button>
          <button id="cancel-delete" type="button">Cancel</button>
        </div>
        <div class="identity">
          <div><label for="case-id">Case ID</label><input id="case-id" type="number" step="1" required></div>
          <div><label for="case-name">Case name (optional)</label><input id="case-name" type="text"></div>
        </div>
        <label for="prompt">Prompt</label>
        <textarea id="prompt" rows="8" required aria-describedby="prompt-hint"></textarea>
        <p id="prompt-hint" class="hint">The task to execute. Newlines, quotes and [auto] markers are preserved literally.</p>
        <label for="expected-output">Expected output</label>
        <textarea id="expected-output" rows="5" required></textarea>
        <h3>Expectations</h3>
        <p class="hint">Use one observable assertion per item. Items can contain multiple lines.</p>
        <div id="expectations"></div>
        <button id="add-expectation" type="button">Add expectation</button>
        <h3>Input files</h3>
        <p class="hint">Literal paths as interpreted by your eval runner. Files are not opened or executed.</p>
        <div id="files"></div>
        <button id="add-file" type="button">Add file</button>
        <div class="apply-bar">
          <button id="apply-case" type="button" disabled>Apply case</button>
          <button id="discard" type="button" disabled>Discard draft</button>
          <span id="draft-state">No pending changes</span>
        </div>
      </section>
    </main>
  </div>
  <script nonce="${attribute(nonce)}" src="${attribute(script)}"></script>
</body>
</html>`;
}
