"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import { useApi } from "@/hooks/use-api";
import type { ApiError } from "@/lib/api-client";
import type { InviteCreate, InvitePage, InviteRead } from "@/lib/schemas/invite";
import { qk } from "@/lib/query-keys";

export function useInvites(): UseQueryResult<InvitePage, ApiError> {
  const api = useApi();
  return useQuery<InvitePage, ApiError>({
    queryKey: qk.invites.list({}),
    queryFn: () => api.get<InvitePage>("/v1/invites"),
  });
}

export function useCreateInvite() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<InviteRead, ApiError, InviteCreate>({
    mutationFn: (payload) => api.post<InviteRead>("/v1/invites", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.invites.lists() });
    },
  });
}

export function useRevokeInvite() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<void, ApiError, string>({
    mutationFn: (id) => api.delete<void>(`/v1/invites/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.invites.lists() });
    },
  });
}

// --- Public invite-acceptance flow (unauthenticated /accept-invite/[token]) ---

/** Public invite payload returned by `GET /v1/auth/invites/{token}`. */
export type InvitePublic = {
  email: string;
  company_name: string;
  role_name: string;
  expires_at: string;
};

/** Membership envelope returned by `POST /v1/auth/invites/{token}/accept`. */
export type InviteAcceptResponse = {
  company: { id: string; name: string; subdomain: string; main_color: string };
  user: { id: string; name: string; email: string; is_operator: boolean };
  role: { id: string; code: string; name: string; description: string | null };
};

/**
 * Fetch the public invite metadata. We keep `retry: false` so a 404 surfaces
 * immediately — the accept page differentiates between "loading" and "invalid"
 * states using `isPending` / `isError`.
 */
export function useInvite(token: string | undefined) {
  const api = useApi();
  return useQuery<InvitePublic, ApiError>({
    queryKey: ["auth", "invites", token ?? ""],
    enabled: !!token,
    retry: false,
    staleTime: 30_000,
    queryFn: () => api.get<InvitePublic>(`/v1/auth/invites/${token}`),
  });
}

/**
 * Accept an invite. Body is `{name?}` per the backend schema — v1 sends an
 * empty body so the backend uses the Firebase display name.
 */
export function useAcceptInvite(token: string | undefined) {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<InviteAcceptResponse, ApiError, { name?: string }>({
    mutationFn: (payload) =>
      api.post<InviteAcceptResponse>(`/v1/auth/invites/${token}/accept`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.auth.me() });
    },
  });
}
