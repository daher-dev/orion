"use client";

import { useMutation } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import type { ApiError } from "@/lib/api-client";
import type { MeResponse } from "@/hooks/use-me";

/**
 * Establish (or provision) the backend session for the signed-in Firebase
 * identity via `POST /v1/auth/session`. Returns the membership envelope when the
 * caller is already a member or has a matching pending invite (auto-accepted
 * server-side); the request fails with 403 `not_invited` otherwise. This is the
 * login gate — there is no self-signup.
 */
export function useEstablishSession() {
  const api = useApi();
  return useMutation<MeResponse, ApiError, void>({
    mutationFn: () => api.post<MeResponse>("/v1/auth/session"),
  });
}
