'use client'

import { AlertDialog as AlertDialogPrimitive } from 'radix-ui'

import { styled } from '@wearclair-ui/styled-system/jsx'
import type { JsxStyleProps } from '@wearclair-ui/styled-system/types'

const StyledTitle = styled(AlertDialogPrimitive.Title)

export const AlertDialogTitle = ({
	...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title> & JsxStyleProps) => {
	return <StyledTitle data-slot="alert-dialog-title" fontSize="3" fontWeight="500" {...props} />
}
