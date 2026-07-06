"use client";

import { usePathname } from "next/navigation";

import { getPageTitle } from "@/lib/app-navigation";

type NavbarClientProps = {
  employeeCode: string | null;
  role: string | null;
};

export default function NavbarClient({
  employeeCode,
  role,
}: NavbarClientProps) {
  const pathname = usePathname();
  const prefix = employeeCode?.match(/^[^0-9]+/)?.[0] ?? "";

  return (
    <div className="container flex items-center justify-between py-2">
      <div className="text-xl font-bold">{getPageTitle(pathname)}</div>

      <div className="flex items-center gap-1.5 rounded-full border bg-white py-0.5 pr-3 pl-1">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-medium text-white">
          {prefix}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">{employeeCode}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {role}
          </span>
        </div>
      </div>
    </div>
  );
}
