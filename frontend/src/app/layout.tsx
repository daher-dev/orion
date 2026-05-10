import type { ReactNode } from "react";
import { Inter_Tight, Fraunces, JetBrains_Mono } from "next/font/google";

/*
 * Wire Orion typography via next/font so the warm typeface set is
 * available everywhere through the CSS variables consumed in globals.css.
 *
 * - Inter Tight → body
 * - Fraunces    → display headings (italic axis enabled for editorial feel)
 * - JetBrains Mono → code/numerics
 */

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export default function RootLayout({ children }: { children: ReactNode }) {
  // The locale-scoped layout (src/app/[locale]/layout.tsx) renders the actual
  // <html>/<body>. We can't wrap them here because that layout already does.
  // Inject the font variable classes via a wrapping <span> on a no-op fragment
  // is impossible at this level, so the font classes are applied in the
  // [locale]/layout.tsx via the FONT_VARIABLE_CLASSES export below.
  void interTight;
  void fraunces;
  void jetbrainsMono;
  return children;
}

/**
 * Font variable class names exported so the [locale]/layout.tsx can apply them
 * onto <html className=...>. next/font requires the call to happen during
 * module init, which only runs once when the module is imported — exporting
 * the joined class names lets us share the binding without re-instantiating.
 */
export const fontVariableClasses = [
  interTight.variable,
  fraunces.variable,
  jetbrainsMono.variable,
].join(" ");
