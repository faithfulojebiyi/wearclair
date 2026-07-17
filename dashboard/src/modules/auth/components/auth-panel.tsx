import { Box, VStack } from '@wearclair-ui/primitives/layout'
import { Heading, Text } from '@wearclair-ui/primitives/typography'

type AuthPanelProps = {
	title: string
	subtitle: string
	children: React.ReactNode
	footer?: React.ReactNode
}

// centered, theme-aware form column shared by every auth screen. the heading/subtitle
// and footer use the full column width; only the form body (inputs/button) is capped.
export const AuthPanel = ({ title, subtitle, children, footer }: AuthPanelProps) => {
	return (
		<VStack gap="6" maxW="420px" mx="auto" w="full">
			<VStack gap="1.5" textAlign="center" w="full">
				<Heading as="h1" color="text.app" fontFamily="ebGaramond" fontSize="8" fontWeight="600">
					{title}
				</Heading>
				<Text color="text.muted" fontSize="2">
					{subtitle}
				</Text>
			</VStack>

			<Box maxW="300px" mx="auto" w="full">
				{children}
			</Box>

			{footer && (
				<Text color="text.muted" fontSize="2" textAlign="center">
					{footer}
				</Text>
			)}
		</VStack>
	)
}
