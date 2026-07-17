'use client'

import type * as React from 'react'

import { cva } from '@wearclair-ui/styled-system/css'
import { styled } from '@wearclair-ui/styled-system/jsx'
import type { JsxStyleProps } from '@wearclair-ui/styled-system/types'

const tableHeaderStyles = cva({
	base: {
		'& tr': {
			borderBottom: 'subtle'
		}
	}
})

const StyledTableHeader = styled('thead', tableHeaderStyles)

export const TableHeader = ({ ...props }: React.ComponentProps<'thead'> & JsxStyleProps) => {
	return <StyledTableHeader data-slot="table-header" {...props} />
}
