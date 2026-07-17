'use client'

import { useState } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsAdapter } from 'nuqs/adapters/next/app'

import { ThemeProvider } from '@wearclair-ui/primitives/theme'
import { Toaster } from '@wearclair-ui/primitives/toast/toast'

export const Providers = ({ children }: { children: React.ReactNode }) => {
	// one client per browser session — created lazily so it isn't shared across requests
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						refetchOnWindowFocus: false,
						staleTime: 30_000
					}
				}
			})
	)

	return (
		<NuqsAdapter>
			<ThemeProvider attribute="class" defaultTheme="system" disableTransitionOnChange enableSystem>
				<QueryClientProvider client={queryClient}>
					{children}
					<Toaster position="bottom-right" />
				</QueryClientProvider>
			</ThemeProvider>
		</NuqsAdapter>
	)
}
