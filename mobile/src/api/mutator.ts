import { create, type AxiosError, type AxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';

import { authClient } from '@/modules/auth/auth-client';
import { API_URL } from '@/config';
import { getToken } from '@/modules/auth/token';

// native has no browser cookie jar — the better-auth expo plugin keeps the session
// cookie in SecureStore, and we attach it to every api request explicitly (below).
// on web there IS a cookie jar: withCredentials sends the browser's better-auth
// cookie cross-origin (the api reflects localhost:8081 in its CORS allowlist with
// credentials enabled). controllers return raw payloads, so we unwrap to data.
const instance = create({ baseURL: API_URL, withCredentials: true });

instance.interceptors.request.use((config) => {
  // native: the Cookie header is the primary auth path (expo plugin). getCookie()
  // is native-only — calling it on web throws and would abort the request before it
  // ever hits the network, so it's guarded behind the platform check.
  if (Platform.OS !== 'web') {
    try {
      const cookie = authClient.getCookie();

      if (cookie) {
        config.headers.set('Cookie', cookie);
      }
    } catch {
      // no cookie available yet — the Bearer token below covers auth
    }
  }

  // web: authenticate with the persisted Bearer token (getToken() is null on native).
  const token = getToken();

  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }

  return config;
});

export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const controller = new AbortController();

  const promise = instance({
    ...config,
    ...options,
    signal: controller.signal,
  }).then(({ data }) => data as T);

  // orval calls promise.cancel() to abort in-flight requests (e.g. on unmount)
  (promise as Promise<T> & { cancel?: () => void }).cancel = () => {
    controller.abort('Query was cancelled');
  };

  return promise;
};

export type ErrorType<Error> = AxiosError<Error>;
export type BodyType<BodyData> = BodyData;
