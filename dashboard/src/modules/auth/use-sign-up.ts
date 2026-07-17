'use client'

import { useState } from 'react'

import { useRouter } from 'next/navigation'

import { toast } from '@wearclair-ui/primitives/toast/toast'

import { signUp } from './auth-client'

export type SignUpValues = {
	name: string
	email: string
	password: string
}

export const useSignUp = () => {
	const router = useRouter()
	const [isPending, setIsPending] = useState(false)

	const submit = async (values: SignUpValues) => {
		setIsPending(true)

		// email/password sign-up signs the user in immediately (no verification
		// configured) — the response sets a fresh session cookie + populates the
		// useSession store, overwriting any stale cookie from a prior dev DB reset.
		const { error } = await signUp.email(values)

		setIsPending(false)

		if (error) {
			toast.error(error.message ?? 'Could not create your account')

			return
		}

		router.replace('/')
	}

	return { isPending, submit }
}
