'use client'

import type * as React from 'react'

import { Command as CommandPrimitive } from 'cmdk'

import { styled } from '@wearclair-ui/styled-system/jsx'
import type { JsxStyleProps } from '@wearclair-ui/styled-system/types'

const StyledCommand = styled(CommandPrimitive, {})

type Props = React.ComponentProps<typeof CommandPrimitive> & JsxStyleProps

export const Command = ({ filter, ...props }: Props) => {
	return <StyledCommand data-slot="command" {...props} />
}
