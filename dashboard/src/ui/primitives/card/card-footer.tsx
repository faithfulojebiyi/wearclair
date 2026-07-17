'use client'

import type * as React from 'react'

import { cva } from '@wearclair-ui/styled-system/css'
import { styled } from '@wearclair-ui/styled-system/jsx'
import type { JsxStyleProps } from '@wearclair-ui/styled-system/types'

const cardFooterStyles = cva({
	base: {
		'[data-size=sm] &': { p: '3' },
		alignItems: 'center',
		bg: 'background.muted',
		borderTop: 'subtle',
		display: 'flex',
		p: '4',
		roundedBottom: '2xl'
	}
})

const StyledCardFooter = styled('div', cardFooterStyles)

export const CardFooter = ({ ...props }: React.ComponentProps<'div'> & JsxStyleProps) => {
	return <StyledCardFooter data-slot="card-footer" {...props} />
}
