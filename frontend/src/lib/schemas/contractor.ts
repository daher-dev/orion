import { z } from "zod";

export const contractorReadSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Contractor = z.infer<typeof contractorReadSchema>;

export const contractorPageSchema = z.object({
  items: z.array(contractorReadSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
});

export type ContractorPage = z.infer<typeof contractorPageSchema>;

export type ContractorFilters = {
  q?: string;
  page?: number;
  page_size?: number;
};

export const contractorFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "validation.nameRequired" })
    .max(120, { message: "validation.nameTooLong" }),
  address: z
    .string()
    .trim()
    .max(255)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined)),
});

export type ContractorFormValues = z.input<typeof contractorFormSchema>;
export type ContractorFormPayload = z.output<typeof contractorFormSchema>;
