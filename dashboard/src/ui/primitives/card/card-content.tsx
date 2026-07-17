'use client'

import type * as React from 'react'

import { cva } from '@wearclair-ui/styled-system/css'
import { styled } from '@wearclair-ui/styled-system/jsx'
import type { JsxStyleProps } from '@wearclair-ui/styled-system/types'

const cardContentStyles = cva({
	base: {
		'[data-size=sm] &': { px: '3' },
		px: '4'
	}
})

const StyledCardContent = styled('div', cardContentStyles)

export const CardContent = ({ ...props }: React.ComponentProps<'div'> & JsxStyleProps) => {
	return <StyledCardContent data-slot="card-content" {...props} />
}
