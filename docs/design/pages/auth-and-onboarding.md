# Auth & Onboarding

## Public routes (no auth)

| Path | Purpose | Notes |
|---|---|---|
| `/[locale]` | Marketing / landing | Login CTA; replace placeholder home |
| `/[locale]/login` | Firebase email + Google sign-in | Redirect to `/dashboard` or `/onboarding` |
| `/[locale]/signup` | Create account → triggers onboarding | New Firebase user; creates a User row, no company yet |
| `/[locale]/accept-invite/[token]` | Join existing company via invite | Token issued by Admin; binds Firebase user to existing Company + Role |
| `/[locale]/forgot-password` | Firebase password reset | Standard flow |

## Onboarding (authenticated, no company yet)

`/[locale]/onboarding` — multi-step wizard. Triggered after signup if the user has no Company.

**Steps** (state in URL via `?step=`):

1. Company name + locale
2. Confirm seed roles (Admin / Manager / Operator)
3. Invite teammates (skippable)
4. Done → redirect to `/dashboard`

Creates the Company, makes the signup user the Admin, seeds default roles.
