'use client'

import { Button, type ButtonProps } from '@wearclair-ui/primitives/button'

// primary solid submit, local to the auth pages (green scale:
// near-black on light, near-white on dark). the rest of the app uses the blue primary.
export const AuthSubmit = ({ children, ...props }: ButtonProps) => {
	return (
		<Button
			_hover={{ opacity: 0.9 }}
			bg="brand.primary.9"
			color="brand.primary.contrast"
			type="submit"
			w="full"
			{...props}
		>
			{children}
		</Button>
	)
}
