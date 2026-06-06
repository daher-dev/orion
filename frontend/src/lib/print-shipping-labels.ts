/**
 * Print marketplace shipping-label PDFs.
 *
 * Ports the legacy Underground behavior: for each unique label URL, fetch the
 * PDF into a hidden iframe and trigger print (deduped by URL). Falls back to
 * opening the URL in a new tab when the fetch is blocked (CORS, etc.).
 */

export async function printShippingLabels(urls: (string | null | undefined)[]): Promise<number> {
  const unique = [...new Set(urls.filter((u): u is string => !!u))];
  for (const url of unique) {
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = blobUrl;
      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch {
            /* ignore — print blocked */
          }
        }, 800);
      };
      document.body.appendChild(iframe);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }
  return unique.length;
}
