'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Icons } from '@wearclair-ui/icons/base'
import { Avatar, AvatarFallback } from '@wearclair-ui/primitives/avatar'
import { Box, HStack } from '@wearclair-ui/primitives/layout'
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarTrigger
} from '@wearclair-ui/primitives/sidebar'

import { GLOBAL_NAV, type NavItem } from './nav-config'
import { Pill } from './pill'
import { UserMenu } from './user-menu'

// the small product mark in the header — consumer app, no workspace switcher.
const BrandMark = () => (
	<Avatar radius="md" size={1}>
		<AvatarFallback bg="brand.primary.9" color="brand.primary.contrast" fontSize="1" fontWeight="600">
			CL
		</AvatarFallback>
	</Avatar>
)

const NavRow = ({ item, isActive }: { item: NavItem; isActive?: boolean }) => {
	const ItemIcon = Icons[item.icon]
	const label = (
		<>
			<ItemIcon />
			<span>{item.title}</span>
			{item.pill ? (
				<Box ml="auto">
					<Pill tone={item.pill === 'Beta' ? 'accent' : 'subtle'}>{item.pill}</Pill>
				</Box>
			) : null}
		</>
	)

	if (item.disabled || !item.href) {
		return (
			<SidebarMenuButton aria-disabled tooltip={item.title}>
				{label}
			</SidebarMenuButton>
		)
	}

	return (
		<SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
			<Link href={item.href}>{label}</Link>
		</SidebarMenuButton>
	)
}

// minimal app shell: brand mark + global nav + user menu. Grow the nav as
// product surfaces land (see nav-config).
export const AppSidebar = () => {
	const pathname = usePathname()

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<HStack
					css={{ '[data-collapsible=icon] &': { justifyContent: 'center' } }}
					gap="1"
					justify="space-between"
					w="full"
				>
					<BrandMark />
					<SidebarTrigger css={{ '[data-collapsible=icon] &': { display: 'none' } }} h="7" p="0" w="7" />
				</HStack>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarMenu>
						{GLOBAL_NAV.map((item) => (
							<SidebarMenuItem key={item.title}>
								<NavRow item={item} isActive={Boolean(item.href) && pathname === item.href} />
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				{/* collapsed rail: the expand toggle lives here, above the avatar */}
				<Box css={{ '[data-collapsible=icon] &': { display: 'flex', justifyContent: 'center' }, display: 'none' }}>
					<SidebarTrigger h="7" p="0" w="7" />
				</Box>
				<UserMenu />
			</SidebarFooter>
		</Sidebar>
	)
}
