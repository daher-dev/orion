"use client";

import { useMemo } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useCompany } from "@/providers/company-provider";
import { createApiClient, type ApiClient } from "@/lib/api-client";

/**
 * Returns an ApiClient bound to the current auth + tenant context.
 *
 * The returned object is memoized on the (uid, companyId) pair so it's
 * stable enough to use in hook dependency arrays.
 */
export function useApi(): ApiClient {
  const { user, getIdToken } = useAuth();
  const { companyId } = useCompany();

  return useMemo<ApiClient>(
    () =>
      createApiClient({
        getIdToken,
        companyId,
        devBypass: user
          ? { uid: user.uid, name: user.displayName, email: user.email }
          : null,
      }),
    [user, companyId, getIdToken],
  );
}
