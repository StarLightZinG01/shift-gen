const clinicalRoleNames = ["nurse", "ward_head"] as const;

export function getStaffRoleSyncPlan(
  existingRoleNames: string[],
  isHead: boolean,
) {
  const desiredRoleName = isHead ? "ward_head" : "nurse";

  if (existingRoleNames.includes("admin")) {
    return {
      desiredRoleName,
      roleNamesToRemove: [] as string[],
      shouldAddDesiredRole: false,
      preservesAdmin: true,
    };
  }

  return {
    desiredRoleName,
    roleNamesToRemove: existingRoleNames.filter(
      (roleName) =>
        clinicalRoleNames.includes(roleName as (typeof clinicalRoleNames)[number]) &&
        roleName !== desiredRoleName,
    ),
    shouldAddDesiredRole: !existingRoleNames.includes(desiredRoleName),
    preservesAdmin: false,
  };
}
