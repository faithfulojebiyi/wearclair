import { Platform } from 'react-native';

// web-only bearer token, held in MEMORY for the lifetime of the page. the durable
// web auth path is the browser cookie jar (axios withCredentials + the api's
// credentialed CORS allowlist) — the in-memory token only bridges the sign-in
// response until the cookie lands. session tokens for health data don't belong in
// localStorage, where any script on the page can read them. on native the
// better-auth expo plugin persists the session in SecureStore, so this is a no-op.
const LEGACY_KEY = 'wearclair.session_token';

let sessionToken: string | null = null;

// one-time cleanup of tokens persisted by earlier builds
if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
  localStorage.removeItem(LEGACY_KEY);
}

export const setToken = (token: string | null): void => {
  if (Platform.OS !== 'web') {
    return;
  }

  sessionToken = token;
};

export const getToken = (): string | null =>
  Platform.OS === 'web' ? sessionToken : null;
