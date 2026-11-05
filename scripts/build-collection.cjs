const { execFileSync } = require('node:child_process');

const remote = process.env.GITHUB_REPOSITORY ||
  execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim()
    .replace(/^https:\/\/github\.com\//, '')
    .replace(/^git@github\.com:/, '')
    .replace(/\.git$/, '');
if (!/^[\w.-]+\/[\w.-]+$/.test(remote)) {
  throw new Error('Set GITHUB_REPOSITORY to the publishing GitHub owner/repository.');
}
execFileSync(process.execPath, [
  'node_modules/@prompt-registry/collection-scripts/bin/build-collection-bundle.js',
  '--collection-file', 'collections/green-code.collection.yml',
  '--version', '0.1.0',
  '--repo-slug', remote.replace('/', '-'),
], { stdio: 'inherit' });
