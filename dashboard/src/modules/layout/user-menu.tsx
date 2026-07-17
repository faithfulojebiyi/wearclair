'use client'

import { useRouter } from 'next/navigation'

import { Icons } from '@wearclair-ui/icons/base'
import { Avatar, AvatarFallback } from '@wearclair-ui/primitives/avatar'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger
} from '@wearclair-ui/primitives/dropdown-menu'
import { Box, HStack } from '@wearclair-ui/primitives/layout'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@wearclair-ui/primitives/sidebar'
import { useTheme } from '@wearclair-ui/primitives/theme'
import { Text } from '@wearclair-ui/primitives/typography'

import { signOut, useSession } from '@/modules/auth/auth-client'

const initials = (value: string) =>
	value
		.split(' ')
		.map((part) => part[0])
		.filter(Boolean)
		.slice(0, 2)
		.join('')
		.toUpperCase()

const THEMES = [
	{ icon: 'sun', label: 'Light', value: 'light' },
	{ icon: 'moon', label: 'Dark', value: 'dark' },
	{ icon: 'device', label: 'System', value: 'system' }
] as const

export const UserMenu = () => {
	const router = useRouter()
	const { data: session } = useSession()
	const { setTheme, theme } = useTheme()
	const { isMobile } = useSidebar()

	const user = session?.user
	const name = user?.name || user?.email || 'Account'

	const onSignOut = async () => {
		await signOut()
		router.replace('/auth/sign-in')
	}

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							css={{
								// collapsed rail: a centered square around the avatar, no stray padding
								'[data-collapsible=icon] &': { h: '8', justifyContent: 'center', mx: 'auto', p: '0', w: '8' }
							}}
							gap="2"
							h="9"
							p="0"
						>
							<Avatar radius="md" size={1}>
								<AvatarFallback bg="brand.primary.9" color="brand.primary.contrast" fontSize="1" fontWeight="600">
									{initials(name)}
								</AvatarFallback>
							</Avatar>
							<Box css={{ '[data-collapsible=icon] &': { display: 'none' } }} flex="1" minW="0" textAlign="left">
								<Text fontSize="1" fontWeight="500" maxLines={1}>
									{user?.name ?? 'Account'}
								</Text>
							</Box>
						</SidebarMenuButton>
					</DropdownMenuTrigger>

					<DropdownMenuContent align="end" css={{ minW: '15rem' }} side={isMobile ? 'bottom' : 'right'}>
						<DropdownMenuLabel>Theme</DropdownMenuLabel>
						{THEMES.map((option) => {
							const ThemeIcon = Icons[option.icon]

							return (
								<DropdownMenuItem key={option.value} onSelect={() => setTheme(option.value)}>
									<HStack gap="2" justify="space-between" w="full">
										<HStack gap="2">
											<ThemeIcon size={14} />
											<Text fontSize="1">{option.label}</Text>
										</HStack>
										{theme === option.value && <Icons.check size={14} />}
									</HStack>
								</DropdownMenuItem>
							)
						})}

						<DropdownMenuSeparator />

						<DropdownMenuItem onSelect={onSignOut}>
							<HStack gap="2">
								<Icons.logout size={14} />
								<Text fontSize="1">Sign out</Text>
							</HStack>
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	)
}
