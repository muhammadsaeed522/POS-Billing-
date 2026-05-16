"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerBillingIpc = registerBillingIpc;
const electron_1 = require("electron");
const INVOICE_KEY = "invoice_seq";
async function nextInvoiceNo(tx) {
    const row = await tx.setting.upsert({
        where: { key: INVOICE_KEY },
        create: { key: INVOICE_KEY, value: "1" },
        update: {},
    });
    const n = Math.max(1, parseInt(row.value, 10) || 1);
    await tx.setting.update({
        where: { key: INVOICE_KEY },
        data: { value: String(n + 1) },
    });
    return `INV-${String(n).padStart(6, "0")}`;
}
function registerBillingIpc(prisma) {
    electron_1.ipcMain.handle("billing:searchProducts", async (_evt, rawQuery) => {
        const q = String(rawQuery ?? "").trim();
        if (!q) {
            const rows = await prisma.product.findMany({
                where: { isActive: true },
                take: 40,
                orderBy: { name: "asc" },
                include: { category: { select: { name: true } } },
            });
            return rows.map((p) => ({
                id: p.id,
                name: p.name,
                unit: p.unit,
                salePriceCents: p.salePriceCents,
                barcode: p.barcode,
                sku: p.sku,
                stockQtyMilli: p.stockQtyMilli,
                categoryName: p.category?.name ?? null,
            }));
        }
        const exact = await prisma.product.findMany({
            where: { isActive: true, OR: [{ barcode: q }, { sku: q }] },
            take: 20,
            include: { category: { select: { name: true } } },
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
                categoryName: p.category?.name ?? null,
            }));
        }
        const lower = q.toLowerCase();
        const pool = await prisma.product.findMany({
            where: { isActive: true },
            take: 400,
            orderBy: { name: "asc" },
            include: { category: { select: { name: true } } },
        });
        const filtered = pool.filter((p) => {
            if (p.name.toLowerCase().includes(lower))
                return true;
            if (p.sku && p.sku.toLowerCase().includes(lower))
                return true;
            if (p.category?.name.toLowerCase().includes(lower))
                return true;
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
            categoryName: p.category?.name ?? null,
        }));
    });
    electron_1.ipcMain.handle("billing:checkout", async (_evt, input) => {
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
                    where: { id: { in: productIds }, isActive: true },
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
                        throw new Error(`Insufficient stock for “${p.name}”.`);
                    }
                    const unitPriceCents = p.salePriceCents;
                    const lineTotalCents = Math.round((unitPriceCents * qtyMilli) / 1000);
                    computed.push({ productId: line.productId, qtyMilli, unitPriceCents, lineTotalCents });
                }
                const subtotalCents = computed.reduce((s, l) => s + l.lineTotalCents, 0);
                const pctOff = Math.floor((subtotalCents * percent) / 100);
                const discountCents = Math.min(subtotalCents, pctOff + fixed);
                const totalCents = subtotalCents - discountCents;
                const invoiceNo = await nextInvoiceNo(tx);
                const sale = await tx.sale.create({
                    data: {
                        invoiceNo,
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
                                lineTotalCents: c.lineTotalCents,
                            })),
                        },
                    },
                });
                for (const c of computed) {
                    await tx.product.update({
                        where: { id: c.productId },
                        data: { stockQtyMilli: { decrement: c.qtyMilli } },
                    });
                    await tx.stockLog.create({
                        data: {
                            productId: c.productId,
                            qtyChangeMilli: -c.qtyMilli,
                            reason: `SALE:${invoiceNo}`,
                        },
                    });
                }
                return { saleId: sale.id, invoiceNo, totalCents };
            });
            return { ok: true, ...out };
        }
        catch (e) {
            return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
    });
}
