import { z } from "zod";

import { roleReadSchema } from "@/lib/schemas/role";

export const inviteCreateSchema = z.object({
  email: z.email().max(255),
  role_id: z.string().min(1),
  expires_in_hours: z.number().int().min(1).max(24 * 30).optional(),
});

export const invitedBySummarySchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const inviteReadSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: roleReadSchema,
  invited_by: invitedBySummarySchema.nullable().optional(),
  token: z.string(),
  accepted_at: z.string().nullable().optional(),
  expires_at: z.string(),
  created_at: z.string(),
});

export const invitePageSchema = z.object({
  items: z.array(inviteReadSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
});

export type InviteCreate = z.infer<typeof inviteCreateSchema>;
export type InvitedBySummary = z.infer<typeof invitedBySummarySchema>;
export type InviteRead = z.infer<typeof inviteReadSchema>;
export type InvitePage = z.infer<typeof invitePageSchema>;
