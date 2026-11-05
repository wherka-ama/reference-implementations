import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractJson, grade } from './grading.mjs';
import { commandFor, invoke, prepareWorkspace } from './adapters.mjs';
import { makePlan, promptFor, requireLiveConsent, summarize } from './run.mjs';

test('SCI grader rejects wrong arithmetic, missing boundaries, and missing units', () => {
  const good = { sci_gco2e_per_request: 0.7, unit: 'gCO2e/request',
    calculation: '(0.2 * 300 + 10) / 100', limitations: ['Inputs are estimates.'] };
  assert.equal(grade('sci', good).passed, true);
  for (const change of [{ sci_gco2e_per_request: 70 }, { sci_gco2e_per_request: '0.7' },
    { unit: 'gCO2e' }, { limitations: [] }]) {
    assert.equal(grade('sci', { ...good, ...change }).passed, false);
  }
});

test('honesty grader rejects fabricated savings or an empty measurement plan', () => {
  const good = { guaranteed_reduction_percent: null, reason: 'No baseline.',
    measurement_plan: ['Measure the baseline.', 'Measure cache overhead and compare.'] };
  assert.equal(grade('honesty', good).passed, true);
  assert.equal(grade('honesty', { ...good, guaranteed_reduction_percent: 80 }).passed, false);
  assert.equal(grade('honesty', { ...good, measurement_plan: [] }).passed, false);
});

test('review grader rejects duplicated, malformed findings and invented measurements', () => {
  const finding = { pattern: 'Deduplicate', evidence: 'IDs repeat.', trade_off: 'Cache freshness.' };
  const good = { findings: [finding, { ...finding, pattern: 'Bound concurrency' }],
    measured_savings_percent: null };
  assert.equal(grade('review', good).passed, true);
  assert.equal(grade('review', { ...good, findings: [finding, finding] }).passed, false);
  assert.equal(grade('review', { ...good, findings: [null, finding] }).passed, false);
  assert.equal(grade('review', { ...good, measured_savings_percent: 50 }).passed, false);
});

test('transport wrapper is normalized but malformed JSON is not accepted', () => {
  assert.deepEqual(extractJson('\x1b[32mAnswer:\x1b[0m\n```json\n{"ok":true}\n```'), { ok: true });
  assert.throws(() => extractJson('not JSON'), SyntaxError);
});

test('matrix pairs identical tasks, balances repeated order, and bounds invocation count', () => {
  assert.equal(makePlan().length, 18);
  assert.equal(makePlan(2).length, 36);
  assert.equal(makePlan(2)[18].arm, 'with_skill');
  assert.equal(makePlan(8, ['copilot']).length, 48);
  assert.throws(() => makePlan(9, ['copilot']), /50 CLI/);
  assert.throws(() => makePlan(3), /50 CLI/);
  assert.throws(() => makePlan(0), /positive integer/);
  assert.throws(() => makePlan(1, ['unknown']), /known providers/);
  assert.throws(() => requireLiveConsent([]), /account-side/);
  assert.doesNotThrow(() => requireLiveConsent(['--account-limits-confirmed']));
});

test('skill context is supplied only to the treatment arm', () => {
  const entry = { prompt: 'Public task', references: ['sci-formula.md'] };
  assert.equal(promptFor(entry, 'without_skill'), entry.prompt);
  assert.ok(promptFor(entry, 'with_skill').endsWith(`TASK:\n${entry.prompt}`));
  assert.ok(promptFor(entry, 'with_skill').includes('--- references/sci-formula.md ---'));
});

test('CLI adapters are noninteractive and surface process failures without network calls', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gsf-adapter-test-'));
  try {
    prepareWorkspace(dir);
    const config = JSON.parse(readFileSync(join(dir, '.kiro/agents/gsf-eval.json'), 'utf8'));
    assert.deepEqual(config.tools, []);
    for (const provider of ['copilot', 'devin', 'kiro']) {
      const [, args] = commandFor(provider, 'public prompt', dir);
      assert.ok(args.includes('public prompt'));
      assert.ok(!args.includes('--allow-all') && !args.includes('--trust-all-tools'));
      const result = invoke(provider, 'public prompt', dir, null, () =>
        ({ status: 1, stdout: '', stderr: 'Authentication required', signal: null }));
      assert.match(result.error, /CLI failed/);
      assert.equal(result.stderr, 'Authentication required');
    }
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('empty providers report unknown metrics, not invented zero latency or success', () => {
  const summary = summarize([{ provider: 'copilot', arm: 'with_skill',
    exit_code: 0, duration_ms: 10, grading: { passed: false }, error: null },
  { provider: 'copilot', arm: 'with_skill', exit_code: 0,
    duration_ms: 20, grading: { passed: false }, error: null },
  { provider: 'kiro', arm: 'without_skill', exit_code: 1,
    duration_ms: 5, grading: null, error: 'Not logged in' }]);
  assert.equal(summary.find((row) => row.provider === 'copilot' && row.arm === 'with_skill').pass_rate, 0);
  assert.equal(summary.find((row) => row.provider === 'copilot' && row.arm === 'with_skill').median_duration_ms, 15);
  assert.equal(summary.find((row) => row.provider === 'devin').pass_rate, null);
  assert.equal(summary.find((row) => row.provider === 'devin').median_duration_ms, null);
  assert.equal(summary.find((row) => row.provider === 'kiro' && row.arm === 'without_skill').pass_rate, null);
  assert.equal(summary.find((row) => row.provider === 'kiro' && row.arm === 'without_skill').median_duration_ms, null);
});
