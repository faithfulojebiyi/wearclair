'use client'

import { type FormEvent, useState } from 'react'

import Link from 'next/link'

import { VStack } from '@wearclair-ui/primitives/layout'
import { Span, Text } from '@wearclair-ui/primitives/typography'

import { PasswordField, TextField } from '@/modules/auth/components/auth-fields'
import { AuthPanel } from '@/modules/auth/components/auth-panel'
import { AuthSubmit } from '@/modules/auth/components/auth-submit'
import { useSignUp } from '@/modules/auth/use-sign-up'

export default function SignUpPage() {
	const { isPending, submit } = useSignUp()
	const [name, setName] = useState('')
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')

	const onSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		submit({ email, name, password })
	}

	return (
		<AuthPanel
			footer={
				<>
					Already have an account?{' '}
					<Link href="/auth/sign-in">
						<Span color="text.app" fontWeight="600">
							Log in
						</Span>
					</Link>
				</>
			}
			subtitle="Enter your details to create your account."
			title="Create your account"
		>
			<form onSubmit={onSubmit}>
				<VStack gap="4" w="full">
					<TextField
						autoComplete="name"
						label="Full name"
						name="name"
						onChange={(e) => setName(e.target.value)}
						placeholder="Ada Lovelace"
						required
						value={name}
					/>

					<TextField
						autoComplete="email"
						label="Email"
						name="email"
						onChange={(e) => setEmail(e.target.value)}
						placeholder="you@company.com"
						required
						type="email"
						value={email}
					/>

					<VStack gap="1.5" w="full">
						<PasswordField
							autoComplete="new-password"
							label="Password"
							minLength={8}
							name="password"
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Create a password"
							required
							value={password}
						/>
						<Text color="text.muted" fontSize="1" w="full">
							Must be at least 8 characters.
						</Text>
					</VStack>

					{/* social providers (Google / GitHub) go here once configured on the backend */}

					<AuthSubmit isLoading={isPending} loadingText="Creating account">
						Sign up
					</AuthSubmit>
				</VStack>
			</form>
		</AuthPanel>
	)
}
