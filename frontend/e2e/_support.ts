/**
 * Shared E2E support: per-worker tenant isolation.
 *
 * Each Playwright worker process runs in its own tenant so specs can seed and
 * reset (`/v1/test-support/reset` is tenant-scoped) without colliding. The
 * worker's identity is derived from `TEST_PARALLEL_INDEX` (bounded to
 * [0, workers-1]); the matching companies/users are provisioned by
 * `backend/scripts/bootstrap_e2e_tenants.py`.
 *
 * Specs import `test`/`expect` (and the uid/headers) from here instead of
 * `@playwright/test`. The extended `test` injects the worker uid into every
 * browser context's localStorage, so the app authenticates as that tenant.
 */
import { test as base, expect } from "@playwright/test";

// Mirrors DEV_BYPASS_UID_KEY in frontend/src/lib/dev-bypass.ts (kept inline so
// the e2e tsconfig needn't resolve into src/).
const DEV_BYPASS_UID_KEY = "orion-dev-bypass-uid";

// Pre-mark the newest release "seen" (mirrors the latest id in
// src/data/releases.ts) so the post-login Novidades popup + top-bar dot never
// render in E2E — the fixed overlay would otherwise sit over the home screen.
// Bump this when a newer release is added.
const SEEN_RELEASE_KEY = "orion.seenRelease";
const LATEST_RELEASE_ID = "identidade-orion";

/** Playwright worker slot, bounded to [0, workers-1]. */
export const PARALLEL_INDEX = Number(process.env.TEST_PARALLEL_INDEX ?? "0");

/** This worker's dev-bypass identity — one provisioned tenant per worker. */
export const BYPASS_UID = `qa-dev-user-${PARALLEL_INDEX}`;
export const BYPASS_EMAIL = `qa-dev-${PARALLEL_INDEX}@orion.local`;

/** Dev-bypass headers for direct backend API calls (seeding/cleanup). */
export const BYPASS_HEADERS = {
  "X-Dev-Bypass-Uid": BYPASS_UID,
  "X-Dev-Bypass-Name": `QA Dev User ${PARALLEL_INDEX}`,
  "X-Dev-Bypass-Email": BYPASS_EMAIL,
} as const;

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const test = base.extend({
  // `provide` is Playwright's fixture-provide callback (Playwright conventionally
  // names it `use`, but that trips the react-hooks lint rule, which treats any
  // `use*` call in a non-component as a React hook).
  context: async ({ context }, provide) => {
    await context.addInitScript(
      ([uidKey, uid, seenKey, seenId]) => {
        window.localStorage.setItem(uidKey, uid);
        window.localStorage.setItem(seenKey, seenId);
      },
      [DEV_BYPASS_UID_KEY, BYPASS_UID, SEEN_RELEASE_KEY, LATEST_RELEASE_ID] as const,
    );
    await provide(context);
  },
});

export { expect };
export type { Page, Route, APIRequestContext, Locator } from "@playwright/test";
