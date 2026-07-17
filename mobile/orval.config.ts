import { defineConfig } from 'orval';

// reads the live OpenAPI spec from the running api (same pattern as dashboard/).
// generates a typed axios-functions client; all requests go through the custom
// mutator (api origin + better-auth session cookie from SecureStore).
const specUrl = `${process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3310'}/api-json`;

export default defineConfig({
  wearclair: {
    input: {
      target: specUrl,
    },
    output: {
      clean: true,
      client: 'axios-functions',
      mode: 'tags-split',
      override: {
        mutator: {
          name: 'customInstance',
          path: './src/api/mutator.ts',
        },
      },
      target: './src/api/generated',
    },
  },
});
