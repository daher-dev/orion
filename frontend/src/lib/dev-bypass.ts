/**
 * Dev-bypass identity resolution.
 *
 * The dev-bypass uid normally comes from the build-time `NEXT_PUBLIC_DEV_BYPASS_UID`
 * env (one value for the whole bundle). Parallel Playwright workers each need a
 * DIFFERENT identity (one tenant per worker), so they write a per-browser-context
 * override into `localStorage` (via `addInitScript`) that takes precedence here.
 * Non-E2E local dev has no override and falls back to the env value.
 */

export const DEV_BYPASS_UID_KEY = "orion-dev-bypass-uid";

export function resolveDevBypassUid(): string | undefined {
  if (typeof window !== "undefined") {
    try {
      const override = window.localStorage.getItem(DEV_BYPASS_UID_KEY);
      if (override) return override;
    } catch {
      // localStorage can throw (SSR, sandboxed iframe) — fall through to env.
    }
  }
  return process.env.NEXT_PUBLIC_DEV_BYPASS_UID;
}
