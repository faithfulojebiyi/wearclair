import { VStack } from '@wearclair-ui/primitives/layout'
import { Text } from '@wearclair-ui/primitives/typography'

import { PageBody } from '@/modules/layout/page-body'
import { PageHeader } from '@/modules/layout/page-header'

type ComingSoonProps = {
	title: string
	description: string
}

// placeholder for nav routes whose real pages land in later specs
export const ComingSoon = ({ title, description }: ComingSoonProps) => {
	return (
		<>
			<PageHeader title={title} />
			<PageBody>
				<VStack alignItems="flex-start" gap="2">
					<Text color="text.muted" fontSize="3">
						{description}
					</Text>
					<Text color="text.muted" fontSize="1" mt="2">
						Coming soon.
					</Text>
				</VStack>
			</PageBody>
		</>
	)
}
