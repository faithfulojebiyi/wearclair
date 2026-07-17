'use client'

import type * as React from 'react'

import { cva } from '@wearclair-ui/styled-system/css'
import { styled } from '@wearclair-ui/styled-system/jsx'
import type { JsxStyleProps } from '@wearclair-ui/styled-system/types'

const tableBodyStyles = cva({
	base: {
		'& tr:last-child': {
			borderBottom: 'none'
		}
	}
})

const StyledTableBody = styled('tbody', tableBodyStyles)

export const TableBody = ({ ...props }: React.ComponentProps<'tbody'> & JsxStyleProps) => {
	return <StyledTableBody data-slot="table-body" {...props} />
}
