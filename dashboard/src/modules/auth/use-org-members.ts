'use client'

import { useQuery } from '@tanstack/react-query'

import { organization, useActiveOrganization } from './auth-client'

export type OrgMember = { userId: string; name: string }

// the active organization's members via better-auth's list-members endpoint —
// powers person pickers (list Assignee etc.). The active-organization hook's
// payload does not reliably include members, so we query them explicitly.
export const useOrgMembers = (): OrgMember[] => {
	const { data: activeOrganization } = useActiveOrganization()

	const { data } = useQuery({
		enabled: Boolean(activeOrganization?.id),
		queryFn: async () => {
			const response = await organization.listMembers()

			if (response.error) {
				throw new Error(response.error.message ?? 'Could not load members')
			}

			return response.data
		},
		queryKey: ['org-members', activeOrganization?.id ?? ''],
		staleTime: 60_000
	})

	return (data?.members ?? []).map((member) => ({
		name: member.user?.name || member.user?.email || 'Member',
		userId: member.userId
	}))
}
