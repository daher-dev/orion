"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getLatestRelease, latestReleaseId } from "@/data/releases";

const STORAGE_KEY = "orion.seenRelease";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

// Server (and the hydration render) pretend the latest is already seen, so the
// dot/popup never appear in SSR HTML and there is no hydration mismatch; the
// real localStorage value takes over right after hydration.
function getServerSnapshot(): string | null {
  return latestReleaseId;
}

/**
 * Tracks which release the user has last seen (localStorage `orion.seenRelease`)
 * — shared by the top-bar "unseen" dot, the home announcement popup, and the
 * /novidades page (which marks the latest seen on visit). Backed by an external
 * store so it stays SSR-safe and reacts to writes from other tabs/components.
 */
export function useSeenRelease(locale: string) {
  const seenId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const markSeen = useCallback(() => {
    if (!latestReleaseId) return;
    try {
      localStorage.setItem(STORAGE_KEY, latestReleaseId);
    } catch {
      // ignore write failures (private mode)
    }
    listeners.forEach((listener) => listener());
  }, []);

  const hasUnseen = latestReleaseId != null && seenId !== latestReleaseId;

  return {
    latest: getLatestRelease(locale),
    latestId: latestReleaseId,
    hasUnseen,
    markSeen,
  };
}
