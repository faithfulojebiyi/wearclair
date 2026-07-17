'use client'

import type * as React from 'react'

import { cva } from '@wearclair-ui/styled-system/css'
import { styled } from '@wearclair-ui/styled-system/jsx'
import type { JsxStyleProps } from '@wearclair-ui/styled-system/types'

const tableCaptionStyles = cva({
	base: {
		color: 'text.muted',
		fontSize: 'sm',
		mt: '4'
	}
})

const StyledTableCaption = styled('caption', tableCaptionStyles)

export const TableCaption = ({ ...props }: React.ComponentProps<'caption'> & JsxStyleProps) => {
	return <StyledTableCaption data-slot="table-caption" {...props} />
}
