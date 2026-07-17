import { createAuthClient } from 'better-auth/react'

// baseURL is the api origin; the client auto-appends the default basePath
// (/api/auth), so requests hit <api>/api/auth/*. credentials:'include' sends the
// session cookie cross-origin (dashboard and api are same-site, so it's accepted).
export const authClient = createAuthClient({
	baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3310',
	fetchOptions: {
		credentials: 'include'
	}
})

export const { signIn, signOut, signUp, useSession } = authClient
