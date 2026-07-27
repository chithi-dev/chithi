import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: 'http://localhost:8002/graphql/',
  documents: ['src/lib/graphql/queries.ts'],
  ignoreNoDocuments: true,
  generates: {
    'src/lib/graphql/generated/': {
      preset: 'client',
      presetConfig: {
        // Disable fragment masking - Apollo recommends this for simpler usage
        fragmentMasking: false
      },
      config: {
        // Apollo Client always includes __typename fields
        nonOptionalTypename: true,
        // Fix verbatimModuleSyntax compatibility
        strictScalars: false,
        maybeValue: 'T | null'
      }
    }
  }
};

export default config;
