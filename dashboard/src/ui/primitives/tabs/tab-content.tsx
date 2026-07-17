'use client'

import type * as React from 'react'

import { Tabs as TabsPrimitive } from 'radix-ui'

import { cva } from '@wearclair-ui/styled-system/css'
import { styled } from '@wearclair-ui/styled-system/jsx'
import type { JsxStyleProps } from '@wearclair-ui/styled-system/types'

const tabContentStyles = cva({
	base: {
		_focusVisible: {
			outline: 'none'
		}
	}
})

const StyledTabContent = styled(TabsPrimitive.Content, tabContentStyles)

export const TabContent = (props: React.ComponentProps<typeof TabsPrimitive.Content> & JsxStyleProps) => {
	return <StyledTabContent {...props} />
}
