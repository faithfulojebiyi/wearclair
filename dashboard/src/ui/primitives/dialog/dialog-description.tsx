'use client'

import type * as React from 'react'

import { Dialog as DialogPrimitive } from 'radix-ui'

import { cva } from '@wearclair-ui/styled-system/css'
import { styled } from '@wearclair-ui/styled-system/jsx'
import type { JsxStyleProps } from '@wearclair-ui/styled-system/types'

type Props = React.ComponentProps<typeof DialogPrimitive.Title> & JsxStyleProps

const descriptionStyles = cva({
	base: {
		fontSize: '2'
	}
})

const StyledDialogDescription = styled(DialogPrimitive.Description, descriptionStyles)

export const DialogDescription = function DialogDescription({ ...props }: Props) {
	return <StyledDialogDescription data-slot="dialog-description" {...props} />
}
