import { z } from 'zod'
import { draftIdInputSchema } from './draft-schemas'

export const scheduleDraftInputSchema = draftIdInputSchema.extend({
  scheduledAt: z.string().datetime(),
  timezone: z.string().min(1),
})

export const cancelScheduledPostInputSchema = z.object({
  scheduledPostId: z.string().uuid(),
})

export const calendarRangeInputSchema = z.object({
  start: z.string().datetime(),
  end: z.string().datetime(),
})
