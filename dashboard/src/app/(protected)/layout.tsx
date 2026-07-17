'use client'

import { useEffect } from 'react'

import { useRouter } from 'next/navigation'

import { Icons } from '@wearclair-ui/icons/base'
import { Center } from '@wearclair-ui/primitives/layout'
import { SidebarInset, SidebarProvider } from '@wearclair-ui/primitives/sidebar'

import { useSession } from '@/modules/auth/auth-client'
import { AppSidebar } from '@/modules/layout/app-sidebar'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
	const router = useRouter()
	const { data: session, isPending: sessionPending } = useSession()

	// key off the stable user id: useSession revalidates on window focus and hands
	// back a NEW session object each time — keying the redirect effect off it
	// directly would re-run on every focus.
	const userId = session?.user?.id

	useEffect(() => {
		if (sessionPending) {
			return
		}

		if (!userId) {
			router.replace('/auth/sign-in')
		}
	}, [userId, sessionPending, router])

	const ready = !sessionPending && Boolean(session)

	if (!ready) {
		return (
			<Center h="100vh" w="full">
				<Icons.loading animation="loader" size={24} />
			</Center>
		)
	}

	// each page renders its own <PageHeader/> (the app bar) + body
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>{children}</SidebarInset>
		</SidebarProvider>
	)
}
