import { Box, type BoxProps } from '@wearclair-ui/styled-system/jsx'

// scrollable content region below a PageHeader. defaults to comfortable padding;
// override `p` (e.g. p="0") for full-bleed bodies like the wizard card.
export const PageBody = ({ children, ...props }: BoxProps) => {
	return (
		<Box flex="1" minH="0" overflowY="auto" p="6" {...props}>
			{children}
		</Box>
	)
}
