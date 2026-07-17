'use client'

import type * as React from 'react'

import { cva, cx } from '@wearclair-ui/styled-system/css'
import { styled } from '@wearclair-ui/styled-system/jsx'
import type { JsxStyleProps } from '@wearclair-ui/styled-system/types'

const tableCellStyles = cva({
	base: {
		'&:has([role=checkbox])': {
			pr: '0'
		},
		p: '7px',
		verticalAlign: 'middle',
		whiteSpace: 'nowrap'
	}
})

const StyledTableCell = styled('td', tableCellStyles)

export const TableCell = ({ className, ...props }: React.ComponentProps<'td'> & JsxStyleProps) => {
	return <StyledTableCell className={cx(className)} data-slot="table-cell" {...props} />
}
