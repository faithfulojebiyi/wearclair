import { Center, VStack } from '@wearclair-ui/primitives/layout'
import { Text } from '@wearclair-ui/primitives/typography'

// minimal authenticated landing. Replace with the product home as features land.
export default function HomePage() {
	return (
		<Center h="100vh" w="full">
			<VStack gap="2">
				<Text fontSize="4" fontWeight="600">
					Welcome
				</Text>
				<Text color="text.subtle" fontSize="2">
					Your workspace is ready.
				</Text>
			</VStack>
		</Center>
	)
}
