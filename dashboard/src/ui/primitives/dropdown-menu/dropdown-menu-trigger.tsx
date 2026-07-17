'use client'

import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'

import { styled } from '@wearclair-ui/styled-system/jsx'
import type { JsxStyleProps } from '@wearclair-ui/styled-system/types'

const StyledTrigger = styled(DropdownMenuPrimitive.Trigger)

export const DropdownMenuTrigger = ({
	...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger> & JsxStyleProps) => {
	return <StyledTrigger data-slot="dropdown-menu-trigger" {...props} />
}
