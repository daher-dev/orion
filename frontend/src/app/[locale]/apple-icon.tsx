import { ImageResponse } from "next/og";
import { orionAppIconSvg, svgToDataUri } from "@/lib/brand-mark";

// Apple touch icon — 180×180, the canonical Ink tile + Star orbit mark. iOS
// applies its own rounded mask, so the tile fills the square edge to edge.
// Lives under [locale] so the next-intl middleware (which locale-routes
// extensionless paths) doesn't 404 it.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  const src = svgToDataUri(orionAppIconSvg(180));
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%" }}>
        <img src={src} width={180} height={180} alt="Orion" />
      </div>
    ),
    { ...size },
  );
}
