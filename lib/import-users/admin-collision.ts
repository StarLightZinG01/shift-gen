export function hasAdminRole(roleNames: string[]) {
  return roleNames.some((roleName) => roleName.toLowerCase() === "admin");
}
