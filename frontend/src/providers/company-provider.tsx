"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@/i18n/routing";

const STORAGE_KEY = "orion.companyId";

type CompanyContextValue = {
  companyId: string | null;
  setCompanyId: (id: string | null) => void;
};

const CompanyContext = createContext<CompanyContextValue | null>(null);

// Hydrate from localStorage via useSyncExternalStore — this avoids the
// "setState in effect" anti-pattern and keeps SSR + client in sync.
function subscribeToStorage(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function readStoredCompanyId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const companyId = useSyncExternalStore(
    subscribeToStorage,
    readStoredCompanyId,
    () => null,
  );

  const setCompanyId = useCallback(
    (id: string | null) => {
      if (typeof window !== "undefined") {
        if (id) window.localStorage.setItem(STORAGE_KEY, id);
        else window.localStorage.removeItem(STORAGE_KEY);
        // localStorage's "storage" event fires across tabs only — manually
        // dispatch one so this tab's useSyncExternalStore subscribers wake up.
        window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
      }
      // Clear all caches on tenant switch — query keys typically don't include
      // the company id, so we wipe the cache and let pages refetch.
      queryClient.clear();
      router.refresh();
    },
    [queryClient, router],
  );

  const value = useMemo<CompanyContextValue>(
    () => ({ companyId, setCompanyId }),
    [companyId, setCompanyId],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within <CompanyProvider>");
  return ctx;
}
