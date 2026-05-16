function formatMoney(cents, currency = "PKR") {
  const v = cents / 100;
  try {
    return new Intl.NumberFormat(void 0, { style: "currency", currency, maximumFractionDigits: 2 }).format(v);
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
}
function formatQtyFromMilli(qtyMilli, unit) {
  const n = qtyMilli / 1e3;
  const decimals = unit === "kg" || unit === "liter" ? 3 : 0;
  return n.toFixed(decimals);
}
export {
  formatMoney,
  formatQtyFromMilli
};
