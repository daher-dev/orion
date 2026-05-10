"use client";

import { useMe } from "@/hooks/use-me";

/**
 * Returns true when the current user holds the given permission code.
 * Codes are <domain>.<action> strings, e.g. "orders.write".
 *
 * Pure UX courtesy — backend is the source of truth and will still 403
 * unauthorized requests.
 */
export function useCanAccess(code: string): boolean {
  const { data } = useMe();
  return data?.permissions?.includes(code) ?? false;
}

/** Variadic helper — true if user holds ALL listed permissions. */
export function useCanAll(...codes: string[]): boolean {
  const { data } = useMe();
  const perms = data?.permissions ?? [];
  return codes.every((c) => perms.includes(c));
}

/** Variadic helper — true if user holds AT LEAST ONE listed permission. */
export function useCanAny(...codes: string[]): boolean {
  const { data } = useMe();
  const perms = data?.permissions ?? [];
  return codes.some((c) => perms.includes(c));
}
