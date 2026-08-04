export type AppRole = "nurse" | "ward_head" | "admin";

export type AppNavigationItem = {
  title: string;
  url: string;
  section: "main" | "admin";
  roles: AppRole[];
};

const allRoles: AppRole[] = ["nurse", "ward_head", "admin"];
const managerRoles: AppRole[] = ["ward_head", "admin"];
const adminRoles: AppRole[] = ["admin"];

export const appNavigationItems = [
  {
    title: "หน้าแรก",
    url: "/home",
    section: "main",
    roles: allRoles,
  },
  {
    title: "ตารางเวรของฉัน",
    url: "/home/my-schedule",
    section: "main",
    roles: allRoles,
  },
  {
    title: "ขอลา / ไม่สะดวกเข้าเวร",
    url: "/home/leave-requests",
    section: "main",
    roles: allRoles,
  },
  {
    title: "จัดการตารางเวร",
    url: "/home/schedule-management",
    section: "main",
    roles: managerRoles,
  },
  {
    title: "รอบจัดตารางเวร",
    url: "/home/schedule-rounds",
    section: "admin",
    roles: adminRoles,
  },
  {
    title: "นำเข้าบุคลากร",
    url: "/admin/import-users",
    section: "admin",
    roles: adminRoles,
  },
  {
    title: "สร้างผู้ดูแลระบบ",
    url: "/admin/create-admin",
    section: "admin",
    roles: adminRoles,
  },
] as const satisfies readonly AppNavigationItem[];

export function getVisibleNavigationItems(roles: string[]) {
  return appNavigationItems.filter((item) =>
    canRoleAccessItem(roles, item.roles),
  );
}

export function canAccessPath(roles: string[], pathname: string) {
  if (pathname === "/schedule-rounds" || pathname.startsWith("/schedule-rounds/")) {
    return canRoleAccessItem(roles, adminRoles);
  }

  if (
    pathname === "/home/manual-schedule" ||
    pathname.startsWith("/home/manual-schedule/")
  ) {
    return canRoleAccessItem(roles, managerRoles);
  }

  const matchedItem = appNavigationItems
    .filter((item) => isActivePath(pathname, item.url))
    .sort((a, b) => b.url.length - a.url.length)[0];

  if (!matchedItem) {
    return true;
  }

  return canRoleAccessItem(roles, matchedItem.roles);
}

export function getPageTitle(pathname: string) {
  const currentItem = appNavigationItems
    .filter((item) => isActivePath(pathname, item.url))
    .sort((a, b) => b.url.length - a.url.length)[0];

  return currentItem?.title ?? "หน้าแรก";
}

export function isActivePath(pathname: string, url: string) {
  if (url === "/home") {
    return pathname === url;
  }

  return pathname === url || pathname.startsWith(`${url}/`);
}

function canRoleAccessItem(roles: string[], allowedRoles: readonly AppRole[]) {
  if (roles.includes("admin")) {
    return true;
  }

  return roles.some((role) => allowedRoles.includes(role as AppRole));
}
