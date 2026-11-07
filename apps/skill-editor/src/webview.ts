import { isRecord, type EditAction, type EvalCase, type EvalSuite } from './model.ts';

interface UiState {
  selectedId?: number;
  search: string;
  caseDraft: Partial<EvalCase>;
  metadataDraft: Record<string, string>;
  baseVersion: number;
}
declare function acquireVsCodeApi(): {
  postMessage(message: unknown): void;
  getState(): UiState | undefined;
  setState(state: UiState): void;
};
const api = acquireVsCodeApi();
const state: UiState = api.getState() ?? {
  search: '', caseDraft: {}, metadataDraft: {}, baseVersion: 0
};
let suite: EvalSuite | undefined;
let version = 0;
let conflict = false;
let pending: { requestId: number; action: EditAction } | undefined;
let selectionAction: EditAction | undefined;
let requestId = 0;
let invalid = true;
let rendered = false;
let acceptedUpdate = false;

function element<T extends HTMLElement>(id: string, constructor: { new(): T }): T {
  const node = document.getElementById(id);
  if (!(node instanceof constructor)) throw new Error(`Missing editor element: ${id}`);
  return node;
}
const button = (id: string) => element(id, HTMLButtonElement);
const input = (id: string) => element(id, HTMLInputElement);
const textarea = (id: string) => element(id, HTMLTextAreaElement);
const node = (id: string) => element(id, HTMLElement);
const metadataNames = ['skill_name', 'schema_version', 'skill_version', 'description'] as const;
const metadataLabels = ['Skill name', 'Schema version (optional)', 'Skill version (optional)', 'Description'];
const fieldControls = {
  id: input('case-id'), name: input('case-name'), prompt: textarea('prompt'),
  expected_output: textarea('expected-output')
};
const dirty = () => Object.keys(state.caseDraft).length > 0 || Object.keys(state.metadataDraft).length > 0;
const selectedIndex = () => suite?.evals.findIndex(entry => entry.id === state.selectedId) ?? -1;
const selected = () => suite?.evals[selectedIndex()];

function persist() { api.setState(state); }
function notice(message: string) {
  node('notice').textContent = message;
  node('notice').hidden = !message;
}
function announce(message: string) { node('status').textContent = message; }
function beginDraft() {
  if (!dirty()) state.baseVersion = version;
  announce('');
}
function controls() {
  const locked = invalid || !!pending || conflict;
  for (const control of document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    '#case-editor input, #case-editor textarea, #metadata-fields input, #metadata-fields textarea'
  )) control.disabled = invalid || !!pending;
  for (const control of document.querySelectorAll<HTMLButtonElement>('.item-actions button')) {
    if (invalid || pending) control.disabled = true;
  }
  button('add-expectation').disabled = invalid || !!pending;
  button('add-file').disabled = invalid || !!pending;
  button('apply-case').disabled = locked || !Object.keys(state.caseDraft).length;
  button('apply-metadata').disabled = locked || !Object.keys(state.metadataDraft).length;
  button('discard').disabled = !!pending || !dirty();
  button('add-case').disabled = locked || dirty();
  for (const id of ['duplicate', 'delete', 'confirm-delete']) button(id).disabled = locked || dirty();
  button('move-up').disabled = locked || dirty() || selectedIndex() <= 0;
  button('move-down').disabled = locked || dirty() || selectedIndex() >= (suite?.evals.length ?? 0) - 1;
  node('draft-state').textContent = conflict ? 'Draft retained; discard to reload'
    : pending ? 'Applying...' : dirty() ? 'Unapplied draft (not yet saved)' : 'No pending changes';
}
function navigationAllowed(): boolean {
  if (dirty()) {
    notice('Apply or discard the current draft before changing cases.');
    return false;
  }
  return !pending && !invalid;
}
function renderList() {
  const list = node('case-list');
  list.replaceChildren();
  const terms = state.search.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = (suite?.evals ?? []).filter(entry => {
    const haystack = [entry.id, entry.name, entry.prompt, entry.expected_output,
      ...(entry.expectations ?? []), ...(entry.files ?? [])].join(' ').toLowerCase();
    return terms.every(term => haystack.includes(term));
  });
  node('case-count').textContent = `${matches.length} of ${suite?.evals.length ?? 0} cases`;
  for (const entry of matches) {
    const item = document.createElement('button');
    item.type = 'button';
    item.textContent = `#${entry.id} ${entry.name || entry.prompt.slice(0, 70) || 'Untitled case'}`;
    item.setAttribute('aria-current', String(entry.id === state.selectedId));
    item.onclick = () => {
      if (!navigationAllowed()) return;
      state.selectedId = entry.id;
      notice('');
      node('delete-confirm').hidden = true;
      persist();
      renderList();
      renderCase();
      input('case-id').focus();
    };
    list.append(item);
  }
  if (!matches.length && suite?.evals.length) {
    const empty = document.createElement('p');
    empty.textContent = 'No cases match. Clear the search to see all cases.';
    list.append(empty);
  }
}

function currentCase(): EvalCase | undefined {
  const entry = selected();
  return entry ? { ...entry, ...state.caseDraft } : undefined;
}
function updateCaseField(field: keyof EvalCase, value: string | number | string[]) {
  beginDraft();
  state.caseDraft[field] = value;
  persist();
  controls();
}
function renderArray(field: 'expectations' | 'files') {
  const container = node(field);
  container.replaceChildren();
  const values = currentCase()?.[field] ?? [];
  const singular = field === 'expectations' ? 'expectation' : 'file';
  values.forEach((value, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'array-item';
    const label = document.createElement('label');
    const id = `${field}-${index}`;
    label.htmlFor = id;
    label.textContent = `${singular[0]!.toUpperCase()}${singular.slice(1)} ${index + 1}`;
    const control = document.createElement(field === 'expectations' ? 'textarea' : 'input');
    control.id = id;
    control.value = value;
    if (control instanceof HTMLTextAreaElement) control.rows = 3;
    control.oninput = () => {
      const next = [...(currentCase()?.[field] ?? [])];
      next[index] = control.value;
      updateCaseField(field, next);
    };
    const actions = document.createElement('div');
    actions.className = 'item-actions';
    const addAction = (labelText: string, disabled: boolean, onClick: () => void) => {
      const action = document.createElement('button');
      action.type = 'button';
      action.textContent = labelText;
      action.disabled = disabled;
      action.onclick = onClick;
      actions.append(action);
    };
    addAction(`Remove ${singular} ${index + 1}`, false, () => {
      const next = [...(currentCase()?.[field] ?? [])];
      next.splice(index, 1);
      updateCaseField(field, next);
      renderArray(field);
      button(field === 'expectations' ? 'add-expectation' : 'add-file').focus();
    });
    for (const direction of [-1, 1]) {
      const target = index + direction;
      addAction(`Move ${singular} ${index + 1} ${direction < 0 ? 'up' : 'down'}`,
        target < 0 || target >= values.length, () => {
          const next = [...(currentCase()?.[field] ?? [])];
          [next[index], next[target]] = [next[target]!, next[index]!];
          updateCaseField(field, next);
          renderArray(field);
          element<HTMLInputElement | HTMLTextAreaElement>(
            `${field}-${target}`, field === 'expectations' ? HTMLTextAreaElement : HTMLInputElement
          ).focus();
        });
    }
    wrapper.append(label, control, actions);
    container.append(wrapper);
  });
}
function renderCase() {
  const entry = currentCase();
  node('empty').hidden = !!entry;
  node('empty').textContent = invalid
    ? 'The document cannot be edited visually. Fix its JSON source to continue.'
    : 'No cases yet. Add a case to start.';
  node('case-editor').hidden = !entry;
  if (entry) {
    node('case-heading').textContent = entry.name || `Case #${entry.id}`;
    fieldControls.id.value = String(entry.id);
    fieldControls.name.value = entry.name ?? '';
    fieldControls.prompt.value = entry.prompt;
    fieldControls.expected_output.value = entry.expected_output;
    renderArray('expectations');
    renderArray('files');
  }
  controls();
}
function renderMetadata() {
  const container = node('metadata-fields');
  container.replaceChildren();
  metadataNames.forEach((field, index) => {
    const wrapper = document.createElement('div');
    if (field === 'description') wrapper.className = 'description';
    const label = document.createElement('label');
    label.htmlFor = `metadata-${field}`;
    label.textContent = metadataLabels[index]!;
    const control = document.createElement(field === 'description' ? 'textarea' : 'input');
    control.id = `metadata-${field}`;
    if (control instanceof HTMLTextAreaElement) control.rows = 4;
    control.value = state.metadataDraft[field] ?? suite?.[field] ?? '';
    control.disabled = invalid;
    control.oninput = () => {
      beginDraft();
      state.metadataDraft[field] = control.value;
      persist();
      controls();
    };
    wrapper.append(label, control);
    container.append(wrapper);
  });
}
function send(action: EditAction) {
  if (pending || invalid || conflict) return;
  notice('');
  pending = { requestId: ++requestId, action };
  controls();
  api.postMessage({ type: 'edit', requestId, version: dirty() ? state.baseVersion : version, action });
}
function chooseAfterAction(action: EditAction) {
  if (!suite) return;
  let index = selectedIndex();
  if (action.type === 'addCase') index = suite.evals.length - 1;
  if (action.type === 'duplicateCase') index = action.index + 1;
  if (action.type === 'moveCase') index = action.index + action.direction;
  if (action.type === 'deleteCase') index = Math.min(action.index, suite.evals.length - 1);
  if (action.type === 'updateCase') index = action.index;
  const id = suite.evals[index]?.id;
  if (id !== undefined) state.selectedId = id;
  else delete state.selectedId;
  node('delete-confirm').hidden = true;
}

for (const [field, control] of Object.entries(fieldControls)) {
  control.oninput = () => updateCaseField(field, field === 'id' ? control instanceof HTMLInputElement
    ? control.valueAsNumber : Number.NaN : control.value);
}
input('search').value = state.search;
input('search').oninput = () => {
  state.search = input('search').value;
  persist();
  renderList();
};
button('source').onclick = () => {
  if (dirty()) {
    notice('Apply or discard the current draft before opening JSON source.');
    return;
  }
  api.postMessage({ type: 'source' });
};
button('add-case').onclick = () => {
  if (!navigationAllowed()) return;
  state.search = '';
  input('search').value = '';
  send({ type: 'addCase' });
};
button('duplicate').onclick = () => send({ type: 'duplicateCase', index: selectedIndex() });
button('move-up').onclick = () => send({ type: 'moveCase', index: selectedIndex(), direction: -1 });
button('move-down').onclick = () => send({ type: 'moveCase', index: selectedIndex(), direction: 1 });
button('delete').onclick = () => {
  node('delete-confirm').hidden = false;
  button('confirm-delete').focus();
};
button('cancel-delete').onclick = () => {
  node('delete-confirm').hidden = true;
  button('delete').focus();
};
button('confirm-delete').onclick = () => send({ type: 'deleteCase', index: selectedIndex() });
button('apply-case').onclick = () => send({ type: 'updateCase', index: selectedIndex(), fields: state.caseDraft });
button('apply-metadata').onclick = () => send({ type: 'updateMetadata', fields: state.metadataDraft });
button('discard').onclick = () => {
  state.caseDraft = {};
  state.metadataDraft = {};
  state.baseVersion = version;
  conflict = false;
  persist();
  notice('');
  if (selectedIndex() < 0) {
    const id = suite?.evals[0]?.id;
    if (id !== undefined) state.selectedId = id;
    else delete state.selectedId;
  }
  renderMetadata();
  renderList();
  renderCase();
  announce('Draft discarded; reloaded from document.');
};
for (const field of ['expectations', 'files'] as const) {
  button(field === 'expectations' ? 'add-expectation' : 'add-file').onclick = () => {
    const values = [...(currentCase()?.[field] ?? []), ''];
    updateCaseField(field, values);
    renderArray(field);
    element<HTMLInputElement | HTMLTextAreaElement>(
      `${field}-${values.length - 1}`, field === 'expectations' ? HTMLTextAreaElement : HTMLInputElement
    ).focus();
  };
}
globalThis.addEventListener('message', event => {
  const message: unknown = event.data;
  if (!isRecord(message)) return;
  if (message['type'] === 'result' && pending && message['requestId'] === pending.requestId) {
    const action = pending.action;
    pending = undefined;
    if (typeof message['error'] === 'string') notice(message['error']);
    else {
      if (action.type === 'updateCase') state.caseDraft = {};
      if (action.type === 'updateMetadata') state.metadataDraft = {};
      selectionAction = action;
      acceptedUpdate = true;
      // The host sends a fresh document immediately after the result.
      state.baseVersion = version;
      announce('Applied to document. Use VS Code Save to write to disk.');
      persist();
    }
    controls();
  } else if (message['type'] === 'document' && typeof message['version'] === 'number') {
    version = message['version'];
    const wasInvalid = invalid;
    invalid = typeof message['error'] === 'string';
    if (invalid) {
      suite = undefined;
      if (!dirty()) {
        node('case-editor').hidden = true;
        node('empty').hidden = false;
        node('empty').textContent = 'The document cannot be edited visually. Fix its JSON source to continue.';
        node('case-list').replaceChildren();
        renderMetadata();
      }
      notice(String(message['error']));
      controls();
      return;
    }
    // Document messages originate only from the provider, which validates the full shape.
    suite = message['data'] as EvalSuite;
    if (pending) return;
    const shouldRender = acceptedUpdate || !rendered || !dirty();
    if (acceptedUpdate) {
      state.baseVersion = version;
      acceptedUpdate = false;
    }
    if (wasInvalid) notice('');
    if (dirty() && state.baseVersion !== version) {
      conflict = true;
      notice('Document changed outside this draft. Your draft is retained. Discard it to reload the current document.');
      controls();
      return;
    }
    if (selectionAction) {
      chooseAfterAction(selectionAction);
      selectionAction = undefined;
    }
    if (selectedIndex() < 0 && !dirty()) {
      const id = suite.evals[0]?.id;
      if (id !== undefined) state.selectedId = id;
      else delete state.selectedId;
    }
    conflict = false;
    node('suite-title').textContent = `${suite.skill_name} - ${suite.evals.length} cases`;
    if (shouldRender) {
      state.baseVersion = version;
      // Preserve a failed validation notice until the user retries or discards.
      renderMetadata();
      renderList();
      renderCase();
      rendered = true;
    } else controls();
    persist();
  } else if (message['type'] === 'error' && typeof message['error'] === 'string') {
    notice(message['error']);
  }
});
controls();
api.postMessage({ type: 'ready' });
