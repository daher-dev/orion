# Settings

`/[locale]/settings`

**Layout:** secondary sidebar inside Settings. Most items Admin-only.

| Sub-page | Path | Audience | What's there |
|---|---|---|---|
| Company profile | `/settings/company` | Admin (write), Manager (read) | Name, logo, locale default, currency, timezone |
| Members | `/settings/members` | Admin (write), Manager (read) | User table, invite flow (creates `accept-invite` token), role picker per member, deactivate |
| Roles | `/settings/roles` | Admin (write), Manager (read) | List default roles + create custom. Permission matrix UI: rows = domains (orders, cutting, …), cols = read/write |
| Billing | `/settings/billing` | Admin | Plan, seats, invoices. Stub — flagged as v2 |
| Audit log | `/settings/audit-log` | Admin (write), Manager (read) | Filterable table: who/what/when. Drill into resource |
| Integrations | `/settings/integrations` | Admin | Channel webhook tokens (Shopee, ML, Shopify), API keys. ⚠ No backing model yet — needs backend feature first |
| Profile | `/settings/profile` | All | Personal: name, avatar, language, password change, sessions |
| Notifications | `/settings/notifications` | All | Email / in-app toggles per event type. ⚠ No backing model yet — needs backend feature first |
