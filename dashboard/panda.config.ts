import { defineConfig } from '@pandacss/dev'

import { wearclairUi } from '@wearclair-ui/theme/preset'

export default defineConfig({
	// Files to exclude
	exclude: [],
	importMap: '@wearclair-ui/styled-system',
	// Where to look for your css declarations
	include: ['./src/**/*.{js,jsx,ts,tsx}', './pages/**/*.{js,jsx,ts,tsx}'],
	jsxFramework: 'react',

	// The output directory for your css system
	// outdir: 'styled-system',
	outdir: './src/ui/styled-system',
	polyfill: true,
	prefix: 'wearclair',
	// Whether to use css reset
	preflight: true,
	presets: [wearclairUi],

	// Useful for theme customization
	theme: {
		extend: {}
	}
})
