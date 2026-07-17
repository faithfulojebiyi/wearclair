import { defineConfig } from 'orval'

// reads the live OpenAPI spec from the running api. the api sanitizes its own doc
// server-side (apps/api/src/openapi-sanitizer.ts), so the spec is valid 3.0 with
// resolvable refs. generates a typed axios-functions client; all requests go through
// the custom mutator (api origin + credentials).
const specUrl = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3310'}/api-json`

export default defineConfig({
	wearclair: {
		input: {
			target: specUrl
		},
		output: {
			clean: true,
			client: 'axios-functions',
			mode: 'tags-split',
			override: {
				mutator: {
					name: 'customInstance',
					path: './src/api/mutator.ts'
				}
			},
			target: './src/api/generated'
		}
	}
})
