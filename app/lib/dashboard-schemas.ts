import { z } from 'zod'
import { accountPasswordSchema } from './password-schema'

export const importInputSchema = z.object({
  url: z.string().url(),
  intentPrompt: z.string().optional(),
})

export const importFormSchema = importInputSchema.extend({
  intentPrompt: z.string(),
})

export const loginInputSchema = z.object({
  email: z.string().email('Enter the email for your operator account.'),
  password: z.string().min(1, 'Enter your password.'),
})

export const accountStepInputSchema = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: accountPasswordSchema,
  firstName: z.string().optional(),
})

export const accountStepFormSchema = z
  .object({
    email: z.string().email('Enter a valid email address.'),
    password: accountPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
    firstName: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  })

export const xStepInputSchema = z.object({
  xAccessToken: z.string().optional(),
  xRefreshToken: z.string().optional(),
})

export const xStepFormSchema = z.object({
  xAccessToken: z.string(),
  xRefreshToken: z.string(),
})

export const linkedinStepInputSchema = z.object({
  linkedinAccessToken: z.string().optional(),
  linkedinAuthorUrn: z.string().optional(),
  linkedinApiVersion: z.string().optional(),
})

export const linkedinStepFormSchema = z.object({
  linkedinAccessToken: z.string(),
  linkedinAuthorUrn: z.string(),
  linkedinApiVersion: z.string(),
})

export const publishInputSchema = z.object({
  provider: z.enum(['x', 'linkedin']),
  text: z.string().min(1),
  linkUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
})
