import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseEvals, applyAction } from '../src/model.ts';

const sample = {
  skill_name: 'example', extra: { preserve: true },
  evals: [
    { id: 1, prompt: 'First prompt', expected_output: 'Success', expectations: ['Works'],
      files: [], custom: { weight: 2 } },
    { id: 3, name: 'third', prompt: 'Third prompt', expected_output: 'Third result' }
  ]
};
const text = JSON.stringify(sample, null, 2) + '\n';

test('loads the actual forty-case repository fixture', () => {
  const fixture = readFileSync(new URL('./fixtures/evals.json', import.meta.url), 'utf8');
  const parsed = parseEvals(fixture);
  assert.equal(parsed.evals.length, 40);
  assert.equal(parsed.skill_name, 'green-code-skill');
});

test('rejects malformed, ambiguous and structurally unsupported JSON without replacing it', () => {
  for (const invalid of [
    '{', text.replace('"example"', '"example",'), '// comment\n' + text,
    '{"skill_name":"a","skill_name":"b","evals":[]}',
    '{"skill_name":"a","evals":[{"id":1,"id":2,"prompt":"p","expected_output":"e"}]}',
    '{"skill_name":"a","evals":{}}',
    '{"skill_name":"a","evals":[{"id":"1","prompt":"p","expected_output":"e"}]}',
    '{"skill_name":"a","evals":[{"id":1,"prompt":"p","expected_output":"e","files":[3]}]}',
    JSON.stringify({ ...sample, evals: [sample.evals[0], sample.evals[0]] })
  ]) assert.throws(() => parseEvals(invalid), Error);
});

test('patches multiline text and arrays without losing unknown fields or unrelated formatting', () => {
  const changed = applyAction(text, {
    type: 'updateCase', index: 0,
    fields: { prompt: 'Quotes "work"\nNew line\\path', expectations: ['One\nTwo', '[auto] Three'] }
  });
  const parsed = parseEvals(changed);
  assert.equal(parsed.evals[0]?.prompt, 'Quotes "work"\nNew line\\path');
  assert.deepEqual(parsed.extra, sample.extra);
  assert.deepEqual(parsed.evals[0]?.custom, { weight: 2 });
  assert.ok(changed.endsWith('\n'));
  const tail = text.slice(text.indexOf('    {\n      "id": 3'));
  assert.ok(changed.endsWith(tail));
});

test('preserves tabs, CRLF and absent optional fields on unrelated edits', () => {
  const original = JSON.stringify(sample, null, '\t').replaceAll('\n', '\r\n') + '\r\n';
  const changed = applyAction(original, { type: 'updateCase', index: 1, fields: { prompt: 'Changed' } });
  assert.ok(changed.includes('\r\n\t\t\t"prompt": "Changed"'));
  assert.ok(!('files' in parseEvals(changed).evals[1]!));
  assert.ok(!('expectations' in parseEvals(changed).evals[1]!));
});

test('adds and duplicates with collision-free IDs while retaining duplicate custom fields', () => {
  const added = applyAction(text, { type: 'addCase' });
  assert.equal(parseEvals(added).evals.at(-1)?.id, 4);
  const duplicated = parseEvals(applyAction(text, { type: 'duplicateCase', index: 0 }));
  assert.equal(duplicated.evals[1]?.id, 4);
  assert.deepEqual(duplicated.evals[1]?.custom, { weight: 2 });
  assert.equal(duplicated.evals[1]?.prompt, sample.evals[0]?.prompt);
});

test('reorders and removes by index without changing case IDs', () => {
  const moved = applyAction(text, { type: 'moveCase', index: 0, direction: 1 });
  assert.deepEqual(parseEvals(moved).evals.map(e => e.id), [3, 1]);
  const removed = applyAction(moved, { type: 'deleteCase', index: 0 });
  assert.deepEqual(parseEvals(removed).evals.map(e => e.id), [1]);
  assert.throws(() => applyAction(text, { type: 'moveCase', index: 0, direction: -1 }));
});

test('updates optional metadata and validates editable fields at the host boundary', () => {
  const updated = parseEvals(applyAction(text, {
    type: 'updateMetadata', fields: { description: 'Long\nDescription', skill_version: '2.0' }
  }));
  assert.equal(updated.description, 'Long\nDescription');
  for (const action of [
    { type: 'updateCase', index: 0, fields: { id: 3 } },
    { type: 'updateCase', index: 0, fields: { id: 1.5 } },
    { type: 'updateCase', index: 0, fields: { prompt: ' ' } },
    { type: 'updateCase', index: 0, fields: { expectations: [5] } },
    { type: 'updateCase', index: 0, fields: { custom: false } },
    { type: 'updateCase', index: -1, fields: { prompt: 'No' } },
    { type: 'updateCase', index: 99, fields: { prompt: 'No' } },
    { type: 'updateMetadata', fields: { evals: [] } },
    { type: 'updateMetadata', fields: { skill_name: '' } },
    { type: 'deleteCase', index: '0' },
    { type: 'moveCase', index: 0, direction: 2 },
    { type: 'notAnAction' }, null
  ]) assert.throws(() => applyAction(text, action), Error);
});

test('allows incomplete existing strings to be repaired but not new blank required values', () => {
  const incomplete = JSON.stringify({ skill_name: '', evals: [
    { id: 0, prompt: '', expected_output: '' }
  ] });
  assert.equal(parseEvals(incomplete).evals.length, 1);
  assert.equal(parseEvals(applyAction(incomplete, {
    type: 'updateCase', index: 0, fields: { prompt: 'Fixed', expected_output: 'Done' }
  })).evals[0]?.prompt, 'Fixed');
});
