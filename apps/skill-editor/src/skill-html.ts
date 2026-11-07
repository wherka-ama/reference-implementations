export function skillEditorHtml(source: string, script: string, style: string, nonce: string): string {
  const escape = (text: string) => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  return `<!doctype html><html lang="en"><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${escape(source)}; script-src 'nonce-${escape(nonce)}';">
  <link rel="stylesheet" href="${escape(style)}"><title>Skill authoring</title></head>
  <body class="skill-authoring">
  <header><div><h1>Skill authoring</h1><p class="hint">Tell the agent what to do, when to do it, and how to check the result.</p></div>
  <button id="skill-source" type="button">Open Markdown source</button></header>
  <p class="hint">Apply updates the document; VS Code Save writes to disk. Apply before closing this tab.</p>
  <p id="skill-notice" role="alert" hidden></p><p id="skill-status" role="status" aria-live="polite"></p>
  <main>
  <section class="target-panel" aria-labelledby="target-heading"><h2 id="target-heading">1. Choose the target</h2>
  <label for="target">Target harness</label><select id="target"></select>
  <p id="target-hint" class="hint"></p>
  <p class="hint">Rules are a researched snapshot, not runtime certification. This choice is not written to your skill.</p>
  <a id="target-docs" href="https://agentskills.io/specification">Official target documentation</a>
  <a id="standard-docs" href="https://agentskills.io/specification">Agent Skills standard</a>
  </section>
  <section aria-labelledby="metadata-heading"><h2 id="metadata-heading">2. Explain the skill</h2>
  <div id="skill-fields"></div>
  <details><summary>Optional portable fields</summary><div id="portable-options"></div></details>
  <details><summary>Harness options</summary><div id="harness-options"></div></details>
  <details><summary>Additional metadata</summary>
  <p class="hint">Optional author, version or other key-value data belongs under metadata, not at the top level. Portable values are text.</p>
  <div id="metadata-entries"></div><button id="metadata-add" type="button">Add metadata entry</button>
  </details>
  <details id="advanced"><summary>Advanced frontmatter (YAML)</summary>
  <p class="hint">For fields not exposed in the guided form. Unknown fields are retained. Edit either this YAML or the guided fields in one draft.</p>
  <label for="frontmatter-source">Frontmatter YAML</label><textarea id="frontmatter-source" rows="10"></textarea>
  </details>
  <p id="unknown-fields" class="hint"></p></section>
  <section aria-labelledby="body-heading"><h2 id="body-heading">3. Write the procedure</h2>
  <p class="hint">Use concrete steps, examples and checks. The standard does not require particular headings.</p>
  <div class="toolbar" aria-label="Instruction editing mode">
  <button id="visual-mode" type="button">Visual editing</button><button id="markdown-mode" type="button">Markdown editing</button>
  </div>
  <p id="rich-hint" class="hint"></p>
  <div id="rich-pane">
  <div id="format-toolbar" class="toolbar" role="group" aria-label="Text formatting">
  <button id="bold" type="button" aria-pressed="false">Bold</button><button id="italic" type="button" aria-pressed="false">Italic</button>
  <button id="heading" type="button" aria-pressed="false">Heading 2</button>
  <button id="bullet" type="button" aria-pressed="false">Bullet list</button><button id="ordered" type="button" aria-pressed="false">Numbered steps</button>
  <button id="code" type="button" aria-pressed="false">Code block</button><button id="link" type="button">Add link</button>
  </div>
  <div id="link-controls" hidden><label for="link-url">Link URL</label><input id="link-url" type="text">
  <button id="link-apply" type="button">Insert link</button></div>
  <div id="rich-editor"></div>
  </div>
  <div id="markdown-pane" hidden><label for="body-source">Markdown instructions</label><textarea id="body-source" rows="18"></textarea></div>
  <div class="section-helper">
  <label for="suggested-section">Suggested section</label><select id="suggested-section">
  <option value="instructions">Instructions</option><option value="examples">Examples</option>
  <option value="edge-cases">Edge cases</option><option value="verification">Verification</option>
  <option value="resources">Resources</option></select>
  <p id="section-hint" class="hint"></p><button id="section-add" type="button">Add suggested section</button>
  <a id="best-practices" href="https://agentskills.io/skill-creation/best-practices">Official authoring guidance</a>
  </div></section>
  <section aria-labelledby="validation-heading"><h2 id="validation-heading">4. Check your skill</h2>
  <p id="validation-summary" aria-live="polite"></p><ul id="validation"></ul>
  <p class="hint">Validation checks format and researched compatibility, not prompt quality, runtime permissions, referenced files or hook safety.</p>
  </section>
  <div class="apply-bar"><button id="skill-apply" type="button" disabled>Apply skill</button>
  <button id="skill-discard" type="button" disabled>Discard draft</button><span id="skill-draft-state">Loading...</span></div>
  </main><script nonce="${escape(nonce)}" src="${escape(script)}"></script></body></html>`;
}
