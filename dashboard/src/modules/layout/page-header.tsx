import Link from 'next/link'

import { Icons } from '@wearclair-ui/icons/base'
import { buttonStyle } from '@wearclair-ui/primitives/button/button'
import { Flex, HStack } from '@wearclair-ui/primitives/layout'
import { Heading } from '@wearclair-ui/primitives/typography'

type PageHeaderProps = {
	title: React.ReactNode
	// when set, a back arrow links here (sub-pages like the create wizard)
	backHref?: string
	// right-aligned actions (e.g. a "Create" button)
	children?: React.ReactNode
}

// the app bar for a page: sidebar trigger + optional back + title, with actions at
// the right. rendered by each page (genie pattern) so the title lives in the bar.
export const PageHeader = ({ title, backHref, children }: PageHeaderProps) => {
	return (
		<Flex align="center" borderBottom="subtle" flexShrink="0" gap="2" h="2.75rem" justify="space-between" px="3">
			<HStack gap="2" minW="0">
				{backHref && (
					<Link aria-label="Back" className={buttonStyle({ size: 'icon', variant: 'ghost' })} href={backHref}>
						<Icons.arrowLeft />
					</Link>
				)}
				{typeof title === 'string' ? (
					<Heading as="h1" color="text.app" fontSize="3" fontWeight="600">
						{title}
					</Heading>
				) : (
					title
				)}
			</HStack>

			{children && <HStack gap="2">{children}</HStack>}
		</Flex>
	)
}
