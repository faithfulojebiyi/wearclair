import { cva } from '@wearclair-ui/styled-system/css'
import { styled } from '@wearclair-ui/styled-system/jsx'
import type { JsxStyleProps } from '@wearclair-ui/styled-system/types'

const fieldContentStyles = cva({
	base: {
		display: 'flex',
		flex: '1',
		flexDirection: 'column',
		gap: '1.5',
		lineHeight: 'tight'
	}
})

const StyledFieldContent = styled('div', fieldContentStyles)

export const FieldContent = ({ ...props }: React.ComponentProps<'div'> & JsxStyleProps) => {
	return <StyledFieldContent data-slot="field-content" {...props} />
}
