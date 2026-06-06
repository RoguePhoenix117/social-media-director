import { queryOptions } from '@tanstack/react-query'
import { getDraftPageState } from '../../server/drafts'

export const draftPageQueryKey = ['draft-page-state'] as const

export function draftPageQueryOptions() {
  return queryOptions({
    queryKey: draftPageQueryKey,
    queryFn: () => getDraftPageState(),
  })
}
