import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';
import { execSync } from 'child_process';
import { defineConfig } from 'vitest/config';

function git(cmd: string) {
	return execSync(cmd).toString().trim();
}

const commit = git('git rev-parse --short HEAD');

const version = process.env.GITHUB_ACTIONS ? process.env.GITHUB_REF_NAME : `v0.0.0-${commit}`;

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(version),
		__COMMIT_SHA__: JSON.stringify(commit)
	},
	plugins: [tailwindcss(), sveltekit()],
	worker: {
		format: 'es'
	},
	build: {
		sourcemap: true,
		minify: 'terser'
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
