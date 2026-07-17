import axios, { type AxiosError, type AxiosRequestConfig } from 'axios'

// calls the api directly on its own origin. withCredentials sends the better-auth
// session cookie cross-origin — works because the dashboard and api are same-site
// (localhost in dev, shared parent domain in prod), so the lax cookie is sent.
// controllers return raw payloads, so we unwrap to response.data.
const instance = axios.create({
	baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3310',
	withCredentials: true
})

export const customInstance = <T>(config: AxiosRequestConfig, options?: AxiosRequestConfig): Promise<T> => {
	const source = axios.CancelToken.source()

	const promise = instance({
		...config,
		...options,
		cancelToken: source.token
	}).then(({ data }) => data as T)

	// orval calls promise.cancel() to abort in-flight requests (e.g. on unmount)
	;(promise as Promise<T> & { cancel?: () => void }).cancel = () => {
		source.cancel('Query was cancelled')
	}

	return promise
}

export type ErrorType<Error> = AxiosError<Error>
export type BodyType<BodyData> = BodyData
