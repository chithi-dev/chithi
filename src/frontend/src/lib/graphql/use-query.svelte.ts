import type { DocumentNode } from 'graphql';
import { client } from './client.js';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface QueryState {
    data: undefined;
    error: string | undefined;
    fetching: boolean;
    stale: boolean;
}

export interface QueryStateWithData extends QueryState {
    data: NonNullable<QueryState['data']>;
}

// ─── Query Helper ──────────────────────────────────────────────────────────────

/**
 * Create a reactive query state backed by an Apollo watchQuery.
 * The subscription is cleaned up when the component is destroyed (via $effect cleanup).
 */
export function createQueryStore<Data>(query: DocumentNode, variables: Record<string, any> = {}) {
    let state = $state<QueryState>({
        data: undefined,
        error: undefined,
        fetching: true,
        stale: false
    });

    const observable = client.watchQuery<Data>({ query, variables });

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

    $effect(() => {
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
