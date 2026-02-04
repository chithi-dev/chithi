import type { Config } from '@sveltejs/kit';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

import auto from '@sveltejs/adapter-auto';
import node_adapter from '@sveltejs/adapter-node';
import static_adapter from '@sveltejs/adapter-static';

const is_static = process.env.BUILD_STATIC_ENV ?? false;
const is_node = process.env.BUILD_NODE_ENV ?? false;

export default {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	kit: {
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: is_static
			? static_adapter({
					fallback: 'app.html',
					// precompress: true,
					strict: true
				})
			: is_node
				? node_adapter({
						precompress: false
					})
				: auto(),
		alias: {
			'#workers/*': './src/lib/workers/*',
			'#functions/*': './src/lib/functions/*',
			'#logos/*': './src/lib/logos/*',
			'#vendor/*': './src/lib/vendor/*',
			'#queries/*': './src/lib/queries/*'
		}
	}
} satisfies Config;
