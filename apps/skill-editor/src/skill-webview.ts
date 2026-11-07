import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { stringify } from 'yaml';
import { isRecord } from './model.ts';
import { markdownEquivalent, parseFieldYaml, parseFrontmatterYaml, richMarkdownIssue, validateSkill,
  type SkillAction, type SkillDocument } from './skill-model.ts';
import { claudeBoolean, getProfile, portableFields, profiles, specUrl, type SkillField } from './skill-profiles.ts';

interface State {
  profile: string;
  fields: Record<string, unknown>;
  remove: string[];
  body?: string;
  frontmatter?: string;
  entries?: { key: string; value: unknown }[];
  rawFields?: Record<string, string>;
  baseVersion: number;
  mode: 'visual' | 'markdown';
}
declare function acquireVsCodeApi(): {
  getState(): State | undefined;
  setState(state: State): void;
  postMessage(message: unknown): void;
};
const api = acquireVsCodeApi();
const state: State = api.getState() ?? { profile: 'portable', fields: {}, remove: [], baseVersion: 0, mode: 'visual' };
let current: SkillDocument | undefined;
let version = 0;
let directoryName = '';
let conflict = false;
let pending: number | undefined;
let requestId = 0;
let rendered = false;
let accepted = false;
let rich: Editor | undefined;
let richIssue: string | undefined;
let fieldErrors: Record<string, string> = {};
const get = (id: string) => {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing skill editor element: ${id}`);
  return node;
};
const button = (id: string) => {
  const node = get(id);
  if (!(node instanceof HTMLButtonElement)) throw new Error(`Missing button: ${id}`);
  return node;
};
const select = (id: string) => {
  const node = get(id);
  if (!(node instanceof HTMLSelectElement)) throw new Error(`Missing select: ${id}`);
  return node;
};
const textarea = (id: string) => {
  const node = get(id);
  if (!(node instanceof HTMLTextAreaElement)) throw new Error(`Missing textarea: ${id}`);
  return node;
};
const dirty = () => Object.keys(state.fields).length > 0 || state.remove.length > 0 ||
  state.body !== undefined || state.frontmatter !== undefined || Object.keys(state.rawFields ?? {}).length > 0;
function persist() { api.setState(state); }
function notice(message: string) { get('skill-notice').textContent = message; get('skill-notice').hidden = !message; }
function beginDraft() {
  if (!dirty()) state.baseVersion = version;
  get('skill-status').textContent = '';
}
function candidate(): SkillDocument {
  if (!current) throw new Error('Fix the YAML source before editing this skill.');
  const metadata = state.frontmatter !== undefined ? parseFrontmatterYaml(state.frontmatter)
    : { ...current.metadata, ...state.fields };
  if (state.frontmatter === undefined) for (const key of state.remove) delete metadata[key];
  return { ...current, metadata, body: state.body ?? current.body,
    hasFrontmatter: current.hasFrontmatter || Object.keys(state.fields).length > 0 || state.frontmatter !== undefined };
}
function guidedMetadata(): Record<string, unknown> {
  const values = state.frontmatter !== undefined ? { ...current?.metadata } : { ...current?.metadata, ...state.fields };
  if (state.frontmatter === undefined) for (const key of state.remove) delete values[key];
  return values;
}
function setField(key: string, value: unknown, remove = false) {
  beginDraft();
  if (remove) {
    delete state.fields[key];
    if (!state.remove.includes(key)) state.remove.push(key);
  } else {
    state.fields[key] = value;
    state.remove = state.remove.filter(item => item !== key);
  }
  persist();
  validate();
}
function validate() {
  const list = get('validation');
  list.replaceChildren();
  let errors = Object.values(fieldErrors);
  let warnings = 0;
  try {
    for (const issue of validateSkill(candidate(), state.profile, directoryName)) {
      if (issue.severity === 'error') errors.push(issue.message);
      else warnings++;
      const item = document.createElement('li');
      item.textContent = `${issue.severity === 'error' ? 'Fix' : 'Note'}: ${issue.message} `;
      item.className = issue.severity;
      const docs = document.createElement('a');
      docs.href = issue.docs;
      docs.textContent = 'Official guidance';
      docs.onclick = event => {
        event.preventDefault();
        api.postMessage({ type: 'documentation', id: issue.docs === specUrl ? 'standard'
          : issue.code === 'hook-scope' ? 'claude-hooks' : state.profile });
      };
      item.append(docs);
      list.append(item);
    }
  } catch (error) {
    errors.push(String(error));
  }
  for (const message of Object.values(fieldErrors)) {
    const item = document.createElement('li');
    item.className = 'error';
    item.textContent = `Fix: ${message}`;
    list.append(item);
  }
  get('validation-summary').textContent = !current ? 'Fix the source YAML to continue.'
    : `${errors.length} errors, ${warnings} notes.${errors.length ? ' Resolve errors before applying.' : ' Format checks passed for this target.'}`;
  if (errors.length && !list.childElementCount) {
    const item = document.createElement('li');
    item.textContent = errors[0]!;
    list.append(item);
  }
  button('skill-apply').disabled = !current || !dirty() || !!pending || conflict || errors.length > 0;
  button('skill-discard').disabled = !!pending || !dirty();
  const lock = !current || !!pending;
  for (const node of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    '#skill-fields input, #skill-fields textarea, #portable-options input, #portable-options textarea, #portable-options select,' +
    '#harness-options input, #harness-options textarea, #harness-options select, #metadata-entries input, #metadata-entries select'
  )) node.disabled = lock || state.frontmatter !== undefined;
  textarea('frontmatter-source').disabled = lock || Object.keys(state.fields).length > 0 || state.remove.length > 0;
  textarea('body-source').disabled = lock;
  select('target').disabled = !!pending;
  button('section-add').disabled = lock;
  button('link-apply').disabled = lock;
  button('metadata-add').disabled = lock || state.frontmatter !== undefined ||
    (current?.metadata['metadata'] !== undefined && !isRecord(current.metadata['metadata']));
  for (const control of document.querySelectorAll<HTMLButtonElement>('#format-toolbar button, #metadata-entries button')) {
    control.disabled = lock || (!rich && !!control.closest('#format-toolbar')) ||
      (state.frontmatter !== undefined && !!control.closest('#metadata-entries'));
  }
  rich?.setEditable(!lock, false);
  get('skill-draft-state').textContent = conflict ? 'Draft retained; discard to reload.'
    : pending ? 'Applying...' : dirty() ? 'Unapplied draft. Apply before Save or closing.' : 'No pending changes';
}
function createField(field: SkillField, parent: HTMLElement) {
  const wrapper = document.createElement('div');
  const id = `field-${field.key}`;
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = field.label;
  const hint = document.createElement('p');
  hint.id = `${id}-hint`;
  hint.className = 'hint';
  hint.textContent = field.hint;
  const existing = guidedMetadata()[field.key];
  let control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  if (field.kind === 'boolean' || field.kind === 'enum') {
    const choices = document.createElement('select');
    choices.add(new Option('Default (omit field)', ''));
    const options = field.kind === 'boolean' ? ['true', 'false'] : field.options ?? [];
    for (const option of options) choices.add(new Option(option, option));
    const interpreted = field.kind === 'boolean' && state.profile === 'claude-code' ? claudeBoolean(existing) : existing;
    const value = interpreted === undefined ? '' : String(interpreted);
    if (value && !options.includes(value)) choices.add(new Option(`Current invalid value: ${value}`, value));
    choices.value = value;
    choices.onchange = () => setField(field.key, field.kind === 'boolean' ? choices.value === 'true' : choices.value, !choices.value);
    control = choices;
  } else {
    const text = document.createElement(field.kind === 'text' ? 'input' : 'textarea');
    if (text instanceof HTMLTextAreaElement) text.rows = field.kind === 'yaml' ? 5 : field.key === 'description' ? 4 : 2;
    const array = Array.isArray(existing);
    text.value = field.kind === 'yaml' ? existing === undefined ? '' : stringify(existing)
      : array ? existing.join('\n') : existing === undefined ? '' : String(existing);
    if (state.rawFields?.[field.key] !== undefined) text.value = state.rawFields[field.key]!;
    text.oninput = () => {
      if (field.kind === 'yaml') {
        beginDraft();
        state.rawFields = { ...state.rawFields, [field.key]: text.value };
      }
      delete fieldErrors[field.key];
      try {
        const value = field.kind === 'yaml' ? parseFieldYaml(text.value)
          : field.kind === 'string-list' && array ? text.value.split(/\r?\n/) : text.value;
        setField(field.key, value, !text.value && !['name', 'description'].includes(field.key));
      } catch (error) {
        beginDraft();
        fieldErrors[field.key] = String(error);
        persist();
        validate();
      }
    };
    control = text;
  }
  control.id = id;
  control.setAttribute('aria-describedby', hint.id);
  wrapper.append(label, control, hint);
  parent.append(wrapper);
}
function renderFields() {
  for (const id of ['skill-fields', 'portable-options', 'harness-options']) get(id).replaceChildren();
  for (const field of portableFields) createField(field, get(['name', 'description'].includes(field.key) ? 'skill-fields' : 'portable-options'));
  for (const field of getProfile(state.profile).fields) createField(field, get('harness-options'));
  if (!get('harness-options').childElementCount) get('harness-options').textContent = 'No additional frontmatter fields verified for this target. See its official documentation.';
  const known = new Set([...portableFields.map(field => field.key), 'metadata', ...getProfile(state.profile).fields.map(field => field.key)]);
  const unknown = Object.keys(guidedMetadata()).filter(key => !known.has(key));
  get('unknown-fields').textContent = unknown.length ? `Preserved additional fields: ${unknown.join(', ')}. Use advanced YAML to edit them.` : '';
  textarea('frontmatter-source').value = state.frontmatter ?? current?.frontmatter ?? '';
  renderMetadata();
}
function entries() {
  if (state.entries) return state.entries;
  const metadata = guidedMetadata()['metadata'];
  return isRecord(metadata) ? Object.entries(metadata).map(([key, value]) => ({ key, value })) : [];
}
function syncEntries() {
  const rows = entries();
  const keys = rows.map(row => row.key);
  delete fieldErrors['metadata'];
  if (keys.some(key => !key.trim()) || new Set(keys).size !== keys.length) fieldErrors['metadata'] = 'Metadata keys must be non-empty and unique.';
  setField('metadata', Object.fromEntries(rows.map(row => [row.key, row.value])), rows.length === 0);
}
function renderMetadata() {
  const container = get('metadata-entries');
  container.replaceChildren();
  const rows = entries();
  rows.forEach((row, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'metadata-row';
    for (const part of ['key', 'value'] as const) {
      const label = document.createElement('label');
      label.htmlFor = `metadata-${part}-${index}`;
      label.textContent = `Metadata ${part} ${index + 1}`;
      const control = document.createElement('input');
      control.id = label.htmlFor;
      const value = row[part];
      control.value = typeof value === 'string' ? value : JSON.stringify(value);
      control.oninput = () => {
        state.entries = rows;
        row[part] = control.value;
        syncEntries();
      };
      wrapper.append(label, control);
    }
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = `Remove metadata entry ${index + 1}`;
    remove.onclick = () => { state.entries = rows.filter((_, at) => at !== index); syncEntries(); renderMetadata(); };
    wrapper.append(remove);
    container.append(wrapper);
  });
  if (state.profile === 'opencode') {
    const label = document.createElement('label');
    label.htmlFor = 'opencode-autoinvoke';
    label.textContent = 'OpenCode automatic invocation';
    const control = document.createElement('select');
    for (const [value, name] of [['', 'Default (enabled)'], ['true', 'Enabled'], ['false', 'Disabled']]) control.add(new Option(name, value));
    const metadata = guidedMetadata()['metadata'];
    control.value = isRecord(metadata) && typeof metadata['opencode/autoinvoke'] === 'boolean' ? String(metadata['opencode/autoinvoke']) : '';
    control.onchange = () => {
      const map = isRecord(metadata) ? { ...metadata } : {};
      if (control.value) map['opencode/autoinvoke'] = control.value === 'true';
      else delete map['opencode/autoinvoke'];
      delete state.entries;
      setField('metadata', map);
      renderMetadata();
    };
    control.id = label.htmlFor;
    container.append(label, control);
  }
}
function writeBody(value: string) {
  beginDraft();
  state.body = value;
  persist();
  validate();
}
function renderBody() {
  rich?.destroy();
  rich = undefined;
  get('rich-editor').replaceChildren();
  const body = state.body ?? current?.body ?? '';
  textarea('body-source').value = body;
  richIssue = richMarkdownIssue(body);
  if (!richIssue) {
    const editor = new Editor({
      element: get('rich-editor'), injectCSS: false,
      extensions: [StarterKit.configure({ link: { openOnClick: false, autolink: false } }), Markdown],
      content: body, contentType: 'markdown',
      editorProps: { attributes: { role: 'textbox', 'aria-label': 'Skill instructions', 'aria-multiline': 'true' } },
      onUpdate: ({ editor: active }) => writeBody(active.getMarkdown()),
      onSelectionUpdate: () => {
        if (!rich) return;
        for (const [id, format] of [['bold', 'bold'], ['italic', 'italic'], ['heading', 'heading'], ['bullet', 'bulletList'], ['ordered', 'orderedList'], ['code', 'codeBlock']]) {
          button(id!).setAttribute('aria-pressed', String(rich.isActive(format!)));
        }
      }
    });
    if (!markdownEquivalent(body, editor.getMarkdown())) {
      richIssue = 'This Markdown does not round-trip through the visual editor. Markdown mode preserves it without conversion.';
      editor.destroy();
      get('rich-editor').replaceChildren();
    } else rich = editor;
  }
  if (richIssue) state.mode = 'markdown';
  showMode();
}
function showMode() {
  const visual = state.mode === 'visual' && !!rich;
  get('rich-pane').hidden = !visual;
  get('markdown-pane').hidden = visual;
  button('visual-mode').disabled = !rich || !!pending || !current;
  button('visual-mode').setAttribute('aria-pressed', String(visual));
  button('markdown-mode').setAttribute('aria-pressed', String(!visual));
  get('rich-hint').textContent = richIssue ?? 'Visual editing normalizes Markdown formatting only when you edit the body. Untouched Markdown stays byte-for-byte unchanged.';
  persist();
}
const sections = {
  instructions: { title: 'Instructions', hint: 'Concrete ordered steps. State inputs, constraints and what to do when a step fails.', content: '1. Describe the first action.\n2. Check the result before continuing.' },
  examples: { title: 'Examples', hint: 'Give a realistic input and successful output. Examples are recommended, not required.', content: '**Input:** Describe a realistic request.\n\n**Expected result:** Describe the observable outcome.' },
  'edge-cases': { title: 'Edge cases', hint: 'Explain exceptions, missing inputs and safe failure handling.', content: '- If required information is missing, ask for it before proceeding.' },
  verification: { title: 'Verification', hint: 'Describe observable checks before claiming success. A checklist is optional guidance.', content: '- Check the result against the acceptance criteria.\n- Report any unresolved uncertainty.' },
  resources: { title: 'Resources', hint: 'Link bundled files using paths relative to the skill root. Explain when to read each resource.', content: 'See [reference guidance](references/REFERENCE.md) when more detail is needed.' }
} as const;
function sectionHint() {
  const key = select('suggested-section').value;
  if (key in sections) get('section-hint').textContent = sections[key as keyof typeof sections].hint;
}
function clearDraft() {
  state.fields = {}; state.remove = [];
  delete state.body; delete state.frontmatter; delete state.entries; delete state.rawFields;
  fieldErrors = {}; conflict = false; state.baseVersion = version;
}
for (const profile of profiles) select('target').add(new Option(profile.label, profile.id));
select('target').value = state.profile;
function profileChanged() {
  getProfile(select('target').value);
  state.profile = select('target').value;
  get('target-hint').textContent = getProfile(state.profile).hint;
  get('target-docs').setAttribute('href', getProfile(state.profile).docs);
  if (current) { renderFields(); validate(); }
  persist();
}
select('target').onchange = profileChanged;
for (const [id, docsId] of [['target-docs', 'target'], ['standard-docs', 'standard'], ['best-practices', 'best-practices']]) {
  get(id!).onclick = event => { event.preventDefault(); api.postMessage({ type: 'documentation', id: docsId === 'target' ? state.profile : docsId }); };
}
button('skill-source').onclick = () => {
  if (dirty()) notice('Apply or discard the draft before opening Markdown source.');
  else api.postMessage({ type: 'source' });
};
button('metadata-add').onclick = () => {
  state.entries = [...entries(), { key: '', value: '' }];
  syncEntries();
  renderMetadata();
};
textarea('frontmatter-source').oninput = () => {
  beginDraft();
  state.frontmatter = textarea('frontmatter-source').value;
  persist();
  validate();
};
textarea('body-source').oninput = () => writeBody(textarea('body-source').value);
button('markdown-mode').onclick = () => {
  state.mode = 'markdown'; textarea('body-source').value = state.body ?? current?.body ?? ''; showMode();
};
button('visual-mode').onclick = () => {
  state.mode = 'visual'; renderBody(); validate();
};
const formats = {
  bold: () => rich?.chain().focus().toggleBold().run(),
  italic: () => rich?.chain().focus().toggleItalic().run(),
  heading: () => rich?.chain().focus().toggleHeading({ level: 2 }).run(),
  bullet: () => rich?.chain().focus().toggleBulletList().run(),
  ordered: () => rich?.chain().focus().toggleOrderedList().run(),
  code: () => rich?.chain().focus().toggleCodeBlock().run()
};
for (const [id, action] of Object.entries(formats)) button(id).onclick = action;
button('link').onclick = () => { get('link-controls').hidden = false; get('link-url').focus(); };
button('link-apply').onclick = () => {
  const input = get('link-url');
  if (!(input instanceof HTMLInputElement)) return;
  const url = input.value.trim();
  if (!url || /^(?:javascript|data|vbscript):/i.test(url) || (url.includes(':') && !/^(?:https?|mailto):/i.test(url)) || url.startsWith('//')) {
    notice('Use an http(s), mailto or relative resource link. Executable URLs are not allowed.');
    return;
  }
  rich?.chain().focus().setLink({ href: url }).run();
  get('link-controls').hidden = true;
};
select('suggested-section').onchange = sectionHint;
button('section-add').onclick = () => {
  const key = select('suggested-section').value;
  if (!(key in sections)) return;
  const section = sections[key as keyof typeof sections];
  writeBody(`${(state.body ?? current?.body ?? '').replace(/\s*$/, '')}\n\n## ${section.title}\n\n${section.content}\n`);
  renderBody();
};
button('skill-discard').onclick = () => {
  clearDraft(); persist(); notice('');
  if (current) { renderFields(); renderBody(); }
  validate();
};
button('skill-apply').onclick = () => {
  if (button('skill-apply').disabled) return;
  const action: SkillAction = { type: 'updateSkill', profile: state.profile,
    ...(state.frontmatter !== undefined ? { frontmatter: state.frontmatter } : { fields: state.fields, remove: state.remove }),
    ...(state.body !== undefined ? { body: state.body } : {}) };
  pending = ++requestId;
  notice('');
  validate();
  api.postMessage({ type: 'edit', requestId, version: state.baseVersion, action });
};
globalThis.addEventListener('message', event => {
  const message: unknown = event.data;
  if (!isRecord(message)) return;
  if (message['type'] === 'result' && message['requestId'] === pending) {
    pending = undefined;
    if (typeof message['error'] === 'string') notice(message['error']);
    else { clearDraft(); accepted = true; get('skill-status').textContent = 'Applied to document. Use VS Code Save to write to disk.'; persist(); }
    validate();
  } else if (message['type'] === 'document' && typeof message['version'] === 'number') {
    version = message['version'];
    if (typeof message['error'] === 'string') {
      current = undefined;
      notice(message['error']);
      validate();
      return;
    }
    // Provider messages carry a parsed, bounded YAML document.
    current = message['data'] as SkillDocument;
    if (typeof message['directoryName'] === 'string') directoryName = message['directoryName'];
    if (pending) return;
    if (accepted) { state.baseVersion = version; accepted = false; }
    if (dirty() && version !== state.baseVersion) {
      conflict = true;
      notice('Document changed outside this draft. Draft text is retained; discard it to reload.');
      if (rendered) { validate(); return; }
    } else notice('');
    if (!dirty() || !rendered) {
      profileChanged();
      renderBody();
      rendered = true;
    }
    validate();
    persist();
  } else if (message['type'] === 'error' && typeof message['error'] === 'string') notice(message['error']);
});
sectionHint();
for (const [key, value] of Object.entries(state.rawFields ?? {})) {
  try { parseFieldYaml(value); } catch (error) { fieldErrors[key] = String(error); }
}
profileChanged();
validate();
api.postMessage({ type: 'ready' });
