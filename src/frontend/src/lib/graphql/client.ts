import { createClient, cacheExchange, fetchExchange, type RequestPolicy } from '@urql/core';

function getAuthHeaders(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export const client = createClient({
  url: '/graphql/',
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: () => {
    return {
      headers: getAuthHeaders(),
      credentials: 'include' as RequestCredentials
    };
  }
});

export function getAuthHeadersForClient(): Record<string, string> {
  return getAuthHeaders();
}
