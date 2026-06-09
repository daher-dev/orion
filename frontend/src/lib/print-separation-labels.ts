/**
 * Print 100×50mm separation labels (one per physical piece) to a thermal/label
 * printer via a hidden iframe.
 *
 * Models the iframe-print precedent in `print-shipping-labels.ts`, but instead
 * of fetching a remote PDF it renders self-contained HTML (the label face +
 * a real QR encoding each piece's `tracking_code`) into the iframe document,
 * sized via an `@page { size: 100mm 50mm; margin: 0 }` rule so each label is
 * one physical sheet on a label roll. The QR is rendered as inline SVG paths so
 * it survives the iframe boundary (no external assets, no CORS).
 *
 * Chrome print tip surfaced in the modal: paper 100×50mm, margins None, scale 100%.
 */

import { qrMatrix } from "@/lib/qr";
import type { SeparationLabel } from "@/lib/schemas/separation";

const COLOR_HEX: Record<string, string> = {
  preto: "#1f1f1f",
  branco: "#f4f1ea",
  "off-white": "#efe6d3",
  cru: "#e7dcc4",
  marrom: "#7a4b2a",
  areia: "#cfb98e",
  verde: "#3a4a3d",
  vermelho: "#b03a2e",
};

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (ch) =>
      (
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }) as Record<string, string>
      )[ch] ?? ch,
  );

/** SVG markup for the QR matrix of `data` — dark modules as one merged path. */
export function qrSvgMarkup(data: string, sizePx = 104): string {
  const matrix = qrMatrix(data);
  const n = matrix.length;
  let path = "";
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (matrix[y][x]) path += `M${x} ${y}h1v1h-1z`;
    }
  }
  return (
    `<svg width="${sizePx}" height="${sizePx}" viewBox="0 0 ${n} ${n}" ` +
    `shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">` +
    `<rect width="${n}" height="${n}" fill="#fff"/>` +
    `<path d="${path}" fill="#111"/></svg>`
  );
}

const colorHex = (color: string | null | undefined): string => {
  if (!color) return "#999";
  return COLOR_HEX[color.toLowerCase()] ?? "#999";
};

function labelHtml(label: SeparationLabel): string {
  const product = escapeHtml(label.product_name ?? "");
  const color = label.color ? escapeHtml(label.color) : "";
  const size = label.size ? escapeHtml(label.size.toUpperCase()) : "";
  const estampa = label.mapped_print ? escapeHtml(label.mapped_print) : "";
  const sku = escapeHtml(label.sku ?? label.tracking_code);
  const code = escapeHtml(label.tracking_code);
  const orderCode = escapeHtml(label.order_code);
  const qr = qrSvgMarkup(label.qr_data, 104);

  return `<div class="label">
    <div class="row">
      <div class="left">
        <div class="eyebrow">PEDIDO</div>
        <div class="order">${orderCode}</div>
        ${product ? `<div class="product">${product}</div>` : ""}
        <div class="attrs">
          ${color ? `<span class="chip"><span class="dot" style="background:${colorHex(label.color)}"></span>${color}</span>` : ""}
          ${size ? `<span class="size">${size}</span>` : ""}
        </div>
        ${estampa ? `<div class="estampa">${estampa}</div>` : ""}
      </div>
      <div class="right">
        ${qr}
        <div class="code">${code}</div>
      </div>
    </div>
    <div class="foot">
      <span class="sku">SKU ${sku}</span>
      <span class="idx">Item ${label.item_index}/${label.total_items}</span>
    </div>
  </div>`;
}

/**
 * Render the given labels into a hidden iframe and trigger the browser print
 * dialog. Returns the number of labels printed. No-op (returns 0) on the server.
 */
export function printSeparationLabels(labels: SeparationLabel[]): number {
  if (typeof document === "undefined" || labels.length === 0) return 0;

  const html = `<!doctype html><html><head><meta charset="utf-8" />
    <style>
      @page { size: 100mm 50mm; margin: 0; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      html, body { margin: 0; padding: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #111; }
      .label { width: 100mm; height: 50mm; padding: 3mm 4mm; display: flex; flex-direction: column; page-break-after: always; overflow: hidden; }
      .label:last-child { page-break-after: auto; }
      .row { flex: 1; display: flex; gap: 4mm; min-height: 0; }
      .left { flex: 1; min-width: 0; display: flex; flex-direction: column; }
      .eyebrow { font-size: 7pt; letter-spacing: .12em; color: #9a9a92; font-weight: 700; }
      .order { font-size: 17pt; font-weight: 600; line-height: 1.04; letter-spacing: -.01em; }
      .product { font-size: 8pt; color: #222; line-height: 1.3; margin: 1mm 0; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
      .attrs { display: flex; align-items: center; gap: 2mm; margin-top: auto; }
      .chip { display: inline-flex; align-items: center; gap: 1.2mm; padding: 0.6mm 2mm; background: #f0ede6; border-radius: 1.2mm; font-size: 8pt; font-weight: 500; }
      .dot { width: 2.4mm; height: 2.4mm; border-radius: 50%; border: 0.3mm solid rgba(0,0,0,.18); display: inline-block; }
      .size { font-weight: 700; font-size: 11pt; }
      .estampa { margin-top: 1.5mm; font-size: 8pt; color: #333; font-weight: 600; }
      .right { display: flex; flex-direction: column; align-items: flex-end; gap: 0.8mm; flex-shrink: 0; }
      .right svg { width: 26mm; height: 26mm; display: block; }
      .code { font-family: ui-monospace, monospace; font-size: 6pt; color: #9a9a92; letter-spacing: .02em; }
      .foot { display: flex; justify-content: space-between; align-items: center; margin-top: 1.5mm; }
      .sku { font-family: ui-monospace, monospace; font-size: 6.5pt; color: #9a9a92; }
      .idx { font-size: 8pt; font-weight: 700; }
    </style></head><body>${labels.map(labelHtml).join("")}</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  iframe.onload = () => {
    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        /* ignore — print blocked */
      }
    }, 400);
  };
  document.body.appendChild(iframe);
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(html);
    doc.close();
  }
  return labels.length;
}
