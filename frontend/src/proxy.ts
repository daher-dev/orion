import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

/*
 * Edge middleware — currently delegates entirely to next-intl for locale
 * detection and prefix handling.
 *
 * Auth check is intentionally NOT performed here. The (app) route group
 * mounts <AppShell>, which is a client component that:
 *   - reads the Firebase auth state
 *   - hits /v1/auth/me to load the User row + permissions
 *   - redirects to /login or /onboarding as appropriate
 *
 * Doing the redirect on the client lets us share dev-bypass behavior with
 * the rest of the app (Firebase is never even initialized when
 * NEXT_PUBLIC_DEV_BYPASS_AUTH=true). When we add a real session cookie, we
 * can revisit this and short-circuit unauthenticated requests at the edge.
 */

export default createMiddleware(routing);

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
