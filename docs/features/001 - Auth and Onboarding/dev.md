# Implementation Log — FEATURE-001: Auth & Onboarding

## Files Created

### Pages
- `frontend/src/app/[locale]/(public)/signup/page.tsx` — stub coming-soon card.
- `frontend/src/app/[locale]/(public)/forgot-password/page.tsx` — stub coming-soon card.
- `frontend/src/app/[locale]/(public)/accept-invite/[token]/page.tsx` — invite
  acceptance page. Reads token from `use(params)`, fetches invite metadata,
  renders loading / invalid / valid states, calls `POST /accept` and routes
  to `/` on success.

### Components
- `frontend/src/components/auth/AuthCard.tsx` — shared shell (brand mark +
  title + sub + children + optional banner).
- `frontend/src/components/auth/GoogleButton.tsx` — "Continue with Google"
  secondary button with inline multicolor Google "G" SVG.
- `frontend/src/components/auth/PresetColorPicker.tsx` — 6-swatch picker
  (radiogroup) reused from settings/CompanyForm.

### Hooks
- `frontend/src/hooks/use-onboarding.ts` — `useCreateOnboardingCompany`,
  `useInvite`, `useAcceptInvite`. Each invalidates `qk.auth.me` on success so
  the AppShell re-fetches without a hard reload.

### Lib
- `frontend/src/lib/subdomain.ts` — `deriveSubdomain(input)` helper (extracted
  from the hook so the unit tests don't transitively import `next/navigation`
  via `useApi → useCompany → i18n/routing`).

### Tests
- `frontend/src/components/auth/__tests__/AuthCard.test.tsx`
- `frontend/src/components/auth/__tests__/PresetColorPicker.test.tsx`
- `frontend/src/lib/subdomain.test.ts` (slug derivation edge cases)
- `frontend/e2e/auth.spec.ts` — Playwright coverage for login dev-bypass,
  onboarding form + 409 inline error, accept-invite invalid + valid token.

### Spec
- `docs/features/001 - Auth and Onboarding/spec.md`

## Files Modified
- `frontend/src/app/[locale]/(public)/layout.tsx` — set the warm cream paper
  bg (`--orion-bg`) + `data-orion-paper` so the grain texture renders behind
  the centered card. Removed the inner `max-w-md` wrapper (`AuthCard` owns its
  own width).
- `frontend/src/app/[locale]/(public)/login/page.tsx` — replaced the stub with
  the full Firebase email/password + Google sign-in card.
- `frontend/src/app/[locale]/(public)/onboarding/page.tsx` — replaced the
  stub with the single-step company-creation wizard (auto-derived subdomain,
  6 preset colors, RHF + zod, inline 409 handling).
- `frontend/messages/en.json` + `frontend/messages/pt-BR.json` — replaced the
  flat `auth.{title,comingSoon,onboardingTitle,onboardingSubtitle}` placeholders
  with the structured `auth.{brand,login,signup,forgotPassword,onboarding,
  acceptInvite}` sub-namespaces from the spec.
- `docs/ROADMAP.md` — F-001 status → in-progress.

## Migration Notes
- None. Backend routes for auth were already in place from the foundation
  phase; no schema changes were needed.

## Dev Notes

### Dev-bypass first-class
The login page treats `NEXT_PUBLIC_DEV_BYPASS_AUTH=true` as a first-class UI
state, not an afterthought. A warning-coloured banner explains the situation,
inputs are disabled, and clicking "Entrar" simply pushes the router to "/" —
the AppShell + dev-bypass user then takes over. This is critical for the e2e
suite, which runs entirely in dev-bypass mode without a real Firebase
project.

### Subdomain auto-derivation
The onboarding wizard auto-derives the subdomain from the company name until
the user manually edits the subdomain field. Once they do, we stop the
auto-derivation (tracked via `subdomainEdited` state) so we don't blow away
their intent.

The derivation function lives in `lib/subdomain.ts` rather than
`hooks/use-onboarding.ts` — the hook imports `useApi`, which transitively
imports `next/navigation` via `i18n/routing`, which Vitest's jsdom env can't
resolve. Lifting the pure transformation into a lib file keeps the slug tests
plain-node.

### 409 → field error
We catch `ApiError` with `status === 409` in the onboarding submit handler
and call `form.setError("subdomain", ...)` to surface the inline error on the
subdomain field. The form stays open with the user's typed values intact so
they can amend the slug and resubmit.

### `<strong>` interpolation on accept-invite
The translated body uses literal `<strong>…</strong>` tags around the company
and role names. Rather than wire up next-intl's `rich` API for one place, the
page calls `dangerouslySetInnerHTML` with the result, escaping the variables
with a small `escapeHtml` helper. Defensible because:
  1. The `<strong>` wrapper is controlled by the translation key (us), not
     user input.
  2. Variable values come from the backend, which already constrains them at
     the DB layer — but we still escape them defensively.

### Why no separate `useOnboardingForm` hook
The wizard is a single-page form. RHF + zod inside the page component is
enough — extracting a hook for a one-call-site state machine would be
over-engineering for v1.

### Brand mark consistency
`AuthCard`'s brand mark uses the exact same construction as the sidebar's
`CompanySwitcher`: 32×32 rounded-lg indigo tile with a serif "U", "Orion"
wordmark, "por Underground" italic sub with the Orbit icon. This makes the
visual identity travel with the user from the public auth screens into the
authenticated app shell — same brand, different surface.

### What I deliberately skipped
- Real signup self-service (stub only — F-001 spec calls this out).
- Real password recovery (stub only).
- Multi-step onboarding wizard (single step per the spec's v1 simplification).
- Sending invite emails or inviting from inside the app (that's F-002 Members
  & Roles).
- A separate hook unit test file for `useCreateOnboardingCompany` etc. — the
  TanStack mutation wrappers are thin shims around `api.post` and don't carry
  their own logic worth covering. The e2e suite asserts the wire-level
  behaviour (request body, route after success, 409 handling).

### Verified visually
Used a Playwright screenshot helper against `localhost:3001` to verify:
  - /pt-BR/login — brand mark, dev-bypass banner, Fraunces title, indigo CTA,
    Google secondary, forgot/signup links.
  - /pt-BR/onboarding — wizard with auto-derived subdomain, 6 color swatches
    with the indigo default selected, primary "Criar empresa" button that
    inherits the picked color.
  - /pt-BR/accept-invite/bad-token — error card with "Esse convite não é mais
    válido." sub and "Voltar para entrar" link back to /login.
  - /pt-BR/signup + /pt-BR/forgot-password — stub coming-soon cards.
  - /en/login — full English locale renders cleanly.
