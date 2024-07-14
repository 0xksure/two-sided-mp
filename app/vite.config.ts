import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import inject from '@rollup/plugin-inject';
import nodePolyfills from 'rollup-plugin-node-polyfills';
import path from 'path';
import sass from 'rollup-plugin-sass';
import css from "rollup-plugin-import-css";






export default defineConfig(({ command, mode, ssrBuild }) => {
	if (command === 'serve') {
		return {
			plugins: [sveltekit(),
			nodePolyfills(),
			],
			optimizeDeps: {
				include: ['@solana / web3.js'],

				esbuildOptions: {
					target: 'esnext',
					plugins: [NodeGlobalsPolyfillPlugin({ buffer: true })]
				}
			},
			resolve: {
				alias: {
					$utils: path.resolve('src/utils/'),
					$static: path.resolve('static/'),
					stream: 'rollup-plugin-node-polyfills/polyfills/stream',
					crypto: 'crypto-browserify',
				}
			},
			build: {
				target: 'esnext',
				commonjsOptions: {
					transformMixedEsModules: true
				},
				rollupOptions: {
					plugins: [inject({ Buffer: ['buffer', 'Buffer'] }), nodePolyfills({ crypto: true })]
				}
			}
		}
	} else {
		// command === 'build'
		return {
			plugins: [
				sveltekit(),
				nodePolyfills(),
				sass(),
				css(),
			],
			optimizeDeps: {
				include: ['@solana/web3.js', '@solana/spl-token"'],
				esbuildOptions: {
					target: 'esnext',
					plugins: [NodeGlobalsPolyfillPlugin({ buffer: true })]
				}
			},
			resolve: {
				alias: {
					$utils: path.resolve('src/utils/'),
					$static: path.resolve('static/'),
					stream: 'rollup-plugin-node-polyfills/polyfills/stream',
					crypto: 'crypto-browserify',
				}
			},
			build: {
				target: 'esnext',
				commonjsOptions: {
					transformMixedEsModules: true
				},
				rollupOptions: {
					plugins: [inject({ Buffer: ['buffer', 'Buffer'] })]
				}
			}
		}
	}

});


