import type { ReactNode } from "react";

/**
 * Layout for public/unauthenticated routes (login, signup, onboarding,
 * accept-invite, forgot-password). Intentionally minimal — no app shell.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
