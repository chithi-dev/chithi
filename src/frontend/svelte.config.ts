import type { Config } from '@sveltejs/kit';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

import node_adapter from '@sveltejs/adapter-node';

export default {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	compilerOptions: {
		modernAst: true,
		experimental: {
			async: true
		}
	},
	preprocess: vitePreprocess(),
	kit: {
		paths: {
			base: ''
		},
		experimental: {
			remoteFunctions: true
		},
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: node_adapter({
			precompress: true
		}),
		alias: {
			'#workers/*': './src/lib/workers/*',
			'#functions/*': './src/lib/functions/*',
			'#logos/*': './src/lib/logos/*',
			'#queries/*': './src/lib/queries/*',
			'#markdown/*': './src/lib/markdown/*',
			'#consts/*': './src/lib/consts/*',
			'#css/*': './src/css/*'
		}
	}
} satisfies Config;
