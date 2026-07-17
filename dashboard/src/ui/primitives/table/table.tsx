'use client'

import type * as React from 'react'

import { cva } from '@wearclair-ui/styled-system/css'
import { styled } from '@wearclair-ui/styled-system/jsx'
import type { JsxStyleProps } from '@wearclair-ui/styled-system/types'

// Table Container (wrapper div)
const tableContainerStyles = cva({
	base: {
		overflowX: 'auto',
		position: 'relative',
		w: 'full'
	}
})

// Table
const tableStyles = cva({
	base: {
		captionSide: 'bottom',
		fontSize: 'sm',
		w: 'full'
	}
})

const StyledTable = styled('table', tableStyles)

export const TableContainer = ({ children, ...props }: React.ComponentProps<'table'> & JsxStyleProps) => {
	return (
		<div className={tableContainerStyles()} data-slot="table-container">
			<StyledTable data-slot="table" {...props}>
				{children}
			</StyledTable>
		</div>
	)
}
