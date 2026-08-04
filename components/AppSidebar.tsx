"use client";

import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  appNavigationItems,
  getVisibleNavigationItems,
  isActivePath,
} from "@/lib/app-navigation";
import {
  AiContentGenerator01Icon,
  Calendar03Icon,
  CalendarSetting01Icon,
  CalendarSyncIcon,
  CalendarXIcon,
  DatabaseImportIcon,
  Home07Icon,
  Logout02Icon,
  UserShield01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const iconByUrl: Record<string, typeof Home07Icon> = {
  "/home": Home07Icon,
  "/home/my-schedule": Calendar03Icon,
  "/home/leave-requests": CalendarXIcon,
  "/home/schedule-management": CalendarSetting01Icon,
  "/home/schedule-rounds": CalendarSyncIcon,
  "/admin/import-users": DatabaseImportIcon,
  "/admin/create-admin": UserShield01Icon,
} as const;

type AppSidebarProps = {
  roles: string[];
};

export default function AppSidebar({ roles }: AppSidebarProps) {
  const pathname = usePathname();
  const visibleItems = getVisibleNavigationItems(roles);
  const mainItems = visibleItems.filter((item) => item.section === "main");
  const adminItems = visibleItems.filter((item) => item.section === "admin");

  return (
    <Sidebar
      collapsible="icon"
      className="border-[#C9D5DB] [--sidebar:#EEF7F8] [--sidebar-accent:#D0ECEA] [--sidebar-accent-foreground:#008585]"
    >
      <SidebarHeader className="px-3 py-6">
        <div className="flex items-center gap-2 px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand text-white">
            <HugeiconsIcon icon={AiContentGenerator01Icon} size={18} />
          </div>
          <div className="leading-tight group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-bold text-foreground">ShiftGen</p>
            <p className="text-[10px] text-muted-foreground">
              ระบบจัดตารางเวร
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 group-data-[collapsible=icon]:px-2">
        <SidebarGroupLabel className="px-2 text-xs font-medium text-[#7A858A] group-data-[collapsible=icon]:hidden">
          เมนูหลัก
        </SidebarGroupLabel>
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
              {mainItems.map((item) => (
                <AppSidebarItem
                  key={item.url}
                  item={item}
                  isActive={isActivePath(pathname, item.url)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {adminItems.length > 0 ? (
        <SidebarGroup className="mt-6 p-0">
          <SidebarGroupLabel className="px-2 text-xs font-medium text-[#7A858A] group-data-[collapsible=icon]:hidden">
            ผู้ดูแลระบบ
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
              {adminItems.map((item) => (
                <AppSidebarItem
                  key={item.url}
                  item={item}
                  isActive={isActivePath(pathname, item.url)}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter>
        <form action={signOutAction}>
          <Button type="submit" className="w-full">
            <HugeiconsIcon icon={Logout02Icon} strokeWidth={2} />
            ออกจากระบบ
          </Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  );
}

type AppSidebarItemProps = {
  item: (typeof appNavigationItems)[number];
  isActive: boolean;
};

function AppSidebarItem({ item, isActive }: AppSidebarItemProps) {
  const icon = iconByUrl[item.url] ?? Calendar03Icon;

  return (
    <SidebarMenuItem className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className="h-9 rounded-lg px-2.5 text-[13px] font-medium text-[#6F7A80] transition-colors hover:bg-[#E4F7F5] hover:text-brand data-[active=true]:bg-[#D6F4F1] data-[active=true]:font-semibold data-[active=true]:text-brand group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:[&>span]:hidden [&_svg]:text-current"
      >
        <Link href={item.url}>
          <HugeiconsIcon
            icon={icon}
            size={18}
            strokeWidth={1.7}
          />
          <span>{item.title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
