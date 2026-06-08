import type { ReactNode } from "react";
import { ConsoleShell } from "@/components/console-shell";

/**
 * Layout for the Platform Console. The operator access gate + indigo chrome
 * live inside <ConsoleShell> (a client component) since they depend on the
 * Firebase auth state and the /v1/auth/me query.
 */
export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return <ConsoleShell>{children}</ConsoleShell>;
}
