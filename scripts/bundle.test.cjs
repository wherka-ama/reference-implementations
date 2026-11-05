const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { createHash } = require('node:crypto');

test('release bundle contains the complete unchanged skill and no unrelated projects', () => {
  const zip = 'dist/green-code/green-code.bundle.zip';
  const entries = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).trim().split('\n');
  const files = execFileSync('git', [
    'ls-tree', '-r', '--name-only', 'HEAD', '--', 'tools/gsf/green-code-skill/',
  ], { encoding: 'utf8' }).trim().split('\n');
  assert.ok(files.length > 0);
  assert.deepEqual(entries.toSorted(), [
    ...files, 'LICENSE', 'README.md', 'deployment-manifest.yml',
    'metadata/source/collections/green-code.collection.yml',
  ].toSorted());
  const manifest = readFileSync('dist/green-code/deployment-manifest.yml');
  assert.deepEqual(execFileSync('unzip', ['-p', zip, 'deployment-manifest.yml']), manifest);
  for (const file of files) {
    const bytes = execFileSync('unzip', ['-p', zip, file]);
    assert.deepEqual(bytes, execFileSync('git', ['show', `HEAD:${file}`]));
    const digest = createHash('sha256').update(bytes).digest('hex');
    assert.ok(manifest.toString().includes(`sha256: sha256:${digest}`), file);
  }
});
