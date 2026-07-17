import { cva } from '@wearclair-ui/styled-system/css'
import { styled } from '@wearclair-ui/styled-system/jsx'
import type { JsxStyleProps } from '@wearclair-ui/styled-system/types'

type FieldSetProps = React.ComponentProps<'fieldset'> & JsxStyleProps

const fieldSetStyles = cva({
	base: {
		'&:has(> [data-slot="checkbox-group"])': {
			gap: '0.75rem'
		},

		'&:has(> [data-slot="radio-group"])': {
			gap: '0.75rem'
		},
		flex: 'col',
		gap: '6'
	}
})
const StyledFieldSet = styled('fieldset', fieldSetStyles)
export const FieldSet = ({ ...props }: FieldSetProps) => {
	return <StyledFieldSet data-slot="field-set" {...props} />
}
