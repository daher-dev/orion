"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/hooks/use-api";
import { qk } from "@/lib/query-keys";
import type { ApiError } from "@/lib/api-client";
import type { UpsellerImportSummary } from "@/lib/schemas/orders-import";

const UPSELLER_PATH = "/v1/orders/import/upseller";

export type UpsellerImportInput = {
  file: File;
  /** `true` previews (strict-match without writing); `false` persists. */
  dryRun: boolean;
};

/**
 * Import the Upseller CSV into orders. The wizard calls this twice with
 * the same file: first with `dryRun: true` to preview the strict-match
 * summary (counts + unmatched rows), then with `dryRun: false` to persist.
 *
 * On a real (non-dry) run that created at least one order we invalidate
 * the orders cache so /orders reflects the new rows.
 */
export function useImportUpseller() {
  const api = useApi();
  const qc = useQueryClient();
  return useMutation<UpsellerImportSummary, ApiError, UpsellerImportInput>({
    mutationFn: ({ file, dryRun }: UpsellerImportInput) => {
      const formData = new FormData();
      formData.append("file", file, file.name);
      formData.append("dry_run", dryRun ? "true" : "false");
      return api.post<UpsellerImportSummary>(UPSELLER_PATH, formData);
    },
    onSuccess: (summary) => {
      if (!summary.dry_run && summary.created > 0) {
        void qc.invalidateQueries({ queryKey: qk.orders.all() });
      }
    },
  });
}
