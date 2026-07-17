import { Box, Flex, VStack } from '@wearclair-ui/primitives/layout'
import { Heading, Text } from '@wearclair-ui/primitives/typography'
import { css } from '@wearclair-ui/styled-system/css'

// the image is the layout's MAIN background. on top sits a solid card (background.app —
// white in light, dark in dark). inside it, the left is a fully-rounded window inset
// with card-coloured padding; the window paints the SAME image with background-attachment
// fixed so it locks to the viewport and lines up with the page background — it reads as a
// transparent cutout revealing the main background. the right is the solid form panel.
const seeThrough = css({
	backgroundAttachment: 'fixed',
	backgroundImage: "url('/auth-bg.jpg')",
	backgroundPosition: 'center',
	backgroundSize: 'cover'
})

export default function AuthLayout({ children }: { children: React.ReactNode }) {
	return (
		<Box className={seeThrough} h="100vh" p={{ base: '0', md: '4' }} w="full">
			<Flex
				bg="background.app"
				gap="2"
				h="full"
				maxW="1440px"
				mx="auto"
				p="2"
				rounded={{ base: 'none', md: '3xl' }}
				w="full"
			>
				{/* left: fully-rounded see-through window inset by the card-coloured padding */}
				<Box
					className={seeThrough}
					display={{ base: 'none', lg: 'block' }}
					flex="1"
					overflow="hidden"
					pos="relative"
					rounded="2xl"
				>
					{/* gradient keeps the white copy legible over the art */}
					<Box bg="linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0))" inset="0" pos="absolute" />

					<Flex flexDir="column" h="full" justify="space-between" p="10" pos="relative">
						<Text color="white" fontSize="1" fontWeight="600" letterSpacing="0.2em" textTransform="uppercase">
							wearclair
						</Text>

						<VStack alignItems="flex-start" gap="3" maxW="32rem">
							<Heading as="h2" color="white" fontFamily="ebGaramond" fontSize="10" fontWeight="600" lineHeight="1.05">
								The future of legal work.
							</Heading>
							<Text color="rgba(255,255,255,0.85)" fontSize="3">
								Upload the matter, ask in plain language, and get page-cited answers from your documents.
							</Text>
						</VStack>
					</Flex>
				</Box>

				{/* right: solid (theme-aware) form panel */}
				<Flex align="center" flex="1" justify="center" px={{ base: '6', md: '8' }} py="10">
					{children}
				</Flex>
			</Flex>
		</Box>
	)
}
