"use strict";

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function countStoreAdmins(prisma) {
  const adminRole = await prisma.role.findUnique({ where: { name: "admin" } });
  if (!adminRole) return 0;
  return prisma.user.count({ where: { roleId: adminRole.id } });
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 */
async function needsInitialAdminSetup(prisma) {
  return (await countStoreAdmins(prisma)) === 0;
}

module.exports = { countStoreAdmins, needsInitialAdminSetup };
