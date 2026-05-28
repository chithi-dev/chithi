const GRAPHQL_URL = `${import.meta.env.VITE_API_BASE ?? ''}/graphql`;

interface GraphQLResponse<T = unknown> {
	data?: T;
	errors?: Array<{ message: string; path?: string[] }>;
}

export async function gqlFetch<T>(query: string, variables?: Record<string, unknown>): Promise<NonNullable<T>> {
	const res = await fetch(GRAPHQL_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify({ query, variables }),
	});

	if (!res.ok) {
		throw new Error(`GraphQL request failed with status ${res.status}`);
	}

	const json: GraphQLResponse<T> = await res.json();

	if (json.errors?.length) {
		throw new Error(json.errors.map((e) => e.message).join('; '));
	}

	if (!json.data) {
		throw new Error('No data in response');
	}

	return json.data as NonNullable<T>;
}
