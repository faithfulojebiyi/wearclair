// url-safe slug from a workspace name + short random suffix to avoid collisions.
export const slugify = (value: string): string =>
	value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.replace(/-{2,}/g, '-')

export const randomSuffix = (length = 4): string => {
	const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
	const bytes = crypto.getRandomValues(new Uint8Array(length))

	return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

export const slugWithSuffix = (name: string): string => {
	const base = slugify(name) || 'workspace'

	return `${base}-${randomSuffix()}`
}
