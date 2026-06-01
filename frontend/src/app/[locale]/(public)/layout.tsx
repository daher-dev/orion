import type { ReactNode } from "react";

/**
 * Layout for public/unauthenticated routes (login, access-denied,
 * accept-invite, forgot-password).
 *
 * The `data-orion-paper` attribute opts this surface into the paper-grain
 * radial-dot pattern wired in `globals.css` — same texture the app shell
 * uses, so the login screen feels like one continuous brand surface from the
 * first visit. The `--orion-bg` cream paint matches the rest of the app.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <main
      data-orion-paper
      className="flex min-h-screen items-center justify-center bg-[color:var(--orion-bg)] px-4 py-10"
    >
      {children}
    </main>
  );
}
