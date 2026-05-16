"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var billing_ipc_exports = {};
__export(billing_ipc_exports, {
  registerBillingIpc: () => registerBillingIpc
});
module.exports = __toCommonJS(billing_ipc_exports);
var import_electron = require("electron");
var import_auth_ipc = require("./auth-ipc");
var import_role_guard = require("./role-guard");
var import_activity_log = require("./activity-log");
const INVOICE_KEY = "invoice_seq";
async function nextInvoiceNo(tx) {
  const row = await tx.setting.upsert({
    where: { key: INVOICE_KEY },
    create: { key: INVOICE_KEY, value: "1" },
    update: {}
  });
  const n = Math.max(1, parseInt(row.value, 10) || 1);
  await tx.setting.update({
    where: { key: INVOICE_KEY },
    data: { value: String(n + 1) }
  });
  return `INV-${String(n).padStart(6, "0")}`;
}
function registerBillingIpc(prisma) {
  const { logActivity } = (0, import_activity_log.createActivityLogger)(prisma);
  import_electron.ipcMain.handle("billing:searchProducts", async (_evt, rawQuery) => {
    (0, import_role_guard.assertBillingAccess)();
    const q = String(rawQuery ?? "").trim();
    if (!q) {
      const rows = await prisma.product.findMany({
        where: { isActive: true },
        take: 40,
        orderBy: { name: "asc" },
        include: { category: { select: { name: true } } }
      });
      return rows.map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        salePriceCents: p.salePriceCents,
        barcode: p.barcode,
        sku: p.sku,
        stockQtyMilli: p.stockQtyMilli,
        categoryName: p.category?.name ?? null
      }));
    }
    const exact = await prisma.product.findMany({
      where: { isActive: true, OR: [{ barcode: q }, { sku: q }] },
      take: 20,
      include: { category: { select: { name: true } } }
    });
    if (exact.length > 0) {
      return exact.map((p) => ({
        id: p.id,
        name: p.name,
        unit: p.unit,
        salePriceCents: p.salePriceCents,
        barcode: p.barcode,
        sku: p.sku,
        stockQtyMilli: p.stockQtyMilli,
        categoryName: p.category?.name ?? null
      }));
    }
    const lower = q.toLowerCase();
    const pool = await prisma.product.findMany({
      where: { isActive: true },
      take: 400,
      orderBy: { name: "asc" },
      include: { category: { select: { name: true } } }
    });
    const filtered = pool.filter((p) => {
      if (p.name.toLowerCase().includes(lower)) return true;
      if (p.sku && p.sku.toLowerCase().includes(lower)) return true;
      if (p.category?.name.toLowerCase().includes(lower)) return true;
      return false;
    });
    return filtered.slice(0, 50).map((p) => ({
      id: p.id,
      name: p.name,
      unit: p.unit,
      salePriceCents: p.salePriceCents,
      barcode: p.barcode,
      sku: p.sku,
      stockQtyMilli: p.stockQtyMilli,
      categoryName: p.category?.name ?? null
    }));
  });
  /** Fast path for USB / keyboard-wedge scanners: exact barcode or SKU → one product (or not found). */
  import_electron.ipcMain.handle("billing:resolveBarcode", async (_evt, raw) => {
    (0, import_role_guard.assertBillingAccess)();
    const code = String(raw ?? "").trim();
    if (!code) return { ok: false, error: "empty" };
    const p = await prisma.product.findFirst({
      where: { isActive: true, OR: [{ barcode: code }, { sku: code }] },
      include: { category: { select: { name: true } } }
    });
    if (!p) return { ok: false, error: "not_found" };
    const product = {
      id: p.id,
      name: p.name,
      unit: p.unit,
      salePriceCents: p.salePriceCents,
      barcode: p.barcode,
      sku: p.sku,
      stockQtyMilli: p.stockQtyMilli,
      categoryName: p.category?.name ?? null
    };
    return { ok: true, product };
  });
  import_electron.ipcMain.handle("billing:checkout", async (_evt, input) => {
    (0, import_role_guard.assertBillingAccess)();
    const sess = (0, import_auth_ipc.getSession)();
    const lines = Array.isArray(input?.lines) ? input.lines : [];
    if (lines.length === 0) {
      return { ok: false, error: "Cart is empty." };
    }
    const percent = Math.min(100, Math.max(0, Math.floor(Number(input.discountPercent) || 0)));
    const fixed = Math.max(0, Math.floor(Number(input.discountFixedCents) || 0));
    const paymentMethod = String(input.paymentMethod || "cash").trim().slice(0, 32) || "cash";
    const notes = input.notes ? String(input.notes).trim().slice(0, 500) : null;
    try {
      const out = await prisma.$transaction(async (tx) => {
        const productIds = [...new Set(lines.map((l) => l.productId))];
        const products = await tx.product.findMany({
          where: { id: { in: productIds }, isActive: true }
        });
        const pmap = new Map(products.map((p) => [p.id, p]));
        const computed = [];
        for (const line of lines) {
          const qtyMilli = Math.floor(Number(line.qtyMilli) || 0);
          if (qtyMilli <= 0) {
            throw new Error("Each line needs quantity > 0.");
          }
          const p = pmap.get(line.productId);
          if (!p) {
            throw new Error("Unknown or inactive product in cart.");
          }
          if (p.stockQtyMilli < qtyMilli) {
            throw new Error(`Insufficient stock for \u201C${p.name}\u201D.`);
          }
          const unitPriceCents = p.salePriceCents;
          const lineTotalCents = Math.round(unitPriceCents * qtyMilli / 1e3);
          computed.push({ productId: line.productId, qtyMilli, unitPriceCents, lineTotalCents });
        }
        const subtotalCents = computed.reduce((s, l) => s + l.lineTotalCents, 0);
        const pctOff = Math.floor(subtotalCents * percent / 100);
        const discountCents = Math.min(subtotalCents, pctOff + fixed);
        const totalCents = subtotalCents - discountCents;
        const invoiceNo = await nextInvoiceNo(tx);
        const sale = await tx.sale.create({
          data: {
            invoiceNo,
            cashierUserId: sess?.userId ?? null,
            subtotalCents,
            discountCents,
            totalCents,
            paymentMethod,
            notes,
            items: {
              create: computed.map((c) => ({
                productId: c.productId,
                qtyMilli: c.qtyMilli,
                unitPriceCents: c.unitPriceCents,
                lineTotalCents: c.lineTotalCents
              }))
            }
          }
        });
        for (const c of computed) {
          await tx.product.update({
            where: { id: c.productId },
            data: { stockQtyMilli: { decrement: c.qtyMilli } }
          });
          await tx.stockLog.create({
            data: {
              productId: c.productId,
              qtyChangeMilli: -c.qtyMilli,
              reason: `SALE:${invoiceNo}`
            }
          });
        }
        return { saleId: sale.id, invoiceNo, totalCents };
      });
      if (sess?.userId) {
        await logActivity({
          userId: sess.userId,
          action: "sale_checkout",
          details: `${out.invoiceNo} · ${out.totalCents} cents`
        });
      }
      return { ok: true, ...out };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  registerBillingIpc
});
