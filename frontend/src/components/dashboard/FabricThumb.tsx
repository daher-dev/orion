// Decorative fabric swatch — a 45° striped gradient, ported from the design
// prototype's `FabricThumb` (docs/design/ui.jsx). A product has no fabric
// colour in the data model, so the tone is derived deterministically from a
// seed (the product id) rather than carried on the wire.

const TONES = {
  warm: ["#f4d9b8", "#c2410c"],
  sand: ["#efe6d3", "#a16207"],
  moss: ["#d6dfd0", "#3a4a3d"],
  bone: ["#f4f1ea", "#7a7160"],
  stone: ["#dfd9cd", "#57534e"],
} as const;

export type FabricTone = keyof typeof TONES;

const TONE_KEYS = Object.keys(TONES) as FabricTone[];

/** Stable tone pick from a seed string (FNV-ish hash → tone index). */
export function toneFromSeed(seed: string): FabricTone {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return TONE_KEYS[hash % TONE_KEYS.length];
}

type Props = {
  /** Product id (or any string) used to deterministically pick a tone. */
  seed?: string;
  /** Explicit tone override. */
  tone?: FabricTone;
  /** Square size in px. */
  size?: number;
};

export function FabricThumb({ seed, tone, size = 40 }: Props) {
  const [light, dark] = TONES[tone ?? (seed ? toneFromSeed(seed) : "warm")];
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 rounded-[8px]"
      style={{
        width: size,
        height: size,
        background: `repeating-linear-gradient(135deg, ${light} 0 4px, ${dark}22 4px 8px)`,
        border: `1px solid ${dark}33`,
      }}
    />
  );
}
