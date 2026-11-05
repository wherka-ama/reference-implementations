import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validatePlugin } from './validate-plugin.mjs';

const schema = JSON.parse(readFileSync('.cache/plugin.schema.json', 'utf8'));

function fixture(run) {
  const dir = mkdtempSync(join(tmpdir(), 'gsf-plugin-test-'));
  try {
    cpSync('green-software', join(dir, 'plugin'), { recursive: true });
    run(join(dir, 'plugin'));
  } finally {
    rmSync(dir, { recursive: true });
  }
}

test('complete self-contained plugin validates against the official schema', () => {
  assert.deepEqual(validatePlugin('green-software', schema).skills, ['green-code-skill']);
});

test('legacy string author is rejected', () => fixture((root) => {
  const path = join(root, 'plugin.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  manifest.author = 'Not an author object';
  writeFileSync(path, JSON.stringify(manifest));
  assert.throws(() => validatePlugin(root, schema), /Invalid plugin manifest/);
}));

test('external symlink cannot enter a distributed plugin', () => fixture((root) => {
  symlinkSync(tmpdir(), join(root, 'outside'));
  assert.throws(() => validatePlugin(root, schema), /forbids symlinks/);
}));
