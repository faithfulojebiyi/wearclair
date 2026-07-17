'use client'

import type * as React from 'react'

import { Dialog as DialogPrimitive } from 'radix-ui'

import { cva } from '@wearclair-ui/styled-system/css'
import { styled } from '@wearclair-ui/styled-system/jsx'
import type { JsxStyleProps } from '@wearclair-ui/styled-system/types'

type Props = React.ComponentProps<typeof DialogPrimitive.Title> & JsxStyleProps

const titleStyles = cva({
	base: {
		alignItems: 'center',
		display: 'flex',
		gap: '1.5',
		textStyle: 'modalTitle'
	}
})

const StyledSheetTitle = styled(DialogPrimitive.Title, titleStyles)

export const SheetTitle = (props: Props) => {
	return <StyledSheetTitle {...props} />
}
