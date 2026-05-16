/**
 * Barcode helpers. Structure allows swapping in QR / GS1 parsers later.
 */

/** EAN-13 check digit for first 12 digits (all numeric). */
export function ean13CheckDigit(d12) {
  const s = String(d12).replace(/\D/g, "");
  if (s.length !== 12) return "";
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const d = Number(s[i]);
    sum += (i % 2 === 0 ? d : d * 3);
  }
  return String((10 - (sum % 10)) % 10);
}

/**
 * Suggest a unique-looking retail-style barcode (13 digits, EAN-13 checksum).
 * Prefix 2xx = variable-weight / internal use range in GS1 (good for store-generated codes).
 */
export function suggestRetailBarcode() {
  const part = `${Date.now()}${Math.random().toString().slice(2, 12)}`.replace(/\D/g, "");
  const twelve = (`200${part}`).slice(0, 12).padEnd(12, "0");
  return twelve + ean13CheckDigit(twelve);
}
