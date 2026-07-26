import { ApolloClient, HttpLink, InMemoryCache, ApolloLink } from '@apollo/client/core';

function getAuthHeaders(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

const authLink = new ApolloLink((operation, forward) => {
  operation.setContext({
    headers: getAuthHeaders()
  });
  return forward(operation);
});

const httpLink = new HttpLink({
  uri: '/graphql/',
  credentials: 'include',
  fetch
});

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache()
});

export function getAuthHeadersForClient(): Record<string, string> {
  return getAuthHeaders();
}
