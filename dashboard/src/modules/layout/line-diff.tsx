import { useMemo } from 'react'

import { Box } from '@wearclair-ui/primitives/layout'

// minimal line-level diff (no dependency). LCS backtrack → a unified add/del/same list.
// O(lines²) is fine for SQL / spec text. Reused anywhere we compare two versions.
type DiffLine = { type: 'add' | 'del' | 'same'; text: string }

export function diffLines(before: string, after: string): DiffLine[] {
	const a = before.split('\n')
	const b = after.split('\n')
	const m = a.length
	const n = b.length

	// dp[i][j] = LCS length of a[i:] and b[j:]
	const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
	for (let i = m - 1; i >= 0; i--) {
		for (let j = n - 1; j >= 0; j--) {
			dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
		}
	}

	const out: DiffLine[] = []
	let i = 0
	let j = 0
	while (i < m && j < n) {
		if (a[i] === b[j]) {
			out.push({ text: a[i], type: 'same' })
			i++
			j++
		} else if (dp[i + 1][j] >= dp[i][j + 1]) {
			out.push({ text: a[i], type: 'del' })
			i++
		} else {
			out.push({ text: b[j], type: 'add' })
			j++
		}
	}
	while (i < m) {
		out.push({ text: a[i++], type: 'del' })
	}
	while (j < n) {
		out.push({ text: b[j++], type: 'add' })
	}
	return out
}

const LINE_STYLE = {
	add: { bg: 'brand.success.3', color: 'text.success', prefix: '+' },
	del: { bg: 'brand.error.3', color: 'text.error', prefix: '-' },
	same: { bg: 'transparent', color: 'text.muted', prefix: ' ' }
} as const

// unified diff of `before` → `after`. Added lines green, removed red, unchanged muted.
export const LineDiff = ({ before, after }: { before: string; after: string }) => {
	const lines = useMemo(() => diffLines(before, after), [before, after])

	if (before === after) {
		return (
			<Box color="text.subtle" fontSize="1" px="3" py="2">
				No changes.
			</Box>
		)
	}

	return (
		<Box
			bg="brand.panel.1"
			border="subtle"
			fontFamily="jetBrainsMono"
			fontSize="1"
			maxH="24rem"
			overflow="auto"
			rounded="lg"
		>
			{lines.map((line, idx) => {
				const style = LINE_STYLE[line.type]
				return (
					<Box bg={style.bg} color={style.color} key={`${idx}-${line.type}-${line.text}`} px="3" whiteSpace="pre-wrap">
						{style.prefix} {line.text}
					</Box>
				)
			})}
		</Box>
	)
}
