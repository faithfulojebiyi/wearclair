'use client'

import { type FormEvent, useEffect, useState } from 'react'

import { useRouter } from 'next/navigation'

import { Icons } from '@wearclair-ui/icons/base'
import { Center, VStack } from '@wearclair-ui/primitives/layout'
import { Text } from '@wearclair-ui/primitives/typography'

import { useSession } from '@/modules/auth/auth-client'
import { TextField } from '@/modules/auth/components/auth-fields'
import { AuthPanel } from '@/modules/auth/components/auth-panel'
import { AuthSubmit } from '@/modules/auth/components/auth-submit'
import { slugify } from '@/modules/auth/slug'
import { useCreateWorkspace } from '@/modules/auth/use-create-workspace'
import { resolveWorkspaceRoute } from '@/modules/auth/workspace-route'

export default function CreateWorkspacePage() {
	const router = useRouter()
	const { data: session, isPending: sessionPending } = useSession()
	const { isPending, submit } = useCreateWorkspace()
	const [isCheckingWorkspace, setIsCheckingWorkspace] = useState(true)
	const [name, setName] = useState('')

	// must be signed in to create a workspace; if one already exists, go to the app
	useEffect(() => {
		if (sessionPending) {
			return
		}

		let cancelled = false

		const resolveExistingWorkspace = async () => {
			setIsCheckingWorkspace(true)

			if (!session) {
				router.replace('/auth/sign-in')

				return
			}

			const next = await resolveWorkspaceRoute()

			if (cancelled) {
				return
			}

			if (next !== '/auth/create-workspace') {
				router.replace(next)

				return
			}

			setIsCheckingWorkspace(false)
		}

		resolveExistingWorkspace()

		return () => {
			cancelled = true
		}
	}, [session, sessionPending, router])

	if (sessionPending || !session || isCheckingWorkspace) {
		return (
			<Center h="full" w="full">
				<Icons.loading animation="loader" size={24} />
			</Center>
		)
	}

	const onSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		submit(name)
	}

	const slugPreview = slugify(name)

	return (
		<AuthPanel subtitle="Workspaces keep your data, catalog and members together." title="Create your workspace">
			<form onSubmit={onSubmit}>
				<VStack gap="4" w="full">
					<TextField
						autoFocus
						label="Workspace name"
						name="workspace"
						onChange={(e) => setName(e.target.value)}
						placeholder="Acme Inc"
						required
						value={name}
					/>

					{slugPreview && (
						<Text color="text.muted" fontSize="1" w="full">
							URL: wearclair.app/{slugPreview}
						</Text>
					)}

					<AuthSubmit isLoading={isPending} loadingText="Creating workspace">
						Create workspace
					</AuthSubmit>
				</VStack>
			</form>
		</AuthPanel>
	)
}
