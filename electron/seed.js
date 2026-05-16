"use strict";

const bcrypt = require("bcryptjs");

const ROLES = ["admin", "manager", "cashier", "staff"];

async function ensureSeed(prisma) {
  for (const name of ROLES) {
    await prisma.role.upsert({
      where: { name },
      create: { name },
      update: {}
    });
  }

  const legacyWorker = await prisma.role.findUnique({ where: { name: "worker" } });
  if (legacyWorker) {
    const staffRole = await prisma.role.findUniqueOrThrow({ where: { name: "staff" } });
    await prisma.user.updateMany({
      where: { roleId: legacyWorker.id },
      data: { roleId: staffRole.id }
    });
  }

  // Remove legacy demo administrator (no default admin/admin123).
  const demoAdmin = await prisma.user.findFirst({
    where: { username: "admin", email: "admin@pos.local" }
  });
  if (demoAdmin) {
    await prisma.authSession.deleteMany({ where: { userId: demoAdmin.id } });
    await prisma.user.delete({ where: { id: demoAdmin.id } });
  }

  const staffRole = await prisma.role.findUniqueOrThrow({ where: { name: "staff" } });
  const existingStaff = await prisma.user.findUnique({ where: { username: "staff" } });
  if (!existingStaff) {
    const staffHash = bcrypt.hashSync("staff123", 10);
    await prisma.user.create({
      data: {
        username: "staff",
        email: "staff@pos.local",
        passwordHash: staffHash,
        displayName: "Store Staff",
        roleId: staffRole.id
      }
    });
  }

  const productCount = await prisma.product.count();
  if (productCount === 0) {
    const cat = await prisma.category.upsert({
      where: { name: "General" },
      create: { name: "General" },
      update: {}
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
          lowStockQtyMilli: 10000
        },
        {
          name: "Demo rice 1kg",
          unit: "piece",
          categoryId: cat.id,
          barcode: "8901000000002",
          salePriceCents: 35000,
          purchasePriceCents: 28000,
          stockQtyMilli: 20000,
          lowStockQtyMilli: 5000
        },
        {
          name: "Demo sugar 1kg",
          unit: "kg",
          categoryId: cat.id,
          sku: "SUG-1KG",
          salePriceCents: 22000,
          purchasePriceCents: 18000,
          stockQtyMilli: 15000,
          lowStockQtyMilli: 3000
        }
      ]
    });
  }
}

module.exports = { ensureSeed };
