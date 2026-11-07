import { Document, isMap, isNode, isScalar, parseDocument, visit } from 'yaml';
import { marked } from 'marked';
import { isRecord } from './model.ts';
import { claudeBoolean, getProfile, portableFields, specUrl } from './skill-profiles.ts';

export interface SkillDocument {
  metadata: Record<string, unknown>;
  frontmatter: string;
  body: string;
  hasFrontmatter: boolean;
  bom: boolean;
  yamlFeatures: string[];
}
export interface SkillIssue {
  code: string;
  severity: 'error' | 'warning';
  field: string;
  message: string;
  docs: string;
}
export interface SkillAction {
  type: 'updateSkill';
  profile: string;
  fields?: Record<string, unknown>;
  remove?: string[];
  frontmatter?: string;
  body?: string;
}

function yamlDocument(source: string) {
  const document = parseDocument(source, { uniqueKeys: true, version: '1.2', prettyErrors: true });
  if (document.errors.length) throw new Error(`Invalid frontmatter YAML: ${document.errors[0]!.message}`);
  if (document.warnings.length) throw new Error(`Unsupported frontmatter YAML: ${document.warnings[0]!.message}`);
  if (document.contents !== null && !isMap(document.contents)) throw new Error('Frontmatter must be a YAML mapping of field names to values.');
  const features = new Set<string>();
  visit(document, {
    Alias() { features.add('aliases'); },
    Scalar(_key, node) {
      if (node.anchor) features.add('anchors');
      if (node.tag) features.add('explicit tags');
      if (typeof node.value === 'number' && (!Number.isFinite(node.value) ||
        (Number.isInteger(node.value) && !Number.isSafeInteger(node.value)))) {
        throw new Error('This numeric YAML value cannot be represented safely by the editor. Preserve it as quoted text or edit in source.');
      }
    },
    Map(_key, node) { if (node.flow) features.add('flow mappings'); if (node.anchor) features.add('anchors'); },
    Seq(_key, node) { if (node.flow) features.add('flow lists'); if (node.anchor) features.add('anchors'); },
    Pair(_key, pair) {
      if (!isScalar(pair.key) || typeof pair.key.value !== 'string') throw new Error('YAML field names must be strings.');
    }
  });
  const value: unknown = document.toJS({ maxAliasCount: 100 });
  // Circular aliases cannot be safely sent to a webview or edited as metadata.
  try { JSON.stringify(value); }
  catch { throw new Error('Circular or excessively expanded YAML aliases are not supported. Fix the source.'); }
  return { document, metadata: isRecord(value) ? value : {}, features: [...features] };
}

export function parseSkill(text: string): SkillDocument {
  const opening = /^\uFEFF?---[ \t]*\r?\n/.exec(text);
  if (!opening) {
    if (/^\uFEFF?---[ \t]*$/.test(text)) throw new Error('Frontmatter is missing its closing --- delimiter.');
    return { metadata: {}, frontmatter: '', body: text, hasFrontmatter: false, bom: text.startsWith('\uFEFF'), yamlFeatures: [] };
  }
  const rest = text.slice(opening[0].length);
  const closing = /^---[ \t]*(?:\r?\n|$)/m.exec(rest);
  if (!closing) throw new Error('Frontmatter is missing its closing --- delimiter.');
  const frontmatter = rest.slice(0, closing.index);
  if (/^\.\.\.[ \t]*$/m.test(frontmatter)) throw new Error('Multiple YAML document delimiters are not supported in frontmatter.');
  const { metadata, features } = yamlDocument(frontmatter);
  return { metadata, frontmatter, body: rest.slice(closing.index + closing[0].length),
    hasFrontmatter: true, bom: text.startsWith('\uFEFF'), yamlFeatures: features };
}

export function parseFieldYaml(source: string): unknown {
  // Wrap values so duplicate keys, tags and alias bounds receive exactly the same checks.
  const wrapped = source.split(/\r?\n/).map(line => `  ${line}`).join('\n');
  return yamlDocument(`value:\n${wrapped}\n`).metadata['value'];
}
export function parseFrontmatterYaml(source: string): Record<string, unknown> {
  return yamlDocument(source).metadata;
}

export function validateSkill(skill: SkillDocument, profileId: string, directoryName?: string): SkillIssue[] {
  const profile = getProfile(profileId);
  const issues: SkillIssue[] = [];
  const add = (code: string, field: string, message: string, severity: SkillIssue['severity'] = 'error', docs = profile.docs) =>
    issues.push({ code, field, message, severity, docs });
  const meta = skill.metadata;
  const strict = profileId === 'portable' || profileId === 'claude-api';
  if (!skill.hasFrontmatter) add('missing-frontmatter', 'frontmatter', 'Add name and description for portable YAML frontmatter.',
    ['claude-code', 'opencode'].includes(profileId) ? 'warning' : 'error');
  if (skill.bom) add('bom', 'frontmatter', 'A byte-order mark is present. Some harnesses require --- at the very first character.', 'warning');
  if (skill.yamlFeatures.length) add('yaml-portability', 'frontmatter',
    `This YAML uses ${skill.yamlFeatures.join(', ')}. The current skills-ref StrictYAML parser has a narrower subset than general YAML; verify with the target loader.`, 'warning', specUrl);
  const optionalName = ['claude-code', 'codex', 'devin', 'opencode', 'copilot-vscode'].includes(profileId);
  const optionalDescription = ['claude-code', 'opencode', 'copilot-vscode'].includes(profileId);
  for (const [field, optional] of [['name', optionalName], ['description', optionalDescription]] as const) {
    const value = meta[field];
    if (value === undefined) {
      add(`missing-${field}`, field, optional ? `${field} is omitted; the selected harness has a fallback. Adding it improves portability.`
        : `${field} is required for this target.`, optional ? 'warning' : 'error');
    } else if (typeof value !== 'string' || !value.trim()) add('field-type', field, `${field} must be a non-empty string.`);
  }
  const name = meta['name'];
  if (typeof name === 'string' && name.trim()) {
    const normalized = name.normalize('NFKC').trim();
    const portableName = normalized === normalized.toLowerCase() && /^[\p{L}\p{N}-]+$/u.test(normalized) &&
      !normalized.startsWith('-') && !normalized.endsWith('-') && !normalized.includes('--');
    const ascii = /^[a-z0-9-]+$/.test(name);
    const nameRequiredRule = strict || profileId === 'kiro' || profileId === 'cursor';
    if (!portableName) add('name-format', 'name', 'Portable names use lowercase alphanumeric characters and single, non-edge hyphens.',
      nameRequiredRule ? 'error' : 'warning', specUrl);
    if (profileId === 'copilot-vscode' && !ascii) {
      add('ascii-name', 'name', 'This harness documents lowercase ASCII letters, numbers and hyphens.', 'error');
    }
    if (['kiro', 'cursor', 'claude-api'].includes(profileId) && !ascii && portableName) {
      add('unicode-support', 'name', 'The portable reference allows Unicode names, but this target documentation does not explicitly establish Unicode acceptance. Verify the target.', 'warning');
    }
    const countedName = profileId === 'portable' ? normalized : profileId === 'codex' ? name.trim().replace(/\s+/g, ' ') : name;
    if ([...countedName].length > 64) {
      add('name-length', 'name', 'Name exceeds 64 characters.', strict || ['codex', 'kiro', 'claude-ai'].includes(profileId) ? 'error' : 'warning');
    }
    if (directoryName && directoryName.normalize('NFKC') !== normalized) {
      add('directory-match', 'name', profileId === 'copilot-vscode'
        ? 'VS Code replaces a mismatching name with the folder name.' : `Portable name must match the folder "${directoryName}".`,
      strict || ['kiro', 'cursor'].includes(profileId) ? 'error' : 'warning');
    }
    if (profileId === 'claude-code' && /[\p{C}\u00a0<>]| {2}|^ | $/u.test(name)) {
      add('claude-name', 'name', 'Claude Code refuses invisible/control characters, irregular spaces and angle brackets.');
    }
    if (profileId === 'claude-code' && ['synced', 'anthropic-skills'].includes(name)) {
      add('reserved-name', 'name', 'This folder name is reserved by Claude Code.');
    }
    if (profileId === 'claude-api' && /anthropic|claude/i.test(name)) {
      add('reserved-name', 'name', 'API docs say names cannot contain reserved words anthropic or claude. Substring matching is not explicitly defined; verify before upload.',
        ['anthropic', 'claude'].includes(name) ? 'error' : 'warning');
    }
    if (profileId === 'gemini-cli' && /[:\\/<>*?"|]/.test(name)) {
      add('sanitized-name', 'name', 'The Gemini CLI loader replaces filesystem-special characters with hyphens.', 'warning');
    }
    if (profileId === 'codex' && /[\n\t]|\s{2}/.test(name)) add('flattened-name', 'name', 'Codex collapses name whitespace when loading the skill.', 'warning');
  }
  const description = meta['description'];
  if (typeof description === 'string') {
    if ([...description].length > 1024) add('description-length', 'description', 'Description exceeds the portable 1,024-character limit.',
      strict || ['kiro', 'claude-ai'].includes(profileId) ? 'error' : 'warning');
    if (profileId === 'claude-ai' && [...description].length > 200) {
      add('claude-ai-conflict', 'description', 'Claude.ai help says 200 characters; platform docs say 1,024. Verify the current upload UI.', 'warning');
    }
    if (profileId === 'claude-api' && /<[^>]*>/.test(description)) add('description-xml', 'description', 'Claude Skills API descriptions cannot contain XML tags.');
    if (profileId === 'copilot-vscode' && /<[^>]*>/.test(description)) add('description-sanitized', 'description', 'VS Code strips tags from descriptions.', 'warning');
    if (profileId === 'copilot-vscode' && description.length > 1024 && [...description].length <= 1024) {
      add('description-truncated', 'description', 'The observed VS Code loader truncates at 1,024 UTF-16 code units; this Unicode description can be shortened even below 1,024 code points.', 'warning');
    }
    if (profileId === 'claude-code' && [...(description + (typeof meta['when_to_use'] === 'string' ? meta['when_to_use'] : ''))].length > 1536) {
      add('listing-limit', 'description', 'Claude Code truncates the description plus when_to_use listing at 1,536 characters.', 'warning');
    }
    if (profileId === 'codex' && /\n/.test(description)) add('flattened-description', 'description', 'Codex collapses description whitespace into one line.', 'warning');
  }
  const interpretedBase = !['codex', 'gemini-cli'].includes(profileId);
  for (const field of ['license', 'compatibility', 'allowed-tools']) {
    if (!(field in meta)) continue;
    const listAllowed = field === 'allowed-tools' && profileId === 'claude-code';
    if (typeof meta[field] !== 'string' && !(listAllowed && strings(meta[field]))) {
      add('field-type', field, `${field} must be ${listAllowed ? 'a string or list of strings' : 'a string'}.`,
        interpretedBase && !(field === 'allowed-tools' && ['copilot-vscode', 'opencode', 'other'].includes(profileId)) ? 'error' : 'warning');
    }
  }
  if (typeof meta['compatibility'] === 'string' && (!meta['compatibility'].trim() || [...meta['compatibility']].length > 500)) {
    add('compatibility-length', 'compatibility', 'Compatibility must contain 1–500 characters if provided.', interpretedBase ? 'error' : 'warning');
  }
  if ('metadata' in meta) {
    if (!isRecord(meta['metadata'])) add('metadata-map', 'metadata', 'metadata must be a key-value mapping.');
    else {
      if (Object.values(meta['metadata']).some(value => typeof value !== 'string')) {
        add('metadata-strings', 'metadata', 'Portable metadata values are strings. This harness may use richer values.',
          strict || profileId === 'kiro' ? 'error' : 'warning', specUrl);
      }
      if (profileId === 'codex' && 'short-description' in meta['metadata'] && typeof meta['metadata']['short-description'] !== 'string') {
        add('short-description', 'metadata', 'Codex metadata.short-description must be a string.');
      }
      if (profileId === 'opencode' && 'opencode/autoinvoke' in meta['metadata'] && typeof meta['metadata']['opencode/autoinvoke'] !== 'boolean') {
        add('autoinvoke', 'metadata', 'opencode/autoinvoke should be a boolean; its value overrides disable-model-invocation.', 'warning');
      }
    }
  }
  for (const field of profile.fields) {
    const value = meta[field.key];
    if (value === undefined) continue;
    if (field.kind === 'boolean' && (profileId === 'claude-code' ? claudeBoolean(value) === undefined : typeof value !== 'boolean')) {
      add('field-type', field.key, `${field.key} must be a boolean${profileId === 'claude-code' ? ' or a documented boolean alias' : ''}.`);
    } else if (field.kind === 'enum' && (typeof value !== 'string' || !field.options?.includes(value))) {
      add('field-enum', field.key, `${field.key} must be one of: ${field.options?.join(', ')}.`);
    } else if (['text', 'multiline'].includes(field.kind) && typeof value !== 'string') {
      add('field-type', field.key, `${field.key} must be a string.`);
    } else if (field.kind === 'string-list' && typeof value !== 'string' && !strings(value)) {
      add('field-type', field.key, `${field.key} must be a string or list of strings.`);
    }
  }
  const known = new Set([...portableFields.map(field => field.key), 'metadata', ...profile.fields.map(field => field.key)]);
  for (const field of Object.keys(meta)) {
    if (!known.has(field)) add('unknown-field', field, `${field} is not a portable field${strict ? '' : ' or documented for this target'}. It is preserved; support is not guaranteed.`,
      strict ? 'error' : 'warning');
  }
  if (profileId === 'gemini-cli' && Object.keys(meta).some(key => !['name', 'description'].includes(key))) {
    add('ignored-fields', 'frontmatter', 'The observed Gemini CLI loader ignores fields other than name and description.', 'warning');
  }
  if (profileId === 'copilot-vscode' && 'allowed-tools' in meta) add('unsupported-tools', 'allowed-tools', 'allowed-tools is not in the observed VS Code supported-attribute list. CLI support does not establish VS Code support.', 'warning');
  if ('allowed-tools' in meta && ['kiro', 'cursor', 'opencode', 'goose', 'windsurf', 'other'].includes(profileId)) {
    add('unverified-tools', 'allowed-tools', 'allowed-tools pre-approval semantics are not established by the reviewed documentation for this target.', 'warning');
  }
  if (profileId === 'copilot-vscode' && meta['context'] === 'fork') add('fork-setting', 'context', 'context: fork requires the experimental VS Code skill-tool setting. Check your installation.', 'warning');
  if (profileId === 'copilot-vscode' && !description &&
    (meta['user-invocable'] === false || meta['disable-model-invocation'] === false)) add('invocation-description', 'description', 'These invocation settings require a description in the observed VS Code validator.');
  if (profileId === 'devin') {
    if ('triggers' in meta && (!strings(meta['triggers']) || meta['triggers'].some(value => !['user', 'model'].includes(value)))) {
      add('triggers', 'triggers', 'triggers must be a list containing only user and/or model.');
    }
    if ('permissions' in meta) {
      if (!isRecord(meta['permissions']) || Object.entries(meta['permissions']).some(([key, value]) =>
        !['allow', 'deny', 'ask'].includes(key) || !strings(value))) add('permissions', 'permissions', 'permissions must contain allow, deny and/or ask lists of tool matchers.');
      else add('permission-scope', 'permissions', 'Permission structure is valid; matcher semantics and effective permissions require harness validation.', 'warning');
    }
  }
  if (profileId === 'claude-code' && 'hooks' in meta) {
    validateHooks(meta['hooks'], add);
    add('hook-scope', 'hooks', 'Hook shape is checked, not event-specific behaviour, execution safety, session budgets or managed policy. Hooks are never run by this editor.', 'warning',
      'https://code.claude.com/docs/en/hooks#hooks-in-skills-and-agents');
  }
  if (skill.body.split(/\r?\n/).length > 500) add('body-length', 'body', 'Keep SKILL.md under 500 lines where practical; move detail into references. This is guidance, not a format requirement.', 'warning', specUrl);
  if (!skill.body.trim()) add('empty-body', 'body', 'Add instructions that explain the procedure. No particular heading is required.', 'warning', specUrl);
  return issues;
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}
function validateHooks(value: unknown, add: (code: string, field: string, message: string) => void) {
  if (!isRecord(value)) { add('hooks', 'hooks', 'hooks must be an event-name mapping.'); return; }
  for (const groups of Object.values(value)) {
    if (!Array.isArray(groups)) { add('hooks', 'hooks', 'Each hook event must contain a list of matcher groups.'); continue; }
    for (const group of groups) {
      if (!isRecord(group) || ('matcher' in group && typeof group['matcher'] !== 'string') || !Array.isArray(group['hooks'])) {
        add('hooks', 'hooks', 'Matcher groups need a hooks list and an optional string matcher.'); continue;
      }
      for (const handler of group['hooks']) {
        if (!isRecord(handler) || typeof handler['type'] !== 'string') { add('hooks', 'hooks', 'Every handler needs a type.'); continue; }
        const required: Record<string, string[]> = { command: ['command'], http: ['url'], mcp_tool: ['server', 'tool'], prompt: ['prompt'], agent: ['prompt'] };
        const fields = required[handler['type']];
        if (!fields || fields.some(field => typeof handler[field] !== 'string' || !handler[field])) {
          add('hooks', 'hooks', 'A hook needs a documented type and its required string fields.');
        }
        if ('timeout' in handler && (typeof handler['timeout'] !== 'number' || !Number.isFinite(handler['timeout']))) add('hooks', 'hooks', 'Hook timeout must be a finite number of seconds.');
        for (const field of ['once', 'async', 'asyncRewake']) {
          if (field in handler && claudeBoolean(handler[field]) === undefined) add('hooks', 'hooks', `${field} must be a boolean.`);
        }
        for (const field of ['args', 'allowedEnvVars']) {
          if (field in handler && !strings(handler[field])) add('hooks', 'hooks', `${field} must be a string list.`);
        }
      }
    }
  }
}

export function applySkillAction(text: string, action: unknown, directoryName?: string): string {
  if (!isRecord(action) || action['type'] !== 'updateSkill' || typeof action['profile'] !== 'string') throw new Error('Invalid skill editor action.');
  getProfile(action['profile']);
  const skill = parseSkill(text);
  if ('body' in action && typeof action['body'] !== 'string') throw new Error('Skill body must be Markdown text.');
  if ('frontmatter' in action && typeof action['frontmatter'] !== 'string') throw new Error('Frontmatter must be YAML text.');
  if ('fields' in action && !isRecord(action['fields'])) throw new Error('Skill fields must be a mapping.');
  if ('remove' in action && !strings(action['remove'])) throw new Error('Removed field names must be a string list.');
  if ('frontmatter' in action && ('fields' in action || 'remove' in action)) throw new Error('Apply either guided fields or raw frontmatter, not both.');
  const yamlChanged = 'frontmatter' in action || Object.keys(action['fields'] ?? {}).length > 0 ||
    (Array.isArray(action['remove']) && action['remove'].length > 0);
  let frontmatter = skill.frontmatter;
  if (typeof action['frontmatter'] === 'string') {
    yamlDocument(action['frontmatter']);
    frontmatter = action['frontmatter'];
  } else if (yamlChanged) {
    const document = skill.hasFrontmatter ? yamlDocument(skill.frontmatter).document : new Document({});
    if (isRecord(action['fields'])) for (const [key, value] of Object.entries(action['fields'])) {
      document.set(key, value);
      const node = document.get(key, true);
      if (isNode(node)) visit(node, {
        Scalar(_key, scalar) { if (typeof scalar.value === 'string') scalar.type = 'QUOTE_DOUBLE'; }
      });
    }
    if (strings(action['remove'])) for (const key of action['remove']) document.delete(key);
    frontmatter = document.toString({ lineWidth: 0, defaultStringType: 'QUOTE_DOUBLE' });
  }
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const body = typeof action['body'] === 'string' ? action['body'].replace(/\r?\n/g, eol) : skill.body;
  let result = text;
  if (yamlChanged) {
    result = `${skill.bom ? '\uFEFF' : ''}---${eol}${frontmatter.replace(/\r?\n/g, eol).replace(/\r?\n?$/, eol)}---${eol}${body}`;
  } else if ('body' in action) {
    result = text.slice(0, text.length - skill.body.length) + body;
  }
  const errors = validateSkill(parseSkill(result), action['profile'], directoryName).filter(issue => issue.severity === 'error');
  if (errors.length) throw new Error(errors.map(issue => issue.message).join('\n'));
  return result;
}

export function richMarkdownIssue(body: string): string | undefined {
  const tokens = marked.lexer(body);
  if (Object.keys(tokens.links).length) return 'Reference-link definitions are preserved in Markdown mode.';
  let reason: string | undefined;
  marked.walkTokens(tokens, token => {
    if (['html', 'image', 'table'].includes(token.type) || ('task' in token && token.task)) {
      reason = 'HTML/comments, images, tables and task lists use lossless Markdown mode rather than risking conversion loss.';
    }
  });
  return reason;
}

export function markdownEquivalent(before: string, after: string): boolean {
  const html = (value: string) => String(marked.parse(value, { async: false })).trim().replace(/>\s+</g, '><');
  return html(before) === html(after);
}
