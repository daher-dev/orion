import { z } from "zod";

/**
 * Channel integration schemas.
 *
 * Mirrors the backend ``schemas/channel_integration.py`` read shapes. The read
 * schema deliberately has NO ``access_token`` / ``refresh_token`` — secrets
 * never reach the browser. Token/last-sync fields are nullable.
 */

export const channelStatusSchema = z.enum(["available", "connected", "error"]);
export type ChannelStatus = z.infer<typeof channelStatusSchema>;

export const channelSchema = z.object({
  channel: z.string(),
  label: z.string(),
  description: z.string(),
  group: z.string(),
  color: z.string(),
  fg: z.string(),
  status: channelStatusSchema,
  id: z.string().nullable().optional(),
  external_account_id: z.string().nullable().optional(),
  last_sync_at: z.string().nullable().optional(),
  token_expires_at: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
});
export type Channel = z.infer<typeof channelSchema>;

export const channelListSchema = z.object({
  items: z.array(channelSchema),
  connected: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export type ChannelList = z.infer<typeof channelListSchema>;

export const connectStartSchema = z.object({
  authorization_url: z.string(),
  state: z.string(),
  connected: z.boolean(),
});
export type ConnectStart = z.infer<typeof connectStartSchema>;

export const channelSyncResultSchema = z.object({
  channel: z.string(),
  last_sync_at: z.string(),
  imported: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  detail: z.string().nullable().optional(),
});
export type ChannelSyncResult = z.infer<typeof channelSyncResultSchema>;
