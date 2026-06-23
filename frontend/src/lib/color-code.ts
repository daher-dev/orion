/**
 * Client-side color-code derivation, mirroring the backend `ColorCoder`
 * (backend/scripts/base44/mappings.py): a color name resolves to a stable,
 * unique 3-uppercase-letter code (`^[A-Z]{3}$`). Used by the inline "new color"
 * affordance so a brand-new palette color gets a sensible code without a server
 * round-trip; the user can still override it.
 */

/** Strip accents → uppercase → first 3 A–Z letters, padded with X. */
export function candidateColorCode(name: string): string {
  const letters = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return (letters + "XXX").slice(0, 3);
}

/** Bump a 3-letter code by one in base-26 (AAA → AAB → … → AAZ → ABA → …). */
function incrementCode(code: string): string {
  const n =
    ((code.charCodeAt(0) - 65) * 676 +
      (code.charCodeAt(1) - 65) * 26 +
      (code.charCodeAt(2) - 65) +
      1) %
    17576;
  return (
    String.fromCharCode(65 + Math.floor(n / 676)) +
    String.fromCharCode(65 + (Math.floor(n / 26) % 26)) +
    String.fromCharCode(65 + (n % 26))
  );
}

/** Derive a unique code for `name` that isn't already in `taken`. */
export function deriveColorCode(name: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  let code = candidateColorCode(name);
  while (used.has(code)) code = incrementCode(code);
  return code;
}
