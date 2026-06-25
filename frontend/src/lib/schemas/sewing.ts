/**
 * Zod schemas for the Sewing (Costura) feature.
 *
 * Mirrors `backend/src/schemas/sewing.py`. A Shipment (remessa) bundles cut
 * pieces sent from a DONE cutting order to a contractor (banca); the wire shape
 * embeds compact cutting-order + contractor projections so list rows can render
 * in one fetch.
 *
 * Receiving is now PARTIAL + repeatable: each item carries `requested`,
 * `received`, and `credited` (the watermark of how much of `received` has
 * already been posted to blank-piece stock). A receive only credits the new
 * delta (`received − credited`); re-calling tops up.
 */

import { z } from "zod";
import { SIZES, type Size } from "@/lib/schemas/product";

export const SHIPMENT_STATUSES = [
  "sent",
  "received",
  "partial",
  "cancelled",
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];
export const shipmentStatusSchema = z.enum(SHIPMENT_STATUSES);

export const shipmentItemReadSchema = z.object({
  id: z.string(),
  size: z.enum(SIZES),
  requested_quantity: z.number().int().min(0),
  received_quantity: z.number().int().min(0),
  credited_quantity: z.number().int().min(0),
});

export type ShipmentItem = z.infer<typeof shipmentItemReadSchema>;

export const shipmentCuttingOrderRefSchema = z.object({
  id: z.string(),
  code: z.string(),
});

export const shipmentContractorRefSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const shipmentReadSchema = z.object({
  id: z.string(),
  // Null for legacy standalone remessas whose source cutting order is gone.
  cutting_order: shipmentCuttingOrderRefSchema.nullable(),
  contractor: shipmentContractorRefSchema,
  status: shipmentStatusSchema,
  sent_at: z.string(),
  received_at: z.string().nullable().optional(),
  items: z.array(shipmentItemReadSchema),
  created_at: z.string(),
  updated_at: z.string(),
});

export type Shipment = z.infer<typeof shipmentReadSchema>;

export const shipmentPageSchema = z.object({
  items: z.array(shipmentReadSchema),
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  has_more: z.boolean(),
});

export type ShipmentPage = z.infer<typeof shipmentPageSchema>;

export type ShipmentFilters = {
  q?: string;
  status?: ShipmentStatus;
  contractor_id?: string;
  cutting_order_id?: string;
  page?: number;
  page_size?: number;
};

/**
 * Form-side schema for creating a shipment. Per-size requested quantities
 * live on a `sizes` map keyed by size; the transform step in
 * `buildShipmentCreatePayload` flattens the map to the backend list shape
 * and drops any size with quantity 0. The cutting order is picked from the
 * available-cuts list; the form clamps each size's `max` to availability as a
 * soft client guard (the backend re-validates against live availability).
 */
const requestedSizeMap = z
  .object({
    p: z.coerce.number().int().min(0).default(0),
    m: z.coerce.number().int().min(0).default(0),
    g: z.coerce.number().int().min(0).default(0),
    gg: z.coerce.number().int().min(0).default(0),
    u: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((data, ctx) => {
    const total = data.p + data.m + data.g + data.gg + data.u;
    if (total <= 0) {
      ctx.addIssue({
        code: "custom",
        path: ["p"],
        message: "validation.atLeastOneSize",
      });
    }
  });

export const shipmentFormSchema = z.object({
  cutting_order_id: z.string().min(1, { message: "validation.cuttingOrderRequired" }),
  contractor_id: z.string().min(1, { message: "validation.contractorRequired" }),
  sent_at: z.string().trim().min(1, { message: "validation.sentAtRequired" }),
  sizes: requestedSizeMap,
});

export type ShipmentFormValues = z.input<typeof shipmentFormSchema>;
export type ShipmentFormParsed = z.output<typeof shipmentFormSchema>;

export type ShipmentCreatePayload = {
  cutting_order_id: string;
  contractor_id: string;
  sent_at: string;
  items: Array<{ size: Size; requested_quantity: number }>;
};

export function buildShipmentCreatePayload(
  parsed: ShipmentFormParsed,
): ShipmentCreatePayload {
  const items: Array<{ size: Size; requested_quantity: number }> = [];
  for (const size of SIZES) {
    const requested_quantity = parsed.sizes[size];
    if (requested_quantity > 0) items.push({ size, requested_quantity });
  }
  return {
    cutting_order_id: parsed.cutting_order_id,
    contractor_id: parsed.contractor_id,
    sent_at: parsed.sent_at,
    items,
  };
}

/**
 * Receive-side schema. Each size carries the *received* count; values must
 * be non-negative and at least one size must have a positive quantity. Sizes
 * omitted from the payload retain their current received count server-side
 * (partial = send fewer/lower sizes, re-call to top up).
 */
export const shipmentReceiveFormSchema = z.object({
  received_at: z.string().trim().min(1, { message: "validation.receivedAtRequired" }),
  sizes: z
    .object({
      p: z.coerce.number().int().min(0).default(0),
      m: z.coerce.number().int().min(0).default(0),
      g: z.coerce.number().int().min(0).default(0),
      gg: z.coerce.number().int().min(0).default(0),
      u: z.coerce.number().int().min(0).default(0),
    })
    .superRefine((data, ctx) => {
      const total = data.p + data.m + data.g + data.gg + data.u;
      if (total <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["p"],
          message: "validation.atLeastOneSize",
        });
      }
    }),
});

export type ShipmentReceiveFormValues = z.input<typeof shipmentReceiveFormSchema>;
export type ShipmentReceiveFormParsed = z.output<typeof shipmentReceiveFormSchema>;

export type ShipmentReceivePayload = {
  received_at: string;
  items: Array<{ size: Size; received_quantity: number }>;
};

export function buildShipmentReceivePayload(
  parsed: ShipmentReceiveFormParsed,
): ShipmentReceivePayload {
  const items: Array<{ size: Size; received_quantity: number }> = [];
  for (const size of SIZES) {
    const received_quantity = parsed.sizes[size];
    if (received_quantity > 0) items.push({ size, received_quantity });
  }
  return {
    received_at: parsed.received_at,
    items,
  };
}

export function sumRequested(items: ShipmentItem[]): number {
  return items.reduce((acc, it) => acc + it.requested_quantity, 0);
}
export function sumReceived(items: ShipmentItem[]): number {
  return items.reduce((acc, it) => acc + it.received_quantity, 0);
}
export function sumCredited(items: ShipmentItem[]): number {
  return items.reduce((acc, it) => acc + it.credited_quantity, 0);
}
