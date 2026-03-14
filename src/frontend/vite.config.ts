import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const buildInfoPath = path.resolve('./build-info.json');
let buildInfo = { version: 'v0.0.0', commit: 'unknown' };

if (fs.existsSync(buildInfoPath)) {
	buildInfo = JSON.parse(fs.readFileSync(buildInfoPath, 'utf-8'));
}

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(buildInfo.version),
		__COMMIT_SHA__: JSON.stringify(buildInfo.commit)
	},
	plugins: [tailwindcss(), sveltekit()],
	worker: {
		format: 'es'
	},
	build: {
		sourcemap: true,
		rolldownOptions: {
			output: {
				minify: true
			}
		}
	},

	test: {
		expect: { requireAssertions: true },

		projects: [
			{
				extends: './vite.config.ts',

				test: {
					name: 'client',

					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},

					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',

				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
