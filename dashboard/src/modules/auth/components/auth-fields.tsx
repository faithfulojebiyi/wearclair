'use client'

import { useState } from 'react'

import { Icons } from '@wearclair-ui/icons/base'
import { Input, type InputProps } from '@wearclair-ui/primitives/input'
import { Label } from '@wearclair-ui/primitives/label'
import { Box, VStack } from '@wearclair-ui/primitives/layout'
import { css } from '@wearclair-ui/styled-system/css'

type FieldProps = { label: string; name: string } & InputProps

export const TextField = ({ label, name, ...props }: FieldProps) => {
	return (
		<VStack alignItems="stretch" gap="1.5" w="full">
			<Label htmlFor={name}>{label}</Label>
			<Input id={name} name={name} {...props} />
		</VStack>
	)
}

const toggleStyles = css({
	alignItems: 'center',
	bottom: '0',
	color: 'text.muted',
	cursor: 'pointer',
	display: 'flex',
	justifyContent: 'center',
	pos: 'absolute',
	px: '3',
	right: '0',
	top: '0'
})

export const PasswordField = ({ label, name, ...props }: FieldProps) => {
	const [visible, setVisible] = useState(false)

	return (
		<VStack alignItems="stretch" gap="1.5" w="full">
			<Label htmlFor={name}>{label}</Label>
			<Box pos="relative" w="full">
				<Input id={name} name={name} pr="10" type={visible ? 'text' : 'password'} {...props} />
				<button
					aria-label={visible ? 'Hide password' : 'Show password'}
					className={toggleStyles}
					onClick={() => setVisible((v) => !v)}
					type="button"
				>
					{visible ? <Icons.eyeSlash /> : <Icons.eye />}
				</button>
			</Box>
		</VStack>
	)
}
