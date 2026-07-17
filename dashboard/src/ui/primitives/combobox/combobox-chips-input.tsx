'use client'

import { Combobox as ComboboxPrimitive } from '@base-ui/react'

import { cva } from '@wearclair-ui/styled-system/css'
import { styled } from '@wearclair-ui/styled-system/jsx'
import type { JsxStyleProps } from '@wearclair-ui/styled-system/types'

const chipsInputStyles = cva({
	base: {
		flex: '1',
		minW: '4rem',
		outline: 'none'
	}
})

const StyledChipsInput = styled(ComboboxPrimitive.Input, chipsInputStyles)

export type ComboboxChipsInputProps = ComboboxPrimitive.Input.Props & JsxStyleProps

export const ComboboxChipsInput = ({ ...props }: ComboboxChipsInputProps) => {
	return <StyledChipsInput data-slot="combobox-chip-input" {...props} />
}
