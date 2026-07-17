'use client'

import { organization } from './auth-client'

export type WorkspaceRoute = '/' | '/auth/create-workspace' | '/auth/sign-in'

const isUnauthorized = (error: { status?: number } | null | undefined) => error?.status === 401

export const resolveWorkspaceRoute = async (): Promise<WorkspaceRoute> => {
	const active = await organization.getFullOrganization()

	if (active.data) {
		return '/'
	}

	if (isUnauthorized(active.error)) {
		return '/auth/sign-in'
	}

	const { data: orgs, error: listError } = await organization.list()

	if (isUnauthorized(listError)) {
		return '/auth/sign-in'
	}

	if (!orgs || orgs.length === 0) {
		return '/auth/create-workspace'
	}

	const { error: setActiveError } = await organization.setActive({ organizationId: orgs[0].id })

	if (isUnauthorized(setActiveError)) {
		return '/auth/sign-in'
	}

	if (setActiveError) {
		return '/auth/create-workspace'
	}

	return '/'
}
