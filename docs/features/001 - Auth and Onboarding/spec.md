---
id: FEATURE-001
slug: auth-and-onboarding
title: Auth & Onboarding
status: in-progress
created: 2026-05-10
updated: 2026-05-10
branch: feature/001-auth
---

# FEATURE-001: Auth & Onboarding

## Problem Statement

A user who lands on Orion for the first time has nowhere to actually sign in,
create their company, or accept an invite. The foundation phase shipped the
backend auth router (`/v1/auth/me`, `/v1/auth/onboarding/companies`,
`/v1/auth/invites/{token}`, `/v1/auth/invites/{token}/accept`), the
`AuthProvider`, and the `AppShell`'s redirect logic — but the public-facing
pages (`/login`, `/onboarding`, `/accept-invite/[token]`) are stubs. This
feature delivers design-faithful, accessible, fully translated UI for the
first contact a user has with the product.

## User Stories

- As a new user, I want to sign in with email/password or Google so that I can
  reach the dashboard without thinking about how auth works.
- As a new user, when I've never seen Orion before, I want to create a company
  with a name, subdomain, and brand color so that I can start using the app
  right away.
- As an invited teammate, I want to follow the invite link and join the
  inviting company in one click so that I don't have to register a new account
  myself.
- As a developer running locally with `NEXT_PUBLIC_DEV_BYPASS_AUTH=true`, I
  want to see clearly that the bypass is active so I don't get confused when
  the inputs do nothing.

## Acceptance Criteria

1. [ ] Given an unauthenticated visitor lands on `/login`, when the page
       renders, then the design-faithful auth card appears with the
       Underground "U" 32×32 brand tile, the "Orion" serif wordmark, the
       italic "por Underground" sub, a 24–28 px Fraunces title, email +
       password inputs, the primary "Entrar" CTA, the "Continuar com Google"
       secondary CTA, the "Esqueceu a senha?" link, and the "Não tem conta?
       Criar conta" link.
2. [ ] Given `NEXT_PUBLIC_DEV_BYPASS_AUTH=true`, when `/login` renders, then a
       banner explains the dev-bypass is active and clicking "Entrar" routes
       to `/` without calling Firebase.
3. [ ] Given valid credentials and dev-bypass disabled, when the user submits
       the login form, then Firebase `signInWithEmailAndPassword` runs and on
       success the router pushes to `/`.
4. [ ] Given the user clicks "Continuar com Google", when dev-bypass is off,
       then Firebase `signInWithPopup(GoogleAuthProvider)` runs and on success
       the router pushes to `/`.
5. [ ] Given an authenticated user with no User row, when `AppShell` runs its
       guard, then the redirect lands on `/onboarding` and the wizard form
       renders.
6. [ ] Given the user types a company name on the onboarding form, when the
       subdomain field hasn't been manually edited, then the subdomain
       auto-derives as a slug (`[a-z0-9-]+`, max 64 chars).
7. [ ] Given the user picks a different swatch from the 6-color preset, when
       the page rerenders, then the selected swatch shows the active ring and
       the value is sent in `main_color` on submit.
8. [ ] Given a valid onboarding submission, when the API returns 201, then the
       user is routed to `/` and `useMe` is invalidated so the AppShell
       picks up the new company without a hard reload.
9. [ ] Given the backend returns 409 (subdomain taken), when the form catches
       the error, then an inline error appears on the subdomain field.
10. [ ] Given a user opens `/accept-invite/{token}` with an invalid or expired
        token, when the page mounts, then the API returns 404 and the page
        renders an error card with "Esse convite não é mais válido" + a link
        back to `/login`.
11. [ ] Given a valid invite, when the user clicks "Aceitar e entrar", then
        `POST /v1/auth/invites/{token}/accept` runs and on success the router
        pushes to `/`.
12. [ ] Given the user visits `/signup` or `/forgot-password`, then a stub
        "coming soon" card renders with a link back to `/login`.
13. [ ] Every user-facing string is sourced from `useTranslations()` and
        present in both `en.json` and `pt-BR.json` (verified by `pnpm
        i18n:lint`).

## User Flows

### Happy Path — First-time owner
1. Visitor lands on `/login`.
2. Visitor clicks "Continuar com Google" (or enters email/password).
3. Firebase authenticates; AuthProvider sets the user.
4. AppShell's effect runs `useMe()` → returns null user → redirect to
   `/onboarding`.
5. Visitor fills company name; subdomain auto-derives; picks indigo (default).
6. Visitor clicks "Criar empresa".
7. Backend creates the Company + admin User; response is 201.
8. Frontend invalidates `useMe`; AppShell re-renders → redirects to `/`.

### Happy Path — Invited teammate
1. Visitor clicks the invite link `/accept-invite/{token}`.
2. Page fetches `GET /v1/auth/invites/{token}` — shows company + role.
3. Visitor clicks "Aceitar e entrar".
4. Backend creates the User row in the inviting company; response is 200.
5. Frontend invalidates `useMe`; router pushes to `/`.

### Edge Cases
- Dev-bypass: inputs are read-only effectively; banner makes that obvious.
- Submitting onboarding with a subdomain that's already taken → 409 → inline
  field error, the form stays open with the user's typed values intact.
- Visiting `/accept-invite/{token}` where the token is expired, accepted, or
  unknown → error card, no accept button.
- Visiting `/onboarding` while signed out → redirect to `/login`.

## Scope

### In Scope
- `/login` — Firebase email + Google sign-in + dev-bypass banner.
- `/signup` — stub coming-soon card.
- `/forgot-password` — stub coming-soon card.
- `/onboarding` — single-step company creation wizard.
- `/accept-invite/[token]` — public invite-acceptance page.
- Shared `AuthCard`, `GoogleButton`, `PresetColorPicker` components.
- `useOnboarding` hook + Vitest unit tests + Playwright e2e for the wizard,
  invite-accept invalid-token, and login dev-bypass.

### Out of Scope
- Real "forgot password" reset flow (stub only).
- Real signup outside of onboarding (stub only).
- Multi-step onboarding wizard — v1 ships single-step.
- Sending invite emails — that's F-002 Members & Roles.
- Inviting from inside the app — also F-002.

## UI/UX Notes

Brand mark on every auth card:

- 32×32 rounded-lg tile, `bg-[#2563eb]` (the accent indigo), white serif
  weight-600 "U" (Underground sigil), inset shadow + soft outer glow.
- Serif 17 px "Orion" wordmark to the right of the tile, plus an italic 10.5
  px "por Underground" / "by Underground" sub line.

Auth card itself uses Orion's `.card` from design source:
- bg `var(--orion-surface)`, 1 px line border, 14 px radius, overflow hidden.
- Centered on the warm-cream paper bg (already wired via `--orion-grain`).
- Max width 420 px.
- Inner padding: 36 px top, 28 px sides, 30 px bottom (a little roomier than
  the table cards because there's less content density and we want it to feel
  airy).

Page title is `font-serif` 26 px, weight 400, tracking -.02 em; sub text is
13.5 px ink-3.

Inputs use `.field` rhythm: 11.5 px uppercase ink-3 labels, 8×11 padding
inputs, 6 px radius, focus ring on `var(--ring)`.

Primary button is `.btn-primary` styled: `bg-[#2563eb]`, white text, 7×13
padding, 6 px radius, inset highlight + outer shadow, accent-edge border.
Secondary buttons (Google) use `.btn` styling: surface bg, line border, ink
text.

Color presets (onboarding only) reuse the 6-swatch row from `settings.company`:
indigo (default), terracotta, teal, aubergine, amber, ink. The accent ring is
2 px surface + 4 px swatch-color when active.

## i18n Keys

Reuses `auth.signIn`, `auth.signUp`, `auth.email`, `auth.password`,
`auth.google`. Adds the sub-namespaces below in both `en.json` and
`pt-BR.json`. Drops the global `auth.title`, `auth.comingSoon`,
`auth.onboardingTitle`, `auth.onboardingSubtitle` placeholders.

| Key | EN | PT-BR |
|-----|-----|-------|
| `auth.brand.poweredBy` | by Underground | por Underground |
| `auth.login.title` | Sign in to Orion | Entrar no Orion |
| `auth.login.sub` | Welcome back. Pick a sign-in method to continue. | Bem-vindo de volta. Escolha um método de login para continuar. |
| `auth.login.devBypassBanner` | Dev-bypass auth is active. Sign-in inputs are ignored — click "Sign in" to enter as the configured dev user. | Auth dev-bypass está ativo. Os campos são ignorados — clique em "Entrar" para acessar como o usuário dev configurado. |
| `auth.login.submit` | Sign in | Entrar |
| `auth.login.submitting` | Signing in… | Entrando… |
| `auth.login.forgotPassword` | Forgot your password? | Esqueceu a senha? |
| `auth.login.noAccount` | Don't have an account? | Não tem conta? |
| `auth.login.createAccount` | Sign up | Criar conta |
| `auth.login.errors.invalidCredentials` | Email or password is incorrect. | E-mail ou senha incorretos. |
| `auth.login.errors.popupBlocked` | Pop-up was blocked. Allow pop-ups and try again. | A janela foi bloqueada. Permita pop-ups e tente novamente. |
| `auth.login.errors.generic` | Could not sign in. Try again. | Não foi possível entrar. Tente novamente. |
| `auth.signup.title` | Create your account | Criar sua conta |
| `auth.signup.comingSoon` | Account self-service is coming soon. Ask your team owner to send you an invite. | O cadastro autônomo chega em breve. Peça ao dono do time para te enviar um convite. |
| `auth.signup.backToLogin` | Back to sign in | Voltar para entrar |
| `auth.forgotPassword.title` | Forgot your password? | Esqueceu a senha? |
| `auth.forgotPassword.comingSoon` | Password recovery is coming soon. Reach out to support to reset your password. | Recuperação de senha chega em breve. Fale com o suporte para redefinir sua senha. |
| `auth.forgotPassword.backToLogin` | Back to sign in | Voltar para entrar |
| `auth.onboarding.title` | Create your company | Criar sua empresa |
| `auth.onboarding.sub` | Just a few details so we can set up your workspace. | Só alguns dados para preparar seu workspace. |
| `auth.onboarding.labels.companyName` | Company name | Nome da empresa |
| `auth.onboarding.labels.subdomain` | Subdomain | Subdomínio |
| `auth.onboarding.labels.mainColor` | Main color | Cor principal |
| `auth.onboarding.placeholders.companyName` | e.g. Underground Apparel | ex. Underground Apparel |
| `auth.onboarding.placeholders.subdomain` | underground-apparel | underground-apparel |
| `auth.onboarding.helpers.subdomainDerivation` | Used in your tenant URL. We derive it from the company name — feel free to override. | Usado na URL do seu workspace. Derivamos do nome da empresa — você pode alterar. |
| `auth.onboarding.validation.nameRequired` | Company name is required | Nome da empresa é obrigatório |
| `auth.onboarding.validation.subdomainRequired` | Subdomain is required | Subdomínio é obrigatório |
| `auth.onboarding.validation.subdomainSlug` | Use lowercase letters, numbers, and hyphens only. | Use apenas letras minúsculas, números e hifens. |
| `auth.onboarding.validation.subdomainTaken` | This subdomain is already in use. | Este subdomínio já está em uso. |
| `auth.onboarding.submit` | Create company | Criar empresa |
| `auth.onboarding.submitting` | Creating… | Criando… |
| `auth.onboarding.toasts.created` | Company created | Empresa criada |
| `auth.onboarding.toasts.error` | Could not create your company. | Não foi possível criar sua empresa. |
| `auth.acceptInvite.title` | You're invited | Você foi convidado |
| `auth.acceptInvite.body` | You've been invited to join **{companyName}** as **{roleName}**. | Você foi convidado para a empresa **{companyName}** como **{roleName}**. |
| `auth.acceptInvite.accept` | Accept and sign in | Aceitar e entrar |
| `auth.acceptInvite.decline` | Cancel | Cancelar |
| `auth.acceptInvite.errors.invalid` | This invite is no longer valid. | Esse convite não é mais válido. |
| `auth.acceptInvite.errors.expired` | This invite has expired. | Esse convite expirou. |
| `auth.acceptInvite.errors.alreadyAccepted` | This invite has already been accepted. | Esse convite já foi aceito. |
| `auth.acceptInvite.errors.generic` | Could not accept the invite. | Não foi possível aceitar o convite. |
| `auth.acceptInvite.loading` | Loading invite… | Carregando convite… |
| `auth.acceptInvite.backToLogin` | Back to sign in | Voltar para entrar |

## API Contract

| Method | Path | Request Body | Response | Purpose |
|--------|------|-------------|----------|---------|
| GET | `/v1/auth/me` | — | `{user, company, role, permissions, companies}` (200) | Drive AppShell guard. |
| POST | `/v1/auth/onboarding/companies` | `{company_name, subdomain, main_color?}` | `{company, user, role}` (201) | Create the user's first company. |
| GET | `/v1/auth/invites/{token}` | — | `{email, company_name, role_name, expires_at}` (200) or 404 | Public invite metadata. |
| POST | `/v1/auth/invites/{token}/accept` | `{name?}` | `{company, user, role}` (200) | Accept the invite and seed a User in the inviting company. |

## Seed Data Requirements

- The dev-bypass user (UID `qa-dev-user`) signs in cleanly; if no User row
  exists, the `/onboarding` flow can create the first company.
- For the invite-accept tests we don't need a real invite — the page just
  asserts that an invalid token surfaces the error card. A second test (left
  out of v1, parked for F-002) would seed a real invite via the API.
