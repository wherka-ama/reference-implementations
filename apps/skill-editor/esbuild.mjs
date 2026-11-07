import { build } from 'esbuild';

await Promise.all([
  build({ entryPoints: ['src/extension.ts'], bundle: true, platform: 'node',
    format: 'cjs', mainFields: ['module', 'main'], target: 'node20',
    external: ['vscode'], outfile: 'dist/extension.cjs' }),
  build({ entryPoints: ['src/webview.ts'], bundle: true, platform: 'browser',
    outfile: 'dist/webview.js' })
]);
