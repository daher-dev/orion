import { z } from "zod";

const optionalString = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

const optionalEmail = z
  .string()
  .max(255)
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined))
  .pipe(z.union([z.email(), z.undefined()]));

export const clientCreateSchema = z.object({
  name: z.string().min(1).max(120),
  email: optionalEmail,
  phone: optionalString(40),
  address: optionalString(255),
});

export const clientUpdateSchema = clientCreateSchema.partial();

export const clientReadSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const clientPageSchema = z.object({
  items: z.array(clientReadSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
});

export type ClientCreate = z.infer<typeof clientCreateSchema>;
export type ClientUpdate = z.infer<typeof clientUpdateSchema>;
export type ClientRead = z.infer<typeof clientReadSchema>;
export type ClientPage = z.infer<typeof clientPageSchema>;

export type ClientFilters = {
  q?: string;
  page?: number;
  pageSize?: number;
};
