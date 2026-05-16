import { formatMoney, formatQtyFromMilli } from "./format.js";

/**
 * Escape text for safe insertion into HTML.
 */
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Inner receipt markup (no document shell).
 */
function receiptBodyInnerHtml(data) {
  const {
    storeName = "POS Billing",
    invoiceNo,
    saleAt = new Date().toLocaleString(),
    lines = [],
    subtotalCents,
    discountCents,
    totalCents,
    paymentLabel,
    notes = null,
  } = data;

  const rows = lines
    .map(
      (l) => `
    <tr>
      <td colspan="3" class="item-name">${escapeHtml(l.name)}</td>
    </tr>
    <tr class="line-detail">
      <td>${escapeHtml(formatQtyFromMilli(l.qtyMilli, l.unit))} ${escapeHtml(l.unit)}</td>
      <td class="right">${escapeHtml(formatMoney(l.unitPriceCents))}</td>
      <td class="right">${escapeHtml(formatMoney(l.lineTotalCents))}</td>
    </tr>`
    )
    .join("");

  const discountRow =
    discountCents > 0
      ? `<tr class="totals"><td colspan="2">Discount</td><td class="right">−${escapeHtml(formatMoney(discountCents))}</td></tr>`
      : "";

  const notesBlock = notes
    ? `<div class="notes"><strong>Notes</strong><br/>${escapeHtml(notes).replace(/\n/g, "<br/>")}</div>`
    : "";

  return `
  <h1>${escapeHtml(storeName)}</h1>
  <div class="meta">
    <div><strong>${escapeHtml(invoiceNo)}</strong></div>
    <div>${escapeHtml(saleAt)}</div>
  </div>
  <hr class="rule" />
  <table>
    <tbody>${rows}</tbody>
  </table>
  <hr class="rule" />
  <table>
    <tr class="totals"><td colspan="2">Subtotal</td><td class="right">${escapeHtml(formatMoney(subtotalCents))}</td></tr>
    ${discountRow}
    <tr class="totals grand"><td colspan="2">Total</td><td class="right">${escapeHtml(formatMoney(totalCents))}</td></tr>
  </table>
  <div class="pay"><strong>Payment:</strong> ${escapeHtml(paymentLabel)}</div>
  ${notesBlock}
  <div class="footer">Thank you for your purchase.</div>`;
}

/** Shared receipt + preview chrome styles (screen + print). */
function receiptDocumentCss() {
  return `
    @page { margin: 8mm; size: auto; }
    * { box-sizing: border-box; }
    html, body { margin: 0; }
    body.preview-body {
      font-family: system-ui, Segoe UI, sans-serif;
      background: #e4e4e7;
      min-height: 100vh;
    }
    .preview-toolbar {
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: #fafafa;
      border-bottom: 1px solid #d4d4d8;
      box-shadow: 0 1px 3px rgba(0,0,0,.06);
    }
    .preview-toolbar strong {
      flex: 1;
      min-width: 120px;
      font-size: 14px;
      color: #18181b;
    }
    .preview-toolbar button {
      font: inherit;
      font-size: 13px;
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid #d4d4d8;
      background: #fff;
      cursor: pointer;
      color: #18181b;
    }
    .preview-toolbar button:hover {
      background: #f4f4f5;
    }
    .preview-toolbar button.primary {
      background: #059669;
      border-color: #047857;
      color: #fff;
    }
    .preview-toolbar button.primary:hover {
      background: #047857;
    }
    .receipt-sheet {
      max-width: 80mm;
      margin: 16px auto 32px;
      padding: 12px;
      background: #fff;
      color: #111;
      box-shadow: 0 8px 30px rgba(0,0,0,.12);
      border-radius: 4px;
      font-family: ui-monospace, "Cascadia Mono", "Segoe UI Mono", Consolas, monospace;
      font-size: 12px;
    }
    h1 { font-size: 14px; text-align: center; margin: 0 0 4px; letter-spacing: 0.05em; }
    .meta { text-align: center; font-size: 11px; color: #333; margin-bottom: 10px; }
    .rule { border: none; border-top: 1px dashed #999; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    .item-name { font-weight: 600; padding-top: 6px; font-size: 11px; }
    .line-detail td { font-size: 10px; color: #333; padding-bottom: 2px; }
    .right { text-align: right; }
    .totals td { padding-top: 6px; font-size: 11px; }
    .grand td { font-weight: 700; font-size: 13px; padding-top: 8px; border-top: 1px solid #111; }
    .pay { margin-top: 10px; font-size: 11px; }
    .notes { margin-top: 10px; font-size: 10px; color: #444; }
    .footer { margin-top: 14px; text-align: center; font-size: 10px; color: #666; }
    @media print {
      body.preview-body { background: #fff; }
      .preview-toolbar { display: none !important; }
      .receipt-sheet {
        margin: 0;
        padding: 8px;
        box-shadow: none;
        border-radius: 0;
        max-width: none;
      }
    }
  `;
}

/**
 * Full HTML document: on-screen preview chrome + receipt (toolbar hidden when printing).
 */
function buildPreviewPrintDocument(data) {
  const inner = receiptBodyInnerHtml(data);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Receipt ${escapeHtml(data.invoiceNo)} — preview</title>
  <style>${receiptDocumentCss()}</style>
</head>
<body class="preview-body">
  <div class="preview-toolbar">
    <strong>Print preview</strong>
    <button type="button" class="primary" id="btn-print">Print…</button>
    <button type="button" id="btn-close">Close</button>
  </div>
  <div class="receipt-sheet">${inner}</div>
  <script>
    (function () {
      function doPrint() { window.focus(); window.print(); }
      document.getElementById("btn-print").addEventListener("click", doPrint);
      function closePreview() {
        if (window.frameElement) {
          window.parent.postMessage({ type: "pos-receipt-preview-close" }, "*");
        } else {
          window.close();
        }
      }
      document.getElementById("btn-close").addEventListener("click", closePreview);
      window.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closePreview();
      });
    })();
  </script>
</body>
</html>`;
}

/**
 * Same preview document opened inside the main app (pop-up blocked fallback).
 */
function openPreviewOverlayFallback(html) {
  const existing = document.getElementById("receipt-preview-overlay");
  if (existing) existing.remove();

  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));

  const overlay = document.createElement("div");
  overlay.id = "receipt-preview-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:rgba(24,24,27,.55);backdrop-filter:blur(2px);";

  const iframe = document.createElement("iframe");
  iframe.title = "Receipt print preview";
  iframe.style.cssText = "flex:1;width:100%;min-height:0;border:0;background:#52525b;";
  iframe.src = url;

  function close() {
    window.removeEventListener("message", onMsg);
    URL.revokeObjectURL(url);
    overlay.remove();
  }

  function onMsg(e) {
    if (e.data?.type === "pos-receipt-preview-close" && e.source === iframe.contentWindow) close();
  }
  window.addEventListener("message", onMsg);

  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close();
  });

  overlay.append(iframe);
  document.body.appendChild(overlay);
}

/**
 * Open a print preview window (or in-app overlay if pop-ups are blocked), then user chooses **Print…**
 * for the system print dialog (with OS print preview where available).
 *
 * @param {object} receiptData — same shape as before (storeName, invoiceNo, lines, …)
 */
export function printBillReceipt(receiptData) {
  const html = buildPreviewPrintDocument(receiptData);
  const w = window.open("", "_blank", "width=480,height=820,scrollbars=yes,resizable=yes");

  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    return;
  }

  openPreviewOverlayFallback(html);
}
