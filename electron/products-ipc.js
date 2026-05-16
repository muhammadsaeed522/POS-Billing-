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
var products_ipc_exports = {};
__export(products_ipc_exports, {
  registerProductsIpc: () => registerProductsIpc
});
module.exports = __toCommonJS(products_ipc_exports);
var import_electron = require("electron");
var import_client = require("../generated/prisma-client");
var import_role_guard = require("./role-guard");
var import_activity_log = require("./activity-log");
const UNITS = /* @__PURE__ */ new Set(["piece", "kg", "liter", "pack"]);
function cleanOpt(s) {
  const t = String(s ?? "").trim();
  return t.length ? t : null;
}
function registerProductsIpc(prisma) {
  const { logActivity } = (0, import_activity_log.createActivityLogger)(prisma);
  import_electron.ipcMain.handle("products:listCategories", async () => {
    (0, import_role_guard.assertProductsRead)();
    const rows = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { products: true } } }
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      productCount: c._count.products
    }));
  });
  import_electron.ipcMain.handle(
    "products:saveCategory",
    async (_evt, input) => {
      (0, import_role_guard.assertProductsWrite)();
      const name = String(input?.name ?? "").trim();
      if (!name) return { ok: false, error: "Category name is required." };
      try {
        if (input?.id) {
          const updated = await prisma.category.update({
            where: { id: String(input.id) },
            data: { name }
          });
          return { ok: true, id: updated.id };
        }
        const created = await prisma.category.create({ data: { name } });
        return { ok: true, id: created.id };
      } catch (e) {
        if (e instanceof import_client.Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          return { ok: false, error: "A category with that name already exists." };
        }
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    }
  );
  import_electron.ipcMain.handle("products:deleteCategory", async (_evt, payload) => {
    const admin = (0, import_role_guard.requireAdmin)();
    const id = String(typeof payload === "string" ? payload : payload?.id ?? "").trim();
    const modeRaw = typeof payload === "object" && payload?.mode != null ? String(payload.mode) : "cascade";
    const mode = modeRaw.toLowerCase() === "unlink" ? "unlink" : "cascade";
    if (!id) return { ok: false, error: "Category id is required." };
    try {
      const category = await prisma.category.findUnique({
        where: { id },
        include: { _count: { select: { products: true } } }
      });
      if (!category) return { ok: false, error: "Category not found." };
      const products = await prisma.product.findMany({
        where: { categoryId: id },
        select: { id: true }
      });
      const productIds = products.map((p) => p.id);
      const result = await prisma.$transaction(async (tx) => {
        let productsDeleted = 0;
        if (mode === "cascade" && productIds.length > 0) {
          await tx.stockLog.deleteMany({ where: { productId: { in: productIds } } });
          const del = await tx.product.deleteMany({ where: { id: { in: productIds } } });
          productsDeleted = del.count;
        } else if (mode === "unlink") {
          await tx.product.updateMany({ where: { categoryId: id }, data: { categoryId: null } });
        }
        await tx.category.delete({ where: { id } });
        return { productsDeleted, productsUnassigned: mode === "unlink" ? productIds.length : 0 };
      });
      const detail =
        mode === "cascade"
          ? `Admin deleted category "${category.name}" with ${result.productsDeleted} products`
          : `Admin deleted category "${category.name}" (${result.productsUnassigned} products unassigned)`;
      await logActivity({
        userId: admin.userId,
        action: "category_deleted",
        details: detail
      });
      return {
        ok: true,
        mode,
        categoryName: category.name,
        productsDeleted: result.productsDeleted,
        productsUnassigned: result.productsUnassigned
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
  import_electron.ipcMain.handle("products:list", async (_evt, params) => {
    (0, import_role_guard.assertProductsRead)();
    const status = params?.status ?? "active";
    const search = String(params?.search ?? "").trim();
    const where = {};
    if (status === "active") where.isActive = true;
    else if (status === "inactive") where.isActive = false;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
        { category: { is: { name: { contains: search } } } }
      ];
    }
    const rows = await prisma.product.findMany({
      where,
      include: { category: { select: { name: true } } },
      orderBy: { name: "asc" },
      take: 500
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
      isActive: p.isActive
    }));
  });
  /** Barcode uniqueness check for product form (exclude current id when editing). */
  import_electron.ipcMain.handle("products:checkBarcode", async (_evt, payload) => {
    (0, import_role_guard.assertProductsRead)();
    const barcode = cleanOpt(payload?.barcode ?? null);
    if (!barcode) return { ok: true, available: true };
    const excludeId = payload?.excludeProductId ? String(payload.excludeProductId) : void 0;
    const existing = await prisma.product.findFirst({
      where: {
        barcode,
        ...(excludeId ? { NOT: { id: excludeId } } : {})
      },
      select: { id: true, name: true }
    });
    if (!existing) return { ok: true, available: true };
    return { ok: true, available: false, conflictName: existing.name };
  });
  import_electron.ipcMain.handle("products:save", async (_evt, raw) => {
    (0, import_role_guard.assertProductsWrite)();
    const name = String(raw?.name ?? "").trim();
    if (!name) return { ok: false, error: "Product name is required." };
    const unit = String(raw?.unit ?? "piece").trim();
    if (!UNITS.has(unit)) return { ok: false, error: "Invalid unit." };
    const salePriceCents = Math.max(0, Math.floor(Number(raw?.salePriceCents) || 0));
    const purchasePriceCents = Math.max(0, Math.floor(Number(raw?.purchasePriceCents) || 0));
    const stockQtyMilli = Math.floor(Number(raw?.stockQtyMilli) || 0);
    const lowRaw = raw?.lowStockQtyMilli;
    const lowStockQtyMilli = lowRaw === null || lowRaw === void 0 ? null : Math.max(0, Math.floor(Number(lowRaw)));
    const sku = cleanOpt(raw?.sku ?? null);
    const barcode = cleanOpt(raw?.barcode ?? null);
    const imagePath = cleanOpt(raw?.imagePath ?? null);
    const categoryId = cleanOpt(raw?.categoryId ?? null);
    const isActive = Boolean(raw?.isActive);
    const excludeId = raw?.id ? String(raw.id) : void 0;
    if (sku) {
      const skuHit = await prisma.product.findFirst({
        where: { sku, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
        select: { name: true }
      });
      if (skuHit) return { ok: false, error: `SKU already used by \u201C${skuHit.name}\u201D.` };
    }
    if (barcode) {
      const bcHit = await prisma.product.findFirst({
        where: { barcode, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
        select: { name: true }
      });
      if (bcHit) return { ok: false, error: `Barcode already used by \u201C${bcHit.name}\u201D.` };
    }
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
      isActive
    };
    try {
      if (raw?.id) {
        const updated = await prisma.product.update({
          where: { id: String(raw.id) },
          data
        });
        return { ok: true, id: updated.id };
      }
      const created = await prisma.product.create({ data });
      return { ok: true, id: created.id };
    } catch (e) {
      if (e instanceof import_client.Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return { ok: false, error: "SKU or barcode already used by another product." };
      }
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
  import_electron.ipcMain.handle("products:setActive", async (_evt, payload) => {
    (0, import_role_guard.assertProductsWrite)();
    try {
      await prisma.product.update({
        where: { id: String(payload.id) },
        data: { isActive: Boolean(payload.isActive) }
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  registerProductsIpc
});
