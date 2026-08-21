"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Logout02Icon,
  UserSettings01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { signOutAction } from "@/app/actions/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { getPageTitle } from "@/lib/app-navigation";

type NavbarClientProps = {
  employeeCode: string | null;
  displayName: string | null;
  role: string | null;
};

export default function NavbarClient({
  employeeCode,
  displayName,
  role,
}: NavbarClientProps) {
  const pathname = usePathname();
  const prefix = employeeCode?.match(/^[^0-9]+/)?.[0] ?? "";

  return (
    <div className="container flex items-center justify-between py-2">
      <div className="text-xl font-bold">{getPageTitle(pathname)}</div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group flex cursor-pointer items-center gap-1.5 rounded-full border border-border bg-white py-0.5 pr-2 pl-1 text-left shadow-xs outline-none transition-[background-color,border-color,box-shadow,transform] hover:border-brand/40 hover:bg-brand/5 hover:shadow-sm active:scale-[0.98] focus-visible:border-brand/50 focus-visible:ring-3 focus-visible:ring-brand/20"
            aria-label="เปิดเมนูบัญชีผู้ใช้"
            title="เปิดเมนูบัญชีผู้ใช้"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-medium text-white ring-2 ring-transparent transition-colors group-hover:ring-brand/15">
              {prefix || displayName?.trim().charAt(0) || "U"}
            </div>
            <div className="hidden flex-col leading-tight sm:flex">
              <span className="max-w-36 truncate text-sm font-semibold">
                {employeeCode}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {role}
              </span>
            </div>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" sideOffset={8} className="w-64 p-2">
          <DropdownMenuLabel className="px-2 py-2">
            <span className="block truncate text-sm font-semibold text-foreground">
              {displayName || employeeCode}
            </span>
            <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
              {employeeCode} · {role}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="py-2">
            <Link href="/home/account-settings">
              <HugeiconsIcon icon={UserSettings01Icon} strokeWidth={1.8} />
              ตั้งค่าบัญชี
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <form action={signOutAction}>
            <DropdownMenuItem asChild variant="destructive" className="py-2">
              <button type="submit" className="w-full">
                <HugeiconsIcon icon={Logout02Icon} strokeWidth={1.8} />
                ออกจากระบบ
              </button>
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
