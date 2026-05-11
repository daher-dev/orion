import { z } from "zod";

import { roleReadSchema } from "@/lib/schemas/role";

export const memberReadSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  job: z.string().nullable().optional(),
  is_operator: z.boolean(),
  role: roleReadSchema,
  created_at: z.string(),
});

export const memberPageSchema = z.object({
  items: z.array(memberReadSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
});

export const memberRoleUpdateSchema = z.object({
  role_id: z.string().min(1),
});

export type MemberRead = z.infer<typeof memberReadSchema>;
export type MemberPage = z.infer<typeof memberPageSchema>;
export type MemberRoleUpdate = z.infer<typeof memberRoleUpdateSchema>;
