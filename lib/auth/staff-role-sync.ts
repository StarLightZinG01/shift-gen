import { prisma } from "@/lib/prisma";

import { getStaffRoleSyncPlan } from "./staff-role-policy";

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function syncStaffUserRole(
  tx: TransactionClient,
  userId: string,
  isHead: boolean,
) {
  const existingRoles = await tx.userRole.findMany({
    where: { userId },
    include: { role: true },
  });
  const plan = getStaffRoleSyncPlan(
    existingRoles.map((item) => item.role.name),
    isHead,
  );

  if (plan.preservesAdmin) {
    return false;
  }

  if (plan.roleNamesToRemove.length > 0) {
    await tx.userRole.deleteMany({
      where: {
        userId,
        roleId: {
          in: existingRoles
            .filter((item) => plan.roleNamesToRemove.includes(item.role.name))
            .map((item) => item.roleId),
        },
      },
    });
  }

  if (plan.shouldAddDesiredRole) {
    const desiredRole = await tx.role.upsert({
      where: { name: plan.desiredRoleName },
      update: {},
      create: {
        name: plan.desiredRoleName,
        description: `Staff role: ${plan.desiredRoleName}`,
      },
    });

    await tx.userRole.upsert({
      where: {
        userId_roleId: { userId, roleId: desiredRole.id },
      },
      update: {},
      create: { userId, roleId: desiredRole.id },
    });
  }

  return plan.roleNamesToRemove.length > 0 || plan.shouldAddDesiredRole;
}
