'use client'

import { useState } from 'react'

import { useRouter } from 'next/navigation'

import { toast } from '@wearclair-ui/primitives/toast/toast'

import { organization } from './auth-client'
import { slugWithSuffix } from './slug'

const MAX_SLUG_ATTEMPTS = 3

export const useCreateWorkspace = () => {
	const router = useRouter()
	const [isPending, setIsPending] = useState(false)

	const submit = async (name: string) => {
		setIsPending(true)

		// retry on the rare slug collision (suffix is re-randomised each attempt)
		for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
			const { data, error } = await organization.create({ name, slug: slugWithSuffix(name) })

			if (data) {
				const { error: setActiveError } = await organization.setActive({ organizationId: data.id })

				if (setActiveError) {
					setIsPending(false)
					toast.error(setActiveError.message ?? 'Could not activate your workspace')

					return
				}

				router.replace('/')

				return
			}

			const isSlugCollision = error?.code === 'SLUG_IS_TAKEN' || error?.status === 409

			if (!isSlugCollision || attempt === MAX_SLUG_ATTEMPTS - 1) {
				setIsPending(false)
				toast.error(error?.message ?? 'Could not create your workspace')

				return
			}
		}
	}

	return { isPending, submit }
}
