import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseSkill, applySkillAction, validateSkill, richMarkdownIssue } from '../src/skill-model.ts';

const body = '\n# Any heading\n\n## Not a standard section\n\n```yaml\n---\nname: example\n---\n```\n';
const original = '---\n# Preserve this comment\nname: example\ndescription: >-\n  Helps with reports.\n  Use when writing reports.\nmetadata:\n  author: "A Person"\n  version: "1.0"\ncustom:\n  nested: [one, two]\n---\n' + body;

test('interprets actual YAML scalars, block text, comments and body fences', () => {
  const skill = parseSkill(original);
  assert.equal(skill.metadata['description'], 'Helps with reports. Use when writing reports.');
  assert.deepEqual(skill.metadata['custom'], { nested: ['one', 'two'] });
  assert.equal(skill.body, body);
  assert.equal(skill.hasFrontmatter, true);
  assert.equal(validateSkill(skill, 'claude-code', 'example').filter(i => i.severity === 'error').length, 0);
});

test('updates YAML while retaining unknown values, comments, CRLF and the untouched body', () => {
  const crlf = original.replaceAll('\n', '\r\n');
  const changed = applySkillAction(crlf, {
    type: 'updateSkill', profile: 'claude-code', fields: {
      description: 'Quoted "description": details\nUse when reporting.',
      'disable-model-invocation': true
    }
  }, 'example');
  const parsed = parseSkill(changed);
  assert.deepEqual(parsed.metadata['custom'], { nested: ['one', 'two'] });
  assert.equal(parsed.metadata['disable-model-invocation'], true);
  assert.equal(parsed.body, body.replaceAll('\n', '\r\n'));
  assert.ok(changed.includes('# Preserve this comment\r\n'));
});

test('body-only edits preserve frontmatter bytes and unmodified skill edits are a no-op', () => {
  const changed = applySkillAction(original, {
    type: 'updateSkill', profile: 'claude-code', body: '\n# New body\n'
  }, 'example');
  assert.equal(changed.slice(0, changed.indexOf('\n# New body')), original.slice(0, original.indexOf(body)));
  assert.equal(applySkillAction(original, { type: 'updateSkill', profile: 'claude-code' }, 'example'), original);
});

test('missing frontmatter can be added without discarding existing content', () => {
  const plain = '# Existing instructions\n\nDo the work.\n';
  assert.equal(parseSkill(plain).hasFrontmatter, false);
  const added = applySkillAction(plain, { type: 'updateSkill', profile: 'portable',
    fields: { name: 'example', description: 'Do the work. Use when requested.' } }, 'example');
  assert.equal(parseSkill(added).body, plain);
});

test('rejects ambiguous/malformed YAML, custom tags, multi-documents and alias bombs safely', () => {
  for (const source of [
    '---\nname: example\nname: other\n---\nText',
    '---\nname: [not closed\n---\nText',
    '---\n- not-a-map\n---\nText',
    '---\nname: example\n',
    '---\nname: !!js/function "function(){}"\n---\nText',
    '---\nname: example\n...\n---\nText',
    '---\nx: &x [*x]\nname: example\n---\nText',
    '---\nname: example\nunknown: .inf\n---\nText',
    '---\nname: example\nunknown: 9007199254740993\n---\nText'
  ]) assert.throws(() => parseSkill(source), Error);
  const aliases = parseSkill('---\nname: example\ndescription: &d A description\ncopy: *d\n---\nBody');
  assert.equal(aliases.metadata['copy'], 'A description');
});

test('portable thresholds, Unicode normalization and optional headings follow the standard', () => {
  const base = parseSkill('---\nname: café\ndescription: Use when café tasks need help.\n---\n# Arbitrary body');
  assert.equal(validateSkill(base, 'portable', 'café').filter(i => i.severity === 'error').length, 0);
  const issues = (name: string, description: string, compatibility?: string) => validateSkill({
    ...base, metadata: { name, description, ...(compatibility !== undefined ? { compatibility } : {}) }
  }, 'portable', name).filter(i => i.severity === 'error');
  assert.equal(issues('a'.repeat(64), 'x'.repeat(1024), 'x'.repeat(500)).length, 0);
  assert.ok(issues('a'.repeat(65), 'x'.repeat(1025), 'x'.repeat(501)).length >= 3);
  for (const name of ['-name', 'name-', 'two--words', 'Upper', 'with_space']) assert.ok(issues(name, 'Valid').length);
  assert.equal(issues('ｃａｆé', 'Valid').length, 0);
  assert.equal(issues('name', 'Contains <xml> tags.').length, 0, 'XML prohibition is not in the portable spec');
  assert.ok(validateSkill(base, 'portable', 'different-folder').some(i => i.code === 'directory-match'));
});

test('profiles accept documented deviations without pretending they are portable', () => {
  const skill = (metadata: Record<string, unknown>) => ({ ...parseSkill(original), metadata });
  const errors = (metadata: Record<string, unknown>, profile: string) =>
    validateSkill(skill(metadata), profile, 'example').filter(i => i.severity === 'error');
  const common = { name: 'example', description: 'Valid description' };
  assert.equal(errors({ ...common, 'allowed-tools': ['Read', 'Bash(git:*)'],
    'disable-model-invocation': true }, 'claude-code').length, 0);
  assert.equal(errors({ ...common, 'allowed-tools': ['Read'] }, 'copilot-vscode').length, 0,
    'An unsupported field should warn, not falsely claim the loader rejects its value');
  assert.ok(errors({ ...common, 'allowed-tools': ['Read'] }, 'portable').length);
  assert.equal(errors({ description: 'Task to perform.' }, 'codex').length, 0);
  assert.equal(errors({ name: 'ﬃ'.repeat(30), description: 'Task to perform.' }, 'codex').length, 0,
    'Codex name length is not the portable NFKC-normalized length');
  assert.equal(errors({ name: 'Human Display Label', description: 'x'.repeat(1500),
    metadata: { 'opencode/autoinvoke': false } }, 'opencode').length, 0);
  assert.equal(errors({ ...common, triggers: ['user'], permissions: { allow: ['Exec(git)'], deny: [] } }, 'devin').length, 0);
  assert.equal(errors({ ...common, paths: ['src/**'], color: 'green', 'disable-model-invocation': true }, 'cursor').length, 0);
  assert.equal(errors({ ...common, 'disable-model-invocation': 'on' }, 'claude-code').length, 0);
  assert.equal(errors({ ...common, background: 0 }, 'claude-code').length, 0);
  assert.ok(errors({ ...common, 'disable-model-invocation': 'not-boolean' }, 'claude-code').length);
  assert.ok(errors({ ...common, triggers: ['unknown'] }, 'devin').length);
  assert.ok(errors({ ...common, color: 'not-a-color' }, 'cursor').length);
  assert.ok(errors({ ...common, 'user-invocable': false }, 'claude-api').length);
  assert.ok(errors({ ...common, description: 'x'.repeat(1025) }, 'kiro').length);
  for (const profile of ['kiro', 'cursor']) {
    assert.equal(validateSkill(skill({ name: 'café', description: 'Valid' }), profile, 'café').filter(i => i.severity === 'error').length, 0);
  }
  assert.ok(validateSkill(skill({ ...common, description: '😀'.repeat(600) }), 'copilot-vscode', 'example')
    .some(i => i.code === 'description-truncated'));
  assert.equal(errors({ name: 'Mixed name', description: 'x'.repeat(1500) }, 'gemini-cli').length, 0);
  for (const profile of ['copilot-vscode', 'copilot-cli', 'goose', 'windsurf', 'other']) {
    assert.equal(errors(common, profile).length, 0);
  }
  assert.throws(() => validateSkill(skill(common), 'unknown-harness', 'example'));
  assert.equal(errors({ ...common, 'future-extension': { custom: true } }, 'other').length, 0);
  assert.equal(applySkillAction('# No frontmatter\n', {
    type: 'updateSkill', profile: 'claude-code', body: '# Edited without frontmatter\n'
  }), '# Edited without frontmatter\n');
});

test('advanced frontmatter validates, preserves unknown fields and quotes scalar values across parsers', () => {
  const source = '---\nname: example\ndescription: Valid\n---\nBody\n';
  const result = applySkillAction(source, { type: 'updateSkill', profile: 'portable',
    fields: { metadata: { enabled: 'on', version: '1.0' }, compatibility: 'on' } }, 'example');
  assert.equal(parseSkill(result).metadata['compatibility'], 'on');
  assert.ok(result.includes('"on"'));
  const existing = applySkillAction(source.replace('description: Valid', 'description: Valid\ncompatibility: git'), {
    type: 'updateSkill', profile: 'portable', fields: { compatibility: 'on' }
  }, 'example');
  assert.ok(existing.includes('compatibility: "on"'));
  const advanced = applySkillAction(source, { type: 'updateSkill', profile: 'devin',
    frontmatter: 'name: example\ndescription: Valid\ntriggers: [user]\npermissions:\n  ask: [Exec]\n' }, 'example');
  assert.deepEqual(parseSkill(advanced).metadata['triggers'], ['user']);
  assert.throws(() => applySkillAction(source, { type: 'updateSkill', profile: 'portable',
    fields: { description: '' } }, 'example'));
});

test('rich mode declines unsupported syntax instead of dropping it; body guidance is advisory', () => {
  for (const markdown of [
    '<!-- keep my comment -->\n# Title', '[reference]: https://example.com\n',
    '| A | B |\n|---|---|\n| C | D |', '- [ ] Task', '![Image](https://example.com/image.png)'
  ]) assert.ok(richMarkdownIssue(markdown));
  assert.equal(richMarkdownIssue('# Title\n\n**Bold** and *italic*.\n\n- First\n- Second\n\n```js\n---\n```\n'), undefined);
  assert.equal(richMarkdownIssue('```md\n[ref]: https://example.com\n<!-- code comment -->\n```\n'), undefined);
  const parsed = parseSkill('---\nname: example\ndescription: Valid\n---\n' + 'line\n'.repeat(501));
  assert.ok(validateSkill(parsed, 'portable', 'example').some(i => i.code === 'body-length' && i.severity === 'warning'));
});

test('repository skill opens without imposing a fixed section template', () => {
  const source = readFileSync(new URL('../../../tools/gsf/green-code-skill/SKILL.md', import.meta.url), 'utf8');
  const parsed = parseSkill(source);
  assert.ok(parsed.body.includes('## When to activate'));
  assert.equal(validateSkill(parsed, 'portable', 'green-code-skill').filter(i => i.severity === 'error').length, 0);
});
