'use client'

import type * as React from 'react'

import { cva } from '@wearclair-ui/styled-system/css'
import { styled } from '@wearclair-ui/styled-system/jsx'
import type { JsxStyleProps } from '@wearclair-ui/styled-system/types'

const cardActionStyles = cva({
	base: {
		alignSelf: 'start',
		gridColumnStart: '2',
		gridRow: 'span 2',
		gridRowStart: '1',
		justifySelf: 'end'
	}
})

const StyledCardAction = styled('div', cardActionStyles)

export const CardAction = ({ ...props }: React.ComponentProps<'div'> & JsxStyleProps) => {
	return <StyledCardAction data-slot="card-action" {...props} />
}
