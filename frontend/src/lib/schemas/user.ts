import { z } from "zod";

export const roleSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
});

export const userReadSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  job: z.string().nullable().optional(),
  is_operator: z.boolean(),
  role: roleSummarySchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export const userUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  job: z.string().max(120).optional(),
});

export type UserRead = z.infer<typeof userReadSchema>;
export type UserUpdate = z.infer<typeof userUpdateSchema>;
export type RoleSummary = z.infer<typeof roleSummarySchema>;
