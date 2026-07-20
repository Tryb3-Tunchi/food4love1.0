import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const signupSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(10, 'Enter a valid Nigerian phone number').max(15),
  full_name: z.string().min(2, 'Name too short'),
})

export const profileSchema = z.object({
  full_name: z.string().min(2),
  bio: z.string().max(300).optional(),
  location: z.string().optional(),
  cuisines: z.array(z.string()).optional(),
  price_min: z.number().min(0).optional(),
  price_max: z.number().min(0).optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type ProfileInput = z.infer<typeof profileSchema>
