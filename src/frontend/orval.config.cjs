module.exports = {
	backend: {
		output: {
			mode: 'tags-split',
			target: './src/lib/api/generated/backend.ts',
			client: 'svelte-query',
			baseUrl: 'http://127.0.0.1:8000/',
			override: {
				mutator: {
					path: './src/lib/api/custom-fetch.ts',
					name: 'customFetch'
				}
			}
		},
		input: {
			target: 'http://127.0.0.1:8000/openapi.json'
		}
	}
};
