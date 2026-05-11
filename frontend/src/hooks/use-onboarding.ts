"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";

export { deriveSubdomain } from "@/lib/subdomain";

/** Payload sent to `POST /v1/auth/onboarding/companies`. */
export type OnboardingPayload = {
  company_name: string;
  subdomain: string;
  main_color: string;
};

export type OnboardingResponse = {
  company: { id: string; name: string; subdomain: string; main_color: string };
  user: { id: string; name: string; email: string; is_operator: boolean };
  role: { id: string; code: string; name: string; description: string | null };
};

/** Public invite payload returned by `GET /v1/auth/invites/{token}`. */
export type InvitePublic = {
  email: string;
  company_name: string;
  role_name: string;
  expires_at: string;
};

export type InviteAcceptResponse = OnboardingResponse;

/**
 * Create the user's first company. We invalidate `qk.auth.me` so the
 * `AppShell`'s `useMe` re-fetches without a hard reload, which is what lets
 * the post-submit `router.push("/")` end up on the dashboard instead of
 * looping back into `/onboarding`.
 */
export function useCreateOnboardingCompany() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<OnboardingResponse, ApiError, OnboardingPayload>({
    mutationFn: (payload) =>
      api.post<OnboardingResponse>("/v1/auth/onboarding/companies", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.auth.me() });
    },
  });
}

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

