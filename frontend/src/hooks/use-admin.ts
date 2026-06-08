"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";
import type { MemberPage } from "@/lib/schemas/member";

// ── Types (mirror backend schemas/admin.py) ──────────────────────────────

export type OverviewStats = {
  total_organizations: number;
  total_operators: number;
  total_members: number;
  orders_month: number;
};

export type OrgRow = {
  id: string;
  name: string;
  subdomain: string;
  accent: string;
  member_count: number;
  orders_month: number;
  created_at: string;
};

export type OrgList = { items: OrgRow[]; total: number };

export type OperatorRow = {
  id: string;
  name: string;
  email: string;
  company_id: string;
  company_name: string;
  role_name: string;
  created_at: string;
};

export type OperatorList = { items: OperatorRow[]; total: number };

export type OrgCreatePayload = {
  name: string;
  subdomain: string;
  main_color?: string;
  owner_email: string;
  owner_name?: string | null;
};

export type OrgCreateResponse = {
  organization: OrgRow;
  invite_token: string;
  owner_email: string;
};

export type ImpersonateResponse = {
  id: string;
  name: string;
  subdomain: string;
  main_color: string;
};

// ── Queries ───────────────────────────────────────────────────────────────

export function useAdminOverview(): UseQueryResult<OverviewStats, ApiError> {
  const api = useApi();
  return useQuery<OverviewStats, ApiError>({
    queryKey: qk.admin.overview(),
    queryFn: () => api.get<OverviewStats>("/v1/admin/overview"),
  });
}

export function useAdminOrganizations(): UseQueryResult<OrgList, ApiError> {
  const api = useApi();
  return useQuery<OrgList, ApiError>({
    queryKey: qk.admin.organizations(),
    queryFn: () => api.get<OrgList>("/v1/admin/organizations"),
  });
}

export function useAdminOrganization(id: string | null): UseQueryResult<OrgRow, ApiError> {
  const api = useApi();
  return useQuery<OrgRow, ApiError>({
    queryKey: qk.admin.organization(id ?? ""),
    enabled: !!id,
    queryFn: () => api.get<OrgRow>(`/v1/admin/organizations/${id}`),
  });
}

export function useAdminOrgMembers(id: string | null): UseQueryResult<MemberPage, ApiError> {
  const api = useApi();
  return useQuery<MemberPage, ApiError>({
    queryKey: qk.admin.orgMembers(id ?? ""),
    enabled: !!id,
    queryFn: () => api.get<MemberPage>(`/v1/admin/organizations/${id}/members`),
  });
}

export function useAdminOperators(): UseQueryResult<OperatorList, ApiError> {
  const api = useApi();
  return useQuery<OperatorList, ApiError>({
    queryKey: qk.admin.operators(),
    queryFn: () => api.get<OperatorList>("/v1/admin/users"),
  });
}

// ── Mutations ──────────────────────────────────────────────────────────────

export function useCreateOrganization() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<OrgCreateResponse, ApiError, OrgCreatePayload>({
    mutationFn: (payload) => api.post<OrgCreateResponse>("/v1/admin/organizations", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.admin.organizations() });
      void qc.invalidateQueries({ queryKey: qk.admin.overview() });
    },
  });
}

export function useImpersonate() {
  const api = useApi();
  return useMutation<ImpersonateResponse, ApiError, string>({
    mutationFn: (companyId) =>
      api.post<ImpersonateResponse>(`/v1/admin/organizations/${companyId}/impersonate`),
  });
}
