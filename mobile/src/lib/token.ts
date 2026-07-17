import { Platform } from 'react-native';

// web-only bearer-token store. On native the better-auth expo plugin persists the
// session and getCookie() drives auth, so this is a no-op there. On web there is no
// usable cookie jar for cross-origin JS (the Cookie header is forbidden), so we
// capture the session token from the sign-in response and replay it as a Bearer
// header. localStorage survives reloads, so the web session persists too.
const KEY = 'wearclair.session_token';

export const setToken = (token: string | null): void => {
  if (Platform.OS !== 'web') {
    return;
  }

  if (token) {
    localStorage.setItem(KEY, token);
  } else {
    localStorage.removeItem(KEY);
  }
};

export const getToken = (): string | null =>
  Platform.OS === 'web' ? localStorage.getItem(KEY) : null;
