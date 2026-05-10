import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

/**
 * Layout for authenticated app routes. Auth/onboarding redirects are handled
 * inside <AppShell> (a client component) because they depend on the
 * Firebase auth state and the /v1/auth/me query — both of which are
 * client-only concerns under the dev-bypass model.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
