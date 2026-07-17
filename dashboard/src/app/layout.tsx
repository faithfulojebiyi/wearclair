import type { Metadata } from 'next'
import { EB_Garamond, Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

import { Providers } from './providers'

const geistSans = Geist({
	subsets: ['latin'],
	variable: '--font-geist-sans'
})

const geistMono = Geist_Mono({
	subsets: ['latin'],
	variable: '--font-geist-mono'
})

// serif display face for large auth headings
const ebGaramond = EB_Garamond({
	subsets: ['latin'],
	variable: '--font-eb-garamond',
	weight: ['500', '600', '700']
})

export const metadata: Metadata = {
	description: 'AI workspace for legal teams — matters, documents, and page-cited answers.',
	title: 'Gavely'
}

export default function RootLayout({
	children
}: Readonly<{
	children: React.ReactNode
}>) {
	// suppressHydrationWarning: next-themes sets the theme class on <html> pre-hydration
	return (
		<html
			className={`${geistSans.variable} ${geistMono.variable} ${ebGaramond.variable}`}
			lang="en"
			suppressHydrationWarning
		>
			<body>
				<Providers>{children}</Providers>
			</body>
		</html>
	)
}
