import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';

import { API_URL } from './config';
import { getToken, setToken } from './token';

// native: the expo plugin persists the session in SecureStore and getCookie() drives
// auth (see src/api/mutator.ts). web: browsers forbid a JS-set Cookie header, so we
// authenticate with a Bearer token — captured from the sign-in response's
// set-auth-token header (server bearer plugin), persisted in localStorage, and
// replayed on every request (including the client's own get-session).
export const authClient = createAuthClient({
  baseURL: API_URL,
  fetchOptions: {
    onRequest: (ctx) => {
      const token = getToken();

      if (token) {
        ctx.headers.set('Authorization', `Bearer ${token}`);
      }

      return ctx;
    },
    onSuccess: (ctx) => {
      // capture the session token as early as possible: sign-in returns it in the
      // body (`token`), get-session nests it (`session.token`), and both also send a
      // `set-auth-token` header. Any of them works as a Bearer token. Storing it here
      // — while useSession resolves — beats the data screens mounting, avoiding a
      // first-request 401 race.
      const data = ctx.data as
        | { token?: string; session?: { token?: string } }
        | undefined;
      const token =
        data?.session?.token ??
        data?.token ??
        ctx.response.headers.get('set-auth-token') ??
        null;

      if (token) {
        setToken(token);
      }
    },
  },
  plugins: [
    expoClient({
      scheme: 'wearclair',
      storagePrefix: 'wearclair',
      storage: SecureStore,
    }),
  ],
});

export const { signIn, signOut, signUp, useSession } = authClient;
