import { build } from 'esbuild';
import { runTests } from '@vscode/test-electron';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

await build({
  entryPoints: ['tests/extension-host.ts'], bundle: true, platform: 'node',
  format: 'cjs', mainFields: ['module', 'main'], target: 'node20',
  external: ['vscode'], outfile: 'dist/extension-host.cjs'
});
const temporary = await mkdtemp(join(tmpdir(), 'skill-editor-host-'));
try {
  await runTests({
    extensionDevelopmentPath: resolve('.'),
    extensionTestsPath: resolve('dist/extension-host.cjs'),
    ...(process.env.VSCODE_EXECUTABLE_PATH
      ? { vscodeExecutablePath: process.env.VSCODE_EXECUTABLE_PATH }
      : { version: '1.96.4' }),
    launchArgs: [
      '--disable-extensions', '--disable-gpu', '--skip-welcome', '--skip-release-notes',
      '--user-data-dir', join(temporary, 'user-data'),
      '--extensions-dir', join(temporary, 'extensions')
    ],
    extensionTestsEnv: { SKILL_EDITOR_TEST_DIR: temporary }
  });
} finally {
  await rm(temporary, { recursive: true, force: true });
}
