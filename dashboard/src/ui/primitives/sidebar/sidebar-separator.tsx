'use client'

import { css } from '@wearclair-ui/styled-system/css'
import type { JsxStyleProps } from '@wearclair-ui/styled-system/types'

import { Separator, type SeparatorProps } from '../separator'

type SidebarSeparatorProps = SeparatorProps & JsxStyleProps

const separatorStyles = css({
	mx: '2'
})

export const SidebarSeparator = (props: SidebarSeparatorProps) => {
	return <Separator className={separatorStyles} data-slot="sidebar-separator" {...props} />
}
