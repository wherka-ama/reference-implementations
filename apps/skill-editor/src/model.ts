import { applyEdits, modify, parse, printParseErrorCode, visit, type ParseError } from 'jsonc-parser';

export interface EvalCase {
  id: number;
  name?: string;
  prompt: string;
  expected_output: string;
  expectations?: string[];
  files?: string[];
  [key: string]: unknown;
}

export interface EvalSuite {
  skill_name: string;
  schema_version?: string;
  skill_version?: string;
  description?: string;
  evals: EvalCase[];
  [key: string]: unknown;
}

export type EditAction =
  | { type: 'updateCase'; index: number; fields: Partial<EvalCase> }
  | { type: 'updateMetadata'; fields: Record<string, string> }
  | { type: 'addCase' }
  | { type: 'duplicateCase' | 'deleteCase'; index: number }
  | { type: 'moveCase'; index: number; direction: -1 | 1 };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const metadataFields = ['skill_name', 'schema_version', 'skill_version', 'description'];
const caseFields = ['id', 'name', 'prompt', 'expected_output', 'expectations', 'files'];

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

export function parseEvals(text: string): EvalSuite {
  const errors: ParseError[] = [];
  const value: unknown = parse(text, errors, { disallowComments: true, allowTrailingComma: false });
  if (errors.length) {
    const error = errors[0]!;
    throw new Error(`Invalid JSON: ${printParseErrorCode(error.error)} at offset ${error.offset}. Fix it in the JSON source.`);
  }
  const keys: Set<string>[] = [];
  visit(text, {
    onObjectBegin: () => { keys.push(new Set()); },
    onObjectProperty: name => {
      const current = keys.at(-1)!;
      if (current.has(name)) throw new Error(`Duplicate JSON property "${name}". Fix it in the JSON source.`);
      current.add(name);
    },
    onObjectEnd: () => { keys.pop(); }
  });
  if (!isRecord(value) || typeof value['skill_name'] !== 'string' || !Array.isArray(value['evals'])) {
    throw new Error('Expected an object with a string skill_name and an evals array. Open JSON source to repair it.');
  }
  for (const field of metadataFields.slice(1)) {
    if (field in value && typeof value[field] !== 'string') throw new Error(`${field} must be a string.`);
  }
  const ids = new Set<number>();
  const evals: EvalCase[] = value['evals'].map((entry: unknown, index: number) => {
    if (!isRecord(entry) || typeof entry['id'] !== 'number' || !Number.isSafeInteger(entry['id']) ||
      typeof entry['prompt'] !== 'string' || typeof entry['expected_output'] !== 'string') {
      throw new Error(`Case ${index + 1} needs a safe integer id, string prompt and string expected_output.`);
    }
    const id = entry['id'];
    if (ids.has(id)) throw new Error(`Case IDs must be unique: duplicate ${id}.`);
    ids.add(id);
    if ('name' in entry && typeof entry['name'] !== 'string') throw new Error(`Case ${id}: name must be a string.`);
    for (const field of ['expectations', 'files']) {
      if (field in entry && !stringArray(entry[field])) throw new Error(`Case ${id}: ${field} must be an array of strings.`);
    }
    return { ...entry, id, prompt: entry['prompt'], expected_output: entry['expected_output'] };
  });
  return { ...value, skill_name: value['skill_name'], evals };
}

function nextId(evals: EvalCase[]): number {
  const max = Math.max(0, ...evals.map(entry => entry.id));
  if (max < Number.MAX_SAFE_INTEGER) return max + 1;
  const ids = new Set(evals.map(entry => entry.id));
  let id = 1;
  while (ids.has(id)) id++;
  return id;
}

export function applyAction(text: string, action: unknown): string {
  const suite = parseEvals(text);
  if (!isRecord(action) || typeof action['type'] !== 'string') throw new Error('Invalid editor action.');
  const type = action['type'];
  const indent = text.match(/(?:\r?\n)([ \t]+)"/)?.[1] ?? '  ';
  const formattingOptions = {
    insertSpaces: !indent.includes('\t'),
    tabSize: indent.includes('\t') ? 4 : indent.length,
    eol: text.includes('\r\n') ? '\r\n' : '\n'
  };
  let updated = text;
  function set(path: (string | number)[], value: unknown) {
    updated = applyEdits(updated, modify(updated, path, value, { formattingOptions }));
  }
  if (type === 'updateMetadata' || type === 'updateCase') {
    const fields = action['fields'];
    if (!isRecord(fields) || !Object.keys(fields).length) throw new Error('No fields to apply.');
    let index: number | undefined;
    if (type === 'updateCase') index = caseIndex(action['index'], suite);
    for (const [field, value] of Object.entries(fields)) {
      if (!(type === 'updateMetadata' ? metadataFields : caseFields).includes(field)) {
        throw new Error(`Unsupported editable field: ${field}.`);
      }
      if (field === 'id') {
        if (typeof value !== 'number' || !Number.isSafeInteger(value)) throw new Error('Case ID must be a safe integer.');
      } else if (field === 'expectations' || field === 'files') {
        if (!stringArray(value) || value.some(item => !item.trim())) throw new Error(`${field} must contain non-empty strings.`);
      } else if (typeof value !== 'string') {
        throw new Error(`${field} must be a string.`);
      } else if (['skill_name', 'prompt', 'expected_output'].includes(field) && !value.trim()) {
        throw new Error(`${field} cannot be blank.`);
      }
      set(index === undefined ? [field] : ['evals', index, field], value);
    }
  } else {
    const evals = [...suite.evals];
    if (type === 'addCase') {
      evals.push({ id: nextId(evals), name: 'new-case', prompt: 'Describe the task to execute.',
        expected_output: 'Describe what a successful result looks like.', expectations: [], files: [] });
    } else if (['duplicateCase', 'deleteCase', 'moveCase'].includes(type)) {
      const index = caseIndex(action['index'], suite);
      if (type === 'deleteCase') evals.splice(index, 1);
      if (type === 'duplicateCase') {
        const original = evals[index]!;
        evals.splice(index + 1, 0, { ...original, id: nextId(evals),
          ...(original.name !== undefined ? { name: `${original.name}-copy` } : {}) });
      }
      if (type === 'moveCase') {
        const direction = action['direction'];
        if (direction !== -1 && direction !== 1) throw new Error('Invalid move direction.');
        const target = index + direction;
        if (target < 0 || target >= evals.length) throw new Error('Cannot move beyond the suite boundary.');
        [evals[index], evals[target]] = [evals[target]!, evals[index]!];
      }
    } else throw new Error(`Unsupported editor action: ${type}.`);
    set(['evals'], evals);
  }
  parseEvals(updated);
  return updated;
}

function caseIndex(index: unknown, suite: EvalSuite): number {
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= suite.evals.length) {
    throw new Error('Case index is out of range.');
  }
  return index;
}
