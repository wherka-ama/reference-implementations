import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const providers = ['copilot', 'devin', 'kiro'];

export function commandFor(provider, prompt, cwd, model) {
  const modelArgs = model ? ['--model', model] : [];
  if (provider === 'copilot') {
    return ['copilot', ['-p', prompt, '--silent', '--no-custom-instructions',
      '--disable-builtin-mcps', '--available-tools=', '--no-ask-user',
      '--no-auto-update', '--sync-session=off', ...modelArgs]];
  }
  if (provider === 'devin') {
    return ['devin', ['--config', join(cwd, 'devin.json'), '--permission-mode', 'auto',
      '--respect-workspace-trust', 'false', '--print', prompt, ...modelArgs]];
  }
  if (provider === 'kiro') {
    return ['kiro-cli', ['chat', '--no-interactive', '--agent', 'gsf-eval',
      '--trust-tools=', '--wrap', 'never', ...modelArgs, prompt]];
  }
  throw new Error(`Unknown provider: ${provider}`);
}

export function prepareWorkspace(cwd) {
  writeFileSync(join(cwd, 'devin.json'), JSON.stringify({
    auto_update: false,
    subagents_enabled: false,
    read_config_from: Object.fromEntries(
      ['agents_standard', 'cursor', 'windsurf', 'claude', 'copilot', 'opencode', 'zed']
        .map((source) => [source, false])),
    permissions: { deny: ['read', 'edit', 'grep', 'glob', 'exec', 'mcp__*', 'Fetch(*)'] },
  }));
  mkdirSync(join(cwd, '.kiro', 'agents'), { recursive: true });
  writeFileSync(join(cwd, '.kiro', 'agents', 'gsf-eval.json'), JSON.stringify({
    name: 'gsf-eval',
    description: 'Public-fixture output-quality evaluation, with no tools or resources.',
    prompt: 'Answer the supplied task directly. Do not use tools or read external context.',
    tools: [],
    allowedTools: [],
    resources: [],
    mcpServers: {},
    includeMcpJson: false,
  }));
}

export function invoke(provider, prompt, cwd, model, execute = spawnSync) {
  const [command, args] = commandFor(provider, prompt, cwd, model);
  const start = performance.now();
  const result = execute(command, args, {
    cwd, encoding: 'utf8', timeout: 120_000, maxBuffer: 2 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NO_COLOR: '1' },
  });
  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    duration_ms: Math.round(performance.now() - start),
    exit_code: result.status,
    error: result.error ? result.error.message :
      result.status === 0 ? null : `CLI failed (status ${result.status}, signal ${result.signal})`,
  };
}
