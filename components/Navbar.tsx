import NavbarClient from "@/components/NavbarClient";
import { getCurrentSession } from "@/lib/auth/session";

export default async function Navbar() {
  const session = await getCurrentSession();

  return (
    <NavbarClient
      employeeCode={session?.employeeCode ?? session?.username ?? null}
      role={formatRoleName(session?.roles[0])}
    />
  );
}

function formatRoleName(role?: string) {
  if (!role) {
    return null;
  }

  const roleLabels: Record<string, string> = {
    nurse: "พยาบาล",
    ward_head: "หัวหน้าวอร์ด",
    admin: "ผู้ดูแลระบบ",
  };

  return roleLabels[role] ?? role;
}
