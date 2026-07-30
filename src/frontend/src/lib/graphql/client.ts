import { ApolloClient, InMemoryCache, ApolloLink } from '@apollo/client/core';
import UploadHttpLink from 'apollo-upload-client/UploadHttpLink.mjs';
import { Api } from '#consts/backend';

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

const uploadLink = new UploadHttpLink({
  uri: `${Api.BASE}/graphql/`,
  credentials: 'include',
  fetch
});

export const client = new ApolloClient({
  link: authLink.concat(uploadLink),
  cache: new InMemoryCache()
});

export function getAuthHeadersForClient(): Record<string, string> {
  return getAuthHeaders();
}
