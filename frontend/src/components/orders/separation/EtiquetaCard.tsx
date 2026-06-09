"use client";

import { useMemo } from "react";
import { Palette } from "lucide-react";
import { qrMatrix } from "@/lib/qr";
import { variantColor } from "@/lib/variant-color";
import type { SeparationLabel } from "@/lib/schemas/separation";

/**
 * On-screen preview of the printed 100×50mm separation label.
 *
 * Ports the design's `EtiquetaCard` from `/docs/design/pages/separacao.jsx`,
 * but replaces the design's `FakeQR` with a REAL, scannable QR encoding the
 * piece's `tracking_code` (via `qrMatrix`). The HTML print version lives in
 * `print-separation-labels.ts`; this component is the interactive preview.
 */
type Props = {
  label: SeparationLabel;
};

/** Inline SVG QR rendered from the boolean matrix (true = dark module). */
function QrSvg({ data, size = 104 }: { data: string; size?: number }) {
  const { n, path } = useMemo(() => {
    const matrix = qrMatrix(data || " ");
    const count = matrix.length;
    let d = "";
    for (let y = 0; y < count; y++) {
      for (let x = 0; x < count; x++) {
        if (matrix[y][x]) d += `M${x} ${y}h1v1h-1z`;
      }
    }
    return { n: count, path: d };
  }, [data]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${n} ${n}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={`QR ${data}`}
      data-testid="etiqueta-qr"
      style={{ display: "block" }}
    >
      <rect width={n} height={n} fill="#fff" />
      <path d={path} fill="#111" />
    </svg>
  );
}

export function EtiquetaCard({ label }: Props) {
  const sku = label.sku ?? label.tracking_code;
  const size = label.size ? label.size.toUpperCase() : null;

  return (
    <div
      data-testid="etiqueta-card"
      className="flex aspect-[2/1] w-full max-w-[480px] flex-col rounded-[10px] border border-[color:var(--orion-line)] bg-white px-[15px] py-[13px] text-[#111] shadow-[var(--shadow-sm,0_1px_2px_rgba(31,27,21,0.08))]"
    >
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="text-[9px] font-bold tracking-[0.12em] text-[#9a9a92]">
            PEDIDO
          </div>
          <div className="font-serif text-[23px] font-semibold leading-[1.04] tracking-[-0.01em] text-[#111]">
            {label.order_code}
          </div>
          {label.product_name ? (
            <div className="mt-[5px] mb-2 line-clamp-2 text-[11px] leading-[1.3] text-[#222]">
              {label.product_name}
            </div>
          ) : null}
          <div className="mt-auto flex items-center gap-2">
            {label.color ? (
              <span className="inline-flex items-center gap-[5px] rounded-[5px] bg-[#f0ede6] px-2 py-[2px] text-[11.5px] font-medium text-[#222]">
                <span
                  className="inline-block h-[9px] w-[9px] rounded-full border border-black/20"
                  style={{ background: variantColor(label.color_code ?? "") }}
                  aria-hidden="true"
                />
                {label.color}
              </span>
            ) : null}
            {size ? (
              <span className="text-[16px] font-bold text-[#111]">{size}</span>
            ) : null}
          </div>
          {label.mapped_print ? (
            <div className="mt-2 flex items-center gap-[5px] text-[11.5px] text-[#333]">
              <Palette size={12} className="text-[#6b6b63]" />
              <b className="font-semibold">{label.mapped_print}</b>
            </div>
          ) : null}
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-[3px]">
          <QrSvg data={label.qr_data} size={104} />
          <div className="font-mono text-[8.5px] tracking-[0.02em] text-[#9a9a92]">
            {label.tracking_code}
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="font-mono text-[9.5px] text-[#9a9a92]">SKU {sku}</span>
        <span className="text-[11.5px] font-bold text-[#111]">
          Item {label.item_index}/{label.total_items}
        </span>
      </div>
    </div>
  );
}
