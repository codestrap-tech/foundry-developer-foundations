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
		build.onResolve({ filter: /^react$/ }, () => ({ path: require.resolve('preact/compat') }));
		build.onResolve({ filter: /^react-dom$/ }, () => ({ path: require.resolve('preact/compat') }));
		build.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: require.resolve('preact/jsx-runtime') }));
	},
};

const commonConfig = {
	bundle: true,
	format: 'iife',
	jsx: 'automatic',
	jsxImportSource: 'preact',
	platform: 'browser',
	target: ['es2020'],
	sourcemap: true,
	define: { 'process.env.NODE_ENV': '"development"' },
	loader: { '.png': 'file', '.svg': 'file', '.css': 'css' },
	plugins: [aliasPlugin]
};

const mainConfig = {
	...commonConfig,
	entryPoints: [path.join(projectRoot, 'webview', 'src', 'main.tsx')],
	outfile: path.join(projectRoot, 'media', 'webview.js'),
};

const editorConfig = {
	...commonConfig,
	entryPoints: [path.join(projectRoot, 'webview', 'src', 'editor-main.tsx')],
	outfile: path.join(projectRoot, 'media', 'editor-webview.js'),
};

if (watch) {
	const mainCtx = await esbuild.context(mainConfig);
	await mainCtx.watch();
	const editorCtx = await esbuild.context(editorConfig);
	await editorCtx.watch();
	console.log('Watching webview and editor…');
} else {
	await esbuild.build(mainConfig);
	await esbuild.build(editorConfig);
	console.log('Built webview and editor');
} 