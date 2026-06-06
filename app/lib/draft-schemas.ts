import { z } from 'zod'
import { importInputSchema } from './dashboard-schemas'

export const draftIdInputSchema = z.object({
  masterPostId: z.string().uuid(),
})

export const saveVariantEditsInputSchema = z.object({
  masterPostId: z.string().uuid(),
  variants: z.array(
    z.object({
      id: z.string().uuid(),
      text: z.string(),
    }),
  ),
})

export const importDraftInputSchema = importInputSchema
