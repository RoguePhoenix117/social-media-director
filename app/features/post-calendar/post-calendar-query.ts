import { queryOptions } from '@tanstack/react-query'
import { getPostCalendarPageState } from '../../server/post-calendar'

export const postCalendarQueryKey = ['post-calendar-page-state'] as const

export function postCalendarQueryOptions() {
  return queryOptions({
    queryKey: postCalendarQueryKey,
    queryFn: () => getPostCalendarPageState(),
  })
}
