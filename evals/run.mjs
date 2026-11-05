import { execFileSync } from 'node:child_process';
import {
  closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync,
  renameSync, rmSync, writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { providers, invoke, prepareWorkspace } from './adapters.mjs';
import { extractJson, grade } from './grading.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const suite = JSON.parse(readFileSync(join(root, 'evals', 'evals.json'), 'utf8'));
const skill = join(root, 'tools', 'gsf', suite.skill_name);

export function makePlan(repetitions = 1, selected = providers) {
  if (!Number.isInteger(repetitions) || repetitions < 1) {
    throw new Error('Repetitions must be a positive integer');
  }
  if (selected.length === 0 || new Set(selected).size !== selected.length ||
    selected.some((provider) => !providers.includes(provider))) {
    throw new Error('Select unique known providers');
  }
  const plan = [];
  for (let trial = 0; trial < repetitions; trial++) {
    for (const provider of selected) {
      for (const entry of suite.evals) {
        const arms = trial % 2 === 0 ? ['without_skill', 'with_skill'] : ['with_skill', 'without_skill'];
        for (const arm of arms) plan.push({ trial, provider, case_id: entry.id, arm });
      }
    }
  }
  if (plan.length > 50) throw new Error('Plan exceeds the 50 CLI invocation ceiling');
  return plan;
}

export function requireLiveConsent(args) {
  if (!args.includes('--account-limits-confirmed')) {
    throw new Error('Live evaluation requires confirmed account-side $10 / 50 model-request limits');
  }
}

export function promptFor(entry, arm) {
  if (arm === 'without_skill') return entry.prompt;
  const paths = ['SKILL.md', ...entry.references.map((file) => `references/${file}`)];
  const context = paths.map((path) => `--- ${path} ---\n${readFileSync(join(skill, path), 'utf8')}`).join('\n\n');
  return `Apply the following skill and supplied reference material to the task. ` +
    `No tools or additional files are needed.\n\n${context}\n\nTASK:\n${entry.prompt}`;
}

function save(path, value) {
  writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 2) + '\n');
  renameSync(`${path}.tmp`, path);
}

export function summarize(records) {
  return providers.flatMap((provider) => ['without_skill', 'with_skill'].map((arm) => {
    const group = records.filter((row) => row.provider === provider && row.arm === arm);
    const responses = group.filter((row) => row.exit_code === 0);
    const latencies = responses.map((row) => row.duration_ms).toSorted((a, b) => a - b);
    const middle = Math.floor(latencies.length / 2);
    return {
      provider, arm, trials: group.length,
      completed_responses: responses.length,
      passed: group.filter((row) => row.grading?.passed).length,
      errors: group.filter((row) => row.error).length,
      pass_rate: responses.length ? responses.filter((row) => row.grading?.passed).length / responses.length : null,
      median_duration_ms: !responses.length ? null : latencies.length % 2 ?
        latencies[middle] : (latencies[middle - 1] + latencies[middle]) / 2,
    };
  }));
}

function main() {
  const args = process.argv.slice(2);
  const valid = new Set(['--live', '--account-limits-confirmed', '--repetitions', '--providers']);
  for (let i = 0; i < args.length; i++) {
    if (!valid.has(args[i])) throw new Error(`Unknown argument: ${args[i]}`);
    if (args[i] === '--repetitions' || args[i] === '--providers') i++;
  }
  const repetitionsAt = args.indexOf('--repetitions');
  const providersAt = args.indexOf('--providers');
  const plan = makePlan(repetitionsAt < 0 ? 1 : Number(args[repetitionsAt + 1]),
    providersAt < 0 ? providers : args[providersAt + 1]?.split(',') ?? []);
  if (!args.includes('--live')) {
    console.log(JSON.stringify({ mode: 'plan-only', cli_invocations: plan.length,
      model_requests: 'not bounded by CLI invocation count; account-side limit required',
      maximum_usd: 10, plan }, null, 2));
    return;
  }
  requireLiveConsent(args);
  const out = join(root, 'evaluation-results');
  mkdirSync(out, { recursive: true });
  const lock = join(out, 'budget.lock');
  const fd = openSync(lock, 'wx');
  try {
    const ledgerPath = join(out, 'budget.json');
    const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) :
      { cli_invocations_reserved: 0 };
    if (!Number.isInteger(ledger.cli_invocations_reserved) || ledger.cli_invocations_reserved < 0 ||
      ledger.cli_invocations_reserved + plan.length > 50) {
      throw new Error('Cumulative CLI invocation budget would exceed 50; no calls made');
    }
    const id = new Date().toISOString().replaceAll(':', '-');
    const directory = join(out, id);
    mkdirSync(directory);
    const records = [];
    const versions = Object.fromEntries(providers.filter((p) => plan.some((row) => row.provider === p))
      .map((provider) => [provider, execFileSync(provider === 'kiro' ? 'kiro-cli' : provider,
        ['--version'], { encoding: 'utf8', timeout: 15_000 }).trim()]));
    const report = {
      mode: 'live-inline-context', status: 'running', started_at: new Date().toISOString(),
      revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
      versions, model_selection: 'CLI defaults; model identity must be checked in raw output',
      account_limits_confirmed: true, maximum_usd: 10, maximum_model_requests: 50,
      billed_usd: null, tokens: null, energy_kwh: null,
      isolation: 'Fresh temporary cwd per invocation; user profiles and organization policy remain shared',
      limitations: ['Not native skill discovery or plugin activation testing',
        'Mechanical assertions require human semantic review',
        'CLI invocation counts do not measure internal model requests'],
      plan, records,
    };
    const reportPath = join(directory, 'report.json');
    save(reportPath, report);
    for (const row of plan) {
      const entry = suite.evals.find((entry) => entry.id === row.case_id);
      const prompt = promptFor(entry, row.arm);
      const cwd = mkdtempSync(join(tmpdir(), 'gsf-skill-eval-'));
      let result;
      try {
        prepareWorkspace(cwd);
        ledger.cli_invocations_reserved++;
        save(ledgerPath, ledger);
        result = invoke(row.provider, prompt, cwd);
      } finally {
        rmSync(cwd, { recursive: true });
      }
      const record = { ...row, ...result,
        prompt_sha256: createHash('sha256').update(prompt).digest('hex'), grading: null };
      if (!record.error) {
        try {
          record.grading = grade(entry.grader, extractJson(result.stdout));
        } catch (error) {
          record.error = `Output grading failed: ${error.message}`;
        }
      }
      records.push(record);
      report.summary = summarize(records);
      save(reportPath, report);
      console.log(`${row.provider} ${row.case_id} ${row.arm}: ` +
        `${record.error ? record.error : record.grading.passed ? 'PASS' : 'FAIL'} (${record.duration_ms}ms)`);
      if (result.error) {
        report.status = 'transport-blocked';
        report.finished_at = new Date().toISOString();
        save(reportPath, report);
        throw new Error(`${row.provider} transport failed; stopped to avoid wasting budget. See ${reportPath}`);
      }
    }
    report.finished_at = new Date().toISOString();
    report.status = records.some((record) => record.error || !record.grading?.passed) ? 'failed' : 'completed';
    save(reportPath, report);
    console.log(`Report: ${reportPath}`);
    if (records.some((record) => record.error || !record.grading?.passed)) process.exitCode = 1;
  } finally {
    closeSync(fd);
    rmSync(lock);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
