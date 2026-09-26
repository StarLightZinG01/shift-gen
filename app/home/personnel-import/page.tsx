import { redirect } from "next/navigation";

import { PersonnelImportView } from "@/components/features/import-users/PersonnelImportView";
import { getCurrentSession } from "@/lib/auth/current-session";

export default async function PersonnelImportPage() {
  const session = await getCurrentSession();

  if (!session?.roles.includes("admin")) {
    redirect("/home");
  }

  return <PersonnelImportView />;
}
