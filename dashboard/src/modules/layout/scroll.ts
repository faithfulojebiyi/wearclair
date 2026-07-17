import { css } from '@wearclair-ui/styled-system/css'

// scrollable but with no visible scrollbar (webkit + firefox)
export const hiddenScrollbar = css({
	'&::-webkit-scrollbar': { display: 'none' },
	scrollbarWidth: 'none'
})
