import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 8

const hasLetter = /[A-Za-z]/
const hasNumber = /[0-9]/
const hasSymbol = /[^A-Za-z0-9]/

export function addPasswordValidationIssues(value: string, ctx: z.RefinementCtx) {
  if (value.length < PASSWORD_MIN_LENGTH) {
    ctx.addIssue({
      code: 'custom',
      message: `Use at least ${PASSWORD_MIN_LENGTH} characters.`,
    })
  }
  if (!hasLetter.test(value)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Include at least one letter.',
    })
  }
  if (!hasNumber.test(value)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Include at least one number.',
    })
  }
  if (!hasSymbol.test(value)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Include at least one symbol.',
    })
  }
}

export const accountPasswordSchema = z
  .string()
  .min(1, 'Enter a password.')
  .superRefine((value, ctx) => {
    addPasswordValidationIssues(value, ctx)
  })
