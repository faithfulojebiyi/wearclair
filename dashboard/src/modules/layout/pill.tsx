import type { ReactNode } from 'react'

import { Badge } from '@wearclair-ui/primitives/badge'

// soft-toned badge presets (ported from Sage's Pill) for maturity levels, aggregation
// kinds, and other inline tags. Maps a semantic tone → the badge colorPalette.
type PillTone = 'success' | 'accent' | 'warn' | 'crit' | 'subtle'

const TONE_PALETTE: Record<PillTone, string> = {
	accent: 'brand.primary',
	crit: 'brand.error',
	subtle: 'colors.gray',
	success: 'brand.success',
	warn: 'brand.warning'
}

export const Pill = ({ tone = 'subtle', children }: { tone?: PillTone; children: ReactNode }) => (
	<Badge colorPalette={TONE_PALETTE[tone]} look="soft" size="xs">
		{children}
	</Badge>
)

// maturity level → tone, shared by the catalog dimension/metric tables.
export const maturityTone = (maturity: string | undefined): PillTone => {
	switch (maturity) {
		case 'validated':
			return 'success'
		case 'proposed':
			return 'accent'
		case 'deprecated':
			return 'crit'
		default:
			return 'subtle'
	}
}
