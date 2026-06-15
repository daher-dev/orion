import { Image as ImageIcon, ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Artwork-presence flag for an estampa variation/side — port of `PngFlag` from
 * the prototype `printing.jsx`. Green "PNG" when the side's artwork is uploaded
 * (`ok`), amber "sem PNG" otherwise. Gates the "mark printed = planned" quick
 * action in the side grid.
 */
type Props = {
  ok: boolean;
};

export function PngFlag({ ok }: Props) {
  const t = useTranslations("printOrders.detail");
  return (
    <span
      className="inline-flex items-center gap-[3px] text-[9.5px] font-semibold tracking-[0.02em]"
      style={{ color: ok ? "var(--status-ok)" : "var(--status-warn)" }}
    >
      {ok ? <ImageIcon size={10} /> : <ImageOff size={10} />}
      {ok ? t("pngOk") : t("pngMissing")}
    </span>
  );
}
