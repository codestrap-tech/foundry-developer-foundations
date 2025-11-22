import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const watch = process.argv.includes('--watch');
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');

/** Simple alias plugin for esbuild */
const aliasPlugin = {
  name: 'alias-preact-compat',
  setup(build) {
    build.onResolve({ filter: /^react$/ }, () => ({
      path: require.resolve('preact/compat'),
    }));
    build.onResolve({ filter: /^react-dom$/ }, () => ({
      path: require.resolve('preact/compat'),
    }));
    build.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({
      path: require.resolve('preact/jsx-runtime'),
    }));
  },
};

const common = {
  entryPoints: [path.join(projectRoot, 'webview', 'src', 'main.tsx')],
  bundle: true,
  format: 'iife',
  outfile: path.join(projectRoot, 'media', 'webview.js'),
  jsx: 'automatic',
  jsxImportSource: 'preact',
  platform: 'browser',
  target: ['es2020'],
  sourcemap: true,
  define: { 'process.env.NODE_ENV': '"development"' },
  loader: { '.png': 'file', '.svg': 'file', '.css': 'css' },
  plugins: [aliasPlugin],
};

if (watch) {
  const ctx = await esbuild.context(common);
  await ctx.watch();
  console.log('Watching webview…');
} else {
  await esbuild.build(common);
  console.log('Built webview');
}
