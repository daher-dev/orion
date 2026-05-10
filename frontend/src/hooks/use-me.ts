"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";

export type MeUser = {
  id: string;
  firebase_uid: string;
  display_name: string | null;
  email: string | null;
  is_operator: boolean;
};

export type MeCompany = {
  id: string;
  name: string;
  subdomain: string;
  main_color?: string | null;
};

export type MeRole = {
  id: string;
  name: string;
};

export type MeCompanyMembership = {
  id: string;
  name: string;
  role: string;
};

export type MeResponse = {
  user: MeUser | null;
  company: MeCompany | null;
  role: MeRole | null;
  permissions: string[];
  companies: MeCompanyMembership[];
};

const EMPTY_ME: MeResponse = {
  user: null,
  company: null,
  role: null,
  permissions: [],
  companies: [],
};

/**
 * Hook into GET /v1/auth/me. Returns null-shaped data when the user isn't
 * onboarded yet (backend returns 404 for not-found user). Stale time is 5 min
 * because auth/permission state changes rarely.
 */
export function useMe(): UseQueryResult<MeResponse, ApiError> {
  const api = useApi();
  const { user, loading } = useAuth();

  return useQuery<MeResponse, ApiError>({
    queryKey: qk.auth.me(),
    enabled: !loading && !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      try {
        return await api.get<MeResponse>("/v1/auth/me");
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          // No user row yet — onboarding flow hasn't completed.
          return EMPTY_ME;
        }
        throw err;
      }
    },
  });
}
