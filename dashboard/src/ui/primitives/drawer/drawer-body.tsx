'use client'

import { Box, type BoxProps } from '@wearclair-ui/styled-system/jsx'

export const DrawerBody = ({ ...props }: BoxProps) => {
	return <Box data-slot="drawer-body" px="4" py="3" {...props} />
}
