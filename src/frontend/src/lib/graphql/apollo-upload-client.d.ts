declare module 'apollo-upload-client/UploadHttpLink.mjs' {
  import { ApolloLink } from '@apollo/client/core';

  interface UploadHttpLinkOptions {
    uri?: string;
    credentials?: RequestCredentials;
    fetch?: typeof fetch;
    headers?: Record<string, string>;
  }

  export default class UploadHttpLink extends ApolloLink {
    constructor(options?: UploadHttpLinkOptions);
  }
}
