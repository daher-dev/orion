/**
 * Minimal, dependency-free QR Code generator (byte mode, ECC level M).
 *
 * Produces a real, scannable QR matrix so the printed separation label's QR
 * encodes the piece `tracking_code` and reads straight back into the
 * scan-check endpoint. We avoid adding a runtime dependency (`qrcode`) by
 * implementing the subset we need: byte-mode encoding, Reed-Solomon error
 * correction, mask 0, and matrix construction for versions 1–10 (enough for a
 * ~30-char tracking code).
 *
 * Adapted from the public-domain QR algorithm; kept compact and pure so it can
 * run in RSC, the browser, and jsdom tests alike. `qrMatrix` returns a square
 * boolean grid (true = dark module).
 */

// ─────────────────────────── Galois field (GF(256)) ───────────────────────────
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

const gfMul = (a: number, b: number): number =>
  a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]];

/**
 * RS generator polynomial of the given degree, leading coefficient first
 * (`poly[0]` = x^degree term = 1). Built as the product of (x - α^i).
 */
function rsGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]; // shift up by x
      next[j + 1] ^= gfMul(poly[j], EXP[i]); // multiply by α^i
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data: number[], ecLen: number): number[] {
  const gen = rsGeneratorPoly(ecLen); // length ecLen+1, gen[0] === 1
  const res = new Array<number>(ecLen).fill(0);
  for (const byte of data) {
    const factor = byte ^ res[0];
    res.shift();
    res.push(0);
    // Skip the leading 1 (gen[0]); align the remaining gen[1..ecLen] with res.
    for (let i = 0; i < ecLen; i++) res[i] ^= gfMul(gen[i + 1], factor);
  }
  return res;
}

// ─── Version capacity (byte mode, ECC level M): data codewords + EC per block ──
// [version] = { ecPerBlock, group1Blocks, group1Data, group2Blocks, group2Data }
type VersionSpec = {
  ec: number;
  g1: number;
  d1: number;
  g2: number;
  d2: number;
};

// Versions 1–6 only. v7+ additionally require an 18-bit "version information"
// block we don't render, so we deliberately stop at v6 — verified byte-identical
// to the reference `qrcode` library. A v6 byte-mode QR holds 108 data codewords
// (~106 chars), far above our ~24-char tracking codes, so this never throws in
// practice; capping prevents silently emitting a malformed (unscannable) QR.
const VERSIONS_M: Record<number, VersionSpec> = {
  1: { ec: 10, g1: 1, d1: 16, g2: 0, d2: 0 },
  2: { ec: 16, g1: 1, d1: 28, g2: 0, d2: 0 },
  3: { ec: 26, g1: 1, d1: 44, g2: 0, d2: 0 },
  4: { ec: 18, g1: 2, d1: 32, g2: 0, d2: 0 },
  5: { ec: 24, g1: 2, d1: 43, g2: 0, d2: 0 },
  6: { ec: 16, g1: 4, d1: 27, g2: 0, d2: 0 },
};

const MAX_VERSION = 6;

const ALIGNMENT_CENTERS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
};

function totalDataCodewords(v: VersionSpec): number {
  return v.g1 * v.d1 + v.g2 * v.d2;
}

function pickVersion(byteLen: number): { version: number; spec: VersionSpec } {
  for (let version = 1; version <= MAX_VERSION; version++) {
    const spec = VERSIONS_M[version];
    // header = 4 bits mode + 8-bit char count indicator (byte mode, v1–9).
    const ccBits = 8;
    const dataBits = 4 + ccBits + byteLen * 8;
    if (Math.ceil(dataBits / 8) <= totalDataCodewords(spec)) {
      return { version, spec };
    }
  }
  throw new Error("QR payload too long for supported versions (max v6)");
}

function buildDataCodewords(text: string): {
  version: number;
  codewords: number[];
} {
  const bytes = Array.from(new TextEncoder().encode(text));
  const { version, spec } = pickVersion(bytes.length);
  const ccBits = 8; // byte mode, versions 1–9 use an 8-bit char-count indicator
  const capacity = totalDataCodewords(spec);

  // Bit buffer: mode (0100 = byte), char count, data, terminator, padding.
  const bits: number[] = [];
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, ccBits);
  for (const b of bytes) push(b, 8);

  const capacityBits = capacity * 8;
  // Terminator (up to 4 zero bits).
  for (let i = 0; i < 4 && bits.length < capacityBits; i++) bits.push(0);
  // Pad to a byte boundary.
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  // Pad bytes alternating 0xEC / 0x11.
  const padBytes = [0xec, 0x11];
  let p = 0;
  while (codewords.length < capacity) codewords.push(padBytes[p++ % 2]);

  return { version, codewords };
}

function interleave(dataCodewords: number[], spec: VersionSpec): number[] {
  // Split into blocks, compute EC per block, then interleave per spec.
  const blocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  const layout: { count: number; data: number }[] = [
    { count: spec.g1, data: spec.d1 },
  ];
  if (spec.g2 > 0) layout.push({ count: spec.g2, data: spec.d2 });

  for (const grp of layout) {
    for (let i = 0; i < grp.count; i++) {
      const block = dataCodewords.slice(offset, offset + grp.data);
      offset += grp.data;
      blocks.push(block);
      ecBlocks.push(rsEncode(block, spec.ec));
    }
  }

  const result: number[] = [];
  const maxData = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) {
    for (const block of blocks) if (i < block.length) result.push(block[i]);
  }
  for (let i = 0; i < spec.ec; i++) {
    for (const ec of ecBlocks) result.push(ec[i]);
  }
  return result;
}

// ─────────────────────────── matrix construction ───────────────────────────
function buildMatrix(version: number, finalCodewords: number[]): boolean[][] {
  const size = 17 + version * 4;
  const modules: (boolean | null)[][] = Array.from({ length: size }, () =>
    new Array<boolean | null>(size).fill(null),
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );

  const setFn = (r: number, c: number, dark: boolean, isReserved = true) => {
    modules[r][c] = dark;
    if (isReserved) reserved[r][c] = true;
  };

  // Finder patterns + separators.
  const placeFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r;
        const cc = col + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inner =
          r >= 0 && r <= 6 && c >= 0 && c <= 6
            ? r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)
            : false;
        setFn(rr, cc, inner);
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Timing patterns.
  for (let i = 8; i < size - 8; i++) {
    setFn(6, i, i % 2 === 0);
    setFn(i, 6, i % 2 === 0);
  }

  // Alignment patterns.
  const centers = ALIGNMENT_CENTERS[version];
  for (const r of centers) {
    for (const c of centers) {
      // Skip those overlapping finder patterns.
      const nearFinder =
        (r <= 7 && c <= 7) ||
        (r <= 7 && c >= size - 8) ||
        (r >= size - 8 && c <= 7);
      if (nearFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark =
            Math.max(Math.abs(dr), Math.abs(dc)) !== 1; // ring + center dark
          setFn(r + dr, c + dc, dark);
        }
      }
    }
  }

  // Dark module (always set, always reserved).
  setFn(size - 8, 8, true);

  // Reserve the two format-information strips (filled after data placement).
  // Canonical coordinates for the 15 format bits around the finders — these
  // exactly match the QR spec so the data walk skips precisely these cells.
  const formatCoords: [number, number][][] = (() => {
    const a: [number, number][] = []; // copy 1 (around top-left finder)
    const b: [number, number][] = []; // copy 2 (top-right + bottom-left)
    // Copy 1 — horizontal strip on row 8, then vertical strip on col 8.
    for (let i = 0; i <= 5; i++) a.push([8, i]);
    a.push([8, 7]);
    a.push([8, 8]);
    a.push([7, 8]);
    for (let i = 5; i >= 0; i--) a.push([i, 8]);
    // Copy 2 — vertical strip up the right side, then horizontal along bottom.
    for (let i = 0; i <= 6; i++) b.push([size - 1 - i, 8]);
    for (let i = 7; i <= 14; i++) b.push([8, size - 15 + i]);
    return [a, b];
  })();
  for (const strip of formatCoords) {
    for (const [r, c] of strip) reserved[r][c] = true;
  }

  // Place data with the zigzag walk, applying mask 0 ((r+c) % 2 === 0).
  let bitIndex = 0;
  const totalBits = finalCodewords.length * 8;
  const getBit = (idx: number) =>
    idx < totalBits ? (finalCodewords[idx >> 3] >> (7 - (idx & 7))) & 1 : 0;

  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // skip the vertical timing column
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i;
      for (let c = 0; c < 2; c++) {
        const cc = col - c;
        if (reserved[row][cc]) continue;
        let dark = getBit(bitIndex) === 1;
        bitIndex++;
        if ((row + cc) % 2 === 0) dark = !dark; // mask 0
        modules[row][cc] = dark;
      }
    }
    upward = !upward;
  }

  // Format information: ECC level M (00) + mask 0 → 15-bit BCH string 0x5412.
  // Bit i (i=0..14) maps to the i-th coordinate of each strip; bit 14 is the
  // MSB so we read from the high end downward as we walk the canonical order.
  const formatBits = 0x5412;
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >> (14 - i)) & 1) === 1;
    const [r1, c1] = formatCoords[0][i];
    const [r2, c2] = formatCoords[1][i];
    modules[r1][c1] = bit;
    modules[r2][c2] = bit;
  }

  return modules.map((r) => r.map((cell) => cell === true));
}

/** Returns the QR matrix (square boolean grid, true = dark) for `text`. */
export function qrMatrix(text: string): boolean[][] {
  const safe = text && text.length > 0 ? text : " ";
  const { version, codewords } = buildDataCodewords(safe);
  const spec = VERSIONS_M[version];
  const interleaved = interleave(codewords, spec);
  return buildMatrix(version, interleaved);
}
