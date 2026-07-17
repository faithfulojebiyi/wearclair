import type { ReactNode } from 'react'

import { Box } from '@wearclair-ui/primitives/layout'
import type { JsxStyleProps } from '@wearclair-ui/styled-system/types'

// a small uppercase monospace label for grouping sections / column headers (ported
// from the Sage design language). Forwards style props so callers can tweak layout.
export const SectionLabel = ({ children, ...rest }: { children: ReactNode } & JsxStyleProps) => (
	<Box
		color="text.muted"
		fontFamily="jetBrainsMono"
		fontSize="0.688"
		letterSpacing="0.08em"
		textTransform="uppercase"
		{...rest}
	>
		{children}
	</Box>
)
