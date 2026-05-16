"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureSeed = ensureSeed;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const ROLES = ["admin", "manager", "cashier", "worker"];
async function ensureSeed(prisma) {
    for (const name of ROLES) {
        await prisma.role.upsert({
            where: { name },
            create: { name },
            update: {},
        });
    }
    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "admin" } });
    const existing = await prisma.user.findUnique({ where: { username: "admin" } });
    if (!existing) {
        const passwordHash = bcryptjs_1.default.hashSync("admin123", 10);
        await prisma.user.create({
            data: {
                username: "admin",
                passwordHash,
                displayName: "Administrator",
                roleId: adminRole.id,
            },
        });
    }
    const workerRole = await prisma.role.findUniqueOrThrow({ where: { name: "worker" } });
    const existingWorker = await prisma.user.findUnique({ where: { username: "worker" } });
    if (!existingWorker) {
        const workerHash = bcryptjs_1.default.hashSync("worker123", 10);
        await prisma.user.create({
            data: {
                username: "worker",
                passwordHash: workerHash,
                displayName: "Counter staff",
                roleId: workerRole.id,
            },
        });
    }
    const productCount = await prisma.product.count();
    if (productCount === 0) {
        const cat = await prisma.category.upsert({
            where: { name: "General" },
            create: { name: "General" },
            update: {},
        });
        await prisma.product.createMany({
            data: [
                {
                    name: "Demo water 500ml",
                    unit: "piece",
                    categoryId: cat.id,
                    barcode: "8901000000001",
                    salePriceCents: 5000,
                    purchasePriceCents: 3500,
                    stockQtyMilli: 50000,
                    lowStockQtyMilli: 10000,
                },
                {
                    name: "Demo rice 1kg",
                    unit: "piece",
                    categoryId: cat.id,
                    barcode: "8901000000002",
                    salePriceCents: 35000,
                    purchasePriceCents: 28000,
                    stockQtyMilli: 20000,
                    lowStockQtyMilli: 5000,
                },
                {
                    name: "Demo sugar 1kg",
                    unit: "kg",
                    categoryId: cat.id,
                    sku: "SUG-1KG",
                    salePriceCents: 22000,
                    purchasePriceCents: 18000,
                    stockQtyMilli: 15000,
                    lowStockQtyMilli: 3000,
                },
            ],
        });
    }
}
