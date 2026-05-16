"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerProductsIpc = registerProductsIpc;
const electron_1 = require("electron");
const client_1 = require("@prisma/client");
const role_guard_1 = require("./role-guard");
const UNITS = new Set(["piece", "kg", "liter", "pack"]);
function cleanOpt(s) {
    const t = String(s ?? "").trim();
    return t.length ? t : null;
}
function registerProductsIpc(prisma) {
    electron_1.ipcMain.handle("products:listCategories", async () => {
        (0, role_guard_1.assertNotWorkerOrThrow)();
        const rows = await prisma.category.findMany({
            orderBy: { name: "asc" },
            include: { _count: { select: { products: true } } },
        });
        return rows.map((c) => ({
            id: c.id,
            name: c.name,
            productCount: c._count.products,
        }));
    });
    electron_1.ipcMain.handle("products:saveCategory", async (_evt, input) => {
        (0, role_guard_1.assertNotWorkerOrThrow)();
        const name = String(input?.name ?? "").trim();
        if (!name)
            return { ok: false, error: "Category name is required." };
        try {
            if (input?.id) {
                const updated = await prisma.category.update({
                    where: { id: String(input.id) },
                    data: { name },
                });
                return { ok: true, id: updated.id };
            }
            const created = await prisma.category.create({ data: { name } });
            return { ok: true, id: created.id };
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
                return { ok: false, error: "A category with that name already exists." };
            }
            return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
    });
    electron_1.ipcMain.handle("products:deleteCategory", async (_evt, id) => {
        (0, role_guard_1.assertNotWorkerOrThrow)();
        try {
            await prisma.product.updateMany({
                where: { categoryId: id },
                data: { categoryId: null },
            });
            await prisma.category.delete({ where: { id } });
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
    });
    electron_1.ipcMain.handle("products:list", async (_evt, params) => {
        (0, role_guard_1.assertNotWorkerOrThrow)();
        const status = params?.status ?? "active";
        const search = String(params?.search ?? "").trim();
        const where = {};
        if (status === "active")
            where.isActive = true;
        else if (status === "inactive")
            where.isActive = false;
        if (search) {
            where.OR = [
                { name: { contains: search } },
                { sku: { contains: search } },
                { barcode: { contains: search } },
                { category: { is: { name: { contains: search } } } },
            ];
        }
        const rows = await prisma.product.findMany({
            where,
            include: { category: { select: { name: true } } },
            orderBy: { name: "asc" },
            take: 500,
        });
        return rows.map((p) => ({
            id: p.id,
            name: p.name,
            unit: p.unit,
            sku: p.sku,
            barcode: p.barcode,
            imagePath: p.imagePath,
            categoryId: p.categoryId,
            categoryName: p.category?.name ?? null,
            salePriceCents: p.salePriceCents,
            purchasePriceCents: p.purchasePriceCents,
            stockQtyMilli: p.stockQtyMilli,
            lowStockQtyMilli: p.lowStockQtyMilli,
            isActive: p.isActive,
        }));
    });
    electron_1.ipcMain.handle("products:save", async (_evt, raw) => {
        (0, role_guard_1.assertNotWorkerOrThrow)();
        const name = String(raw?.name ?? "").trim();
        if (!name)
            return { ok: false, error: "Product name is required." };
        const unit = String(raw?.unit ?? "piece").trim();
        if (!UNITS.has(unit))
            return { ok: false, error: "Invalid unit." };
        const salePriceCents = Math.max(0, Math.floor(Number(raw?.salePriceCents) || 0));
        const purchasePriceCents = Math.max(0, Math.floor(Number(raw?.purchasePriceCents) || 0));
        const stockQtyMilli = Math.floor(Number(raw?.stockQtyMilli) || 0);
        const lowRaw = raw?.lowStockQtyMilli;
        const lowStockQtyMilli = lowRaw === null || lowRaw === undefined ? null : Math.max(0, Math.floor(Number(lowRaw)));
        const sku = cleanOpt(raw?.sku ?? null);
        const barcode = cleanOpt(raw?.barcode ?? null);
        const imagePath = cleanOpt(raw?.imagePath ?? null);
        const categoryId = cleanOpt(raw?.categoryId ?? null);
        const isActive = Boolean(raw?.isActive);
        const data = {
            name,
            unit,
            sku,
            barcode,
            imagePath,
            categoryId,
            salePriceCents,
            purchasePriceCents,
            stockQtyMilli,
            lowStockQtyMilli,
            isActive,
        };
        try {
            if (raw?.id) {
                const updated = await prisma.product.update({
                    where: { id: String(raw.id) },
                    data,
                });
                return { ok: true, id: updated.id };
            }
            const created = await prisma.product.create({ data });
            return { ok: true, id: created.id };
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
                return { ok: false, error: "SKU or barcode already used by another product." };
            }
            return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
    });
    electron_1.ipcMain.handle("products:setActive", async (_evt, payload) => {
        (0, role_guard_1.assertNotWorkerOrThrow)();
        try {
            await prisma.product.update({
                where: { id: String(payload.id) },
                data: { isActive: Boolean(payload.isActive) },
            });
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: e instanceof Error ? e.message : String(e) };
        }
    });
}
