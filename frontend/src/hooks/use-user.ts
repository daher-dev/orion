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
import type { UserRead, UserUpdate } from "@/lib/schemas/user";

/**
 * GET /v1/users/me — current user with role attached. Separate from `useMe`
 * (which composes user + company + memberships); this returns the canonical
 * editable User profile shape.
 */
export function useMyUser(): UseQueryResult<UserRead, ApiError> {
  const api = useApi();
  return useQuery<UserRead, ApiError>({
    queryKey: qk.settings.profile(),
    queryFn: () => api.get<UserRead>("/v1/users/me"),
  });
}

export function useUpdateUserSelf() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<UserRead, ApiError, UserUpdate>({
    mutationFn: (payload) => api.patch<UserRead>("/v1/users/me", payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.auth.me() });
      qc.invalidateQueries({ queryKey: qk.settings.profile() });
    },
  });
}
