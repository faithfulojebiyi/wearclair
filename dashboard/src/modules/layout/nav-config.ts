import { Icons } from '@wearclair-ui/icons/base'

type IconKey = keyof typeof Icons

export type NavItem = {
	title: string
	href?: string
	icon: IconKey
	/** pill shown after the label ("Beta", "Early", "Soon") */
	pill?: string
	/** rendered non-interactive (product surface not built yet) */
	disabled?: boolean
}

// Placeholders until product surfaces land. Add real entries as features ship.
export const GLOBAL_NAV: NavItem[] = [
	{ href: '/', icon: 'home', title: 'Home' },
	{ disabled: true, icon: 'searchNormal', title: 'Search' }
]
