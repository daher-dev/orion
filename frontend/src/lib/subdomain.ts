/**
 * Lower-case kebab slug helper used by the onboarding wizard to auto-derive a
 * subdomain from the company name.
 *
 * Strips diacritics, collapses non-alnum runs to a single hyphen, trims
 * leading/trailing hyphens, and caps at 63 chars — matches the backend
 * `_SUBDOMAIN_RE` (`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`).
 *
 * Lives in `lib/` rather than `hooks/` so the unit tests don't transitively
 * pull in `next/navigation` (next-intl's createNavigation is React-only and
 * not safe to import in the plain node sweep that vitest does).
 */
export function deriveSubdomain(input: string): string {
  // Combining diacritical marks live in U+0300..U+036F — strip them after
  // NFD-decomposing the input so "André" → "andre".
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}
