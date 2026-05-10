"use client";

import type { ReactNode } from "react";
import { useCanAccess } from "@/hooks/use-permissions";

type CanProps = {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
};

/**
 * Conditionally renders children when the current user holds the permission.
 * UX-only — backend enforcement is the source of truth.
 */
export function Can({ permission, children, fallback = null }: CanProps) {
  const allowed = useCanAccess(permission);
  return <>{allowed ? children : fallback}</>;
}
