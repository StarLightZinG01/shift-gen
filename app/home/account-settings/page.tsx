import { redirect } from "next/navigation";

import { AccountSettingsView } from "@/components/features/account-settings/AccountSettingsView";
import { getCurrentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export default async function AccountSettingsPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      username: true,
      displayName: true,
      employeeCode: true,
      staff: { select: { id: true, staffCode: true } },
    },
  });

  if (!user) {
    redirect("/");
  }

  return (
    <AccountSettingsView
      displayName={user.displayName}
      username={user.username}
      employeeCode={user.staff?.staffCode ?? user.employeeCode}
      hasStaffProfile={Boolean(user.staff)}
    />
  );
}
