import type { DocumentNode } from 'graphql';
import { client } from './client.js';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface QueryState<Data = any> {
	data: Data | undefined;
	error: string | undefined;
	fetching: boolean;
	stale: boolean;
}

export interface QueryStateWithData<Data = any> extends QueryState<Data> {
	data: NonNullable<QueryState<Data>['data']>;
}

// ─── Query Helper ──────────────────────────────────────────────────────────────

type QueryVariables = Record<string, any> | (() => Record<string, any>);

/**
 * Create a reactive query state backed by an Apollo watchQuery.
 *
 * `variables` may be a plain object or a **getter** (e.g.
 * `() => ({ page: currentPage })` where `currentPage` is `$state`). Passing a
 * getter keeps the reference to the reactive value inside a closure, which is
 * the fix Svelte's `state_referenced_locally` diagnostic points at. The getter
 * is invoked inside the `$effect`, so every signal it reads is tracked and the
 * query re-subscribes with fresh variables whenever any of them change — instead
 * of being locked to the value captured at mount time.
 *
 * The subscription is cleaned up when the component is destroyed (via $effect cleanup).
 */
export function createQueryStore<Data>(query: DocumentNode, variables: QueryVariables = {}) {
	let state = $state<QueryState<Data>>({
		data: undefined,
		error: undefined,
		fetching: true,
		stale: false
	});

	$effect(() => {
		// Resolve the variables here (inside reactive scope) so any signals read
		// by the getter are tracked and the effect re-runs when they change.
		const current = typeof variables === 'function' ? variables() : variables;

		const observable = client.watchQuery<Data>({ query, variables: current });
		const subscription = observable.subscribe({
			next(result) {
				state.fetching = result.loading;
				state.stale = false;
				state.data = result.data as Data | undefined;
				state.error = result.error?.message ?? undefined;
			},
			error(err) {
				state.fetching = false;
				state.error = err.message;
			}
		});

		return () => {
			subscription.unsubscribe();
		};
	});

	return state;
}

// ─── Mutation Helper ───────────────────────────────────────────────────────────

/**
 * Execute a GraphQL mutation and return its result.
 * Returns a promise that resolves to the mutation result.
 */
export async function executeMutation<Data = any>(
	mutation: DocumentNode,
	variables: Record<string, any> = {}
) {
	return await client.mutate<Data>({ mutation, variables });
}
