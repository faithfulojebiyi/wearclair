'use client'

import { useState } from 'react'

import { useRouter } from 'next/navigation'

import { toast } from '@wearclair-ui/primitives/toast/toast'

import { signIn } from './auth-client'

export type SignInValues = {
	email: string
	password: string
}

export const useSignIn = () => {
	const router = useRouter()
	const [isPending, setIsPending] = useState(false)

	const submit = async (values: SignInValues) => {
		setIsPending(true)

		// sign-in sets a fresh session cookie + populates the useSession store,
		// overwriting any stale cookie left over from a dev DB reset
		const { error } = await signIn.email(values)

		if (error) {
			setIsPending(false)
			toast.error(error.message ?? 'Could not sign in')

			return
		}

		router.replace('/')
	}

	return { isPending, submit }
}
