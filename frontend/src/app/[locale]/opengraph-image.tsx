import { ImageResponse } from "next/og";
import { orionMarkSvg, svgToDataUri } from "@/lib/brand-mark";

// 1200×630 share card — the Star silhouette + wordmark + tagline on Carvão,
// per the brand sheet's "Card de compartilhamento". Fraunces is fetched at
// request time; if the fetch fails the card falls back to the mark alone.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Orion — SaaS para confecção";

const TAGLINE: Record<string, string> = {
  en: "SaaS for apparel manufacturing",
  "pt-BR": "SaaS para confecção",
};

async function loadFraunces(text: string): Promise<ArrayBuffer | null> {
  try {
    const url =
      "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400&text=" +
      encodeURIComponent(text);
    const css = await (await fetch(url)).text();
    const src = css.match(/src:\s*url\(([^)]+)\)\s*format/);
    if (!src) return null;
    const res = await fetch(src[1]);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const tagline = TAGLINE[locale] ?? TAGLINE.en;
  const markSrc = svgToDataUri(orionMarkSvg(132, "#f5efe0"));
  const font = await loadFraunces("Orion" + tagline);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#1c1812",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          gap: 32,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={markSrc} width={132} height={139} alt="" />
        {font ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                fontFamily: "Fraunces",
                fontSize: 108,
                color: "#f5efe0",
                lineHeight: 1,
                letterSpacing: -4,
              }}
            >
              Orion
            </div>
            <div style={{ fontFamily: "Fraunces", fontSize: 34, color: "#b8ad95" }}>
              {tagline}
            </div>
          </div>
        ) : null}
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: "Fraunces", data: font, weight: 400, style: "normal" }] : [],
    },
  );
}
