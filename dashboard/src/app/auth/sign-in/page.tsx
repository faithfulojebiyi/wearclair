'use client'

import { type FormEvent, useState } from 'react'

import Link from 'next/link'

import { Flex, VStack } from '@wearclair-ui/primitives/layout'
import { Span, Text } from '@wearclair-ui/primitives/typography'

import { PasswordField, TextField } from '@/modules/auth/components/auth-fields'
import { AuthPanel } from '@/modules/auth/components/auth-panel'
import { AuthSubmit } from '@/modules/auth/components/auth-submit'
import { useSignIn } from '@/modules/auth/use-sign-in'

export default function SignInPage() {
	const { isPending, submit } = useSignIn()
	const [email, setEmail] = useState('')
	const [password, setPassword] = useState('')

	const onSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		submit({ email, password })
	}

	return (
		<AuthPanel
			footer={
				<>
					Don&apos;t have an account?{' '}
					<Link href="/auth/sign-up">
						<Span color="text.app" fontWeight="600">
							Sign up
						</Span>
					</Link>
				</>
			}
			subtitle="Enter your email and password to access your account."
			title="Welcome back"
		>
			<form onSubmit={onSubmit}>
				<VStack gap="4" w="full">
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
							autoComplete="current-password"
							label="Password"
							name="password"
							onChange={(e) => setPassword(e.target.value)}
							placeholder="Enter your password"
							required
							value={password}
						/>
						<Flex justify="flex-end" w="full">
							<Link href="/auth/sign-in">
								<Text color="text.muted" fontSize="1">
									Forgot password?
								</Text>
							</Link>
						</Flex>
					</VStack>

					<AuthSubmit isLoading={isPending} loadingText="Signing in">
						Sign in
					</AuthSubmit>
				</VStack>
			</form>
		</AuthPanel>
	)
}
