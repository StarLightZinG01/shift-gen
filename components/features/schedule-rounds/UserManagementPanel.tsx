"use client";

import { useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  MoreHorizontalIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { saveManagedUserAction } from "@/app/actions/schedule-rounds-users";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  UserManagementData,
  UserManagementRole,
  UserManagementRow,
} from "@/lib/schedule-rounds/types";

const PAGE_SIZE = 6;

const emptyUser: UserManagementRow = {
  id: "",
  username: "",
  displayName: "",
  employeeCode: null,
  status: "active",
  role: "nurse",
  staffId: null,
  staffCode: "",
  homeWardId: null,
  homeWardCode: "-",
  allowedWardIds: [],
  allowedWardCodes: [],
  position: "",
  payPosition: "",
  otRate: "0",
  shiftPayRate: "0",
  isHead: false,
  isTrainee: false,
};

type UserManagementPanelProps = {
  data: UserManagementData;
};

export function UserManagementPanel({ data }: UserManagementPanelProps) {
  const [users, setUsers] = useState(data.users);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [wardFilter, setWardFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<UserManagementRow | null>(null);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchKeyword =
        !keyword ||
        user.username.toLowerCase().includes(keyword) ||
        user.displayName.toLowerCase().includes(keyword) ||
        (user.employeeCode ?? "").toLowerCase().includes(keyword) ||
        user.staffCode.toLowerCase().includes(keyword);
      const matchRole = roleFilter === "all" || user.role === roleFilter;
      const matchWard =
        wardFilter === "all" ||
        user.homeWardId === wardFilter ||
        user.allowedWardIds.includes(wardFilter);
      const matchStatus =
        statusFilter === "all" || user.status === statusFilter;

      return matchKeyword && matchRole && matchWard && matchStatus;
    });
  }, [roleFilter, search, statusFilter, users, wardFilter]);

  const totalPages = Math.max(Math.ceil(filteredUsers.length / PAGE_SIZE), 1);
  const currentPage = Math.min(page, totalPages);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  function resetPage() {
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <FilterField label="ค้นหา">
            <div className="relative">
              <HugeiconsIcon
                icon={Search01Icon}
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPage();
                }}
                placeholder="ชื่อ / รหัส"
                className="h-10 rounded-md bg-white pl-10"
              />
            </div>
          </FilterField>

          <FilterField label="บทบาท">
            <Select
              value={roleFilter}
              onValueChange={(value) => {
                setRoleFilter(value);
                resetPage();
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-md bg-white">
                <SelectValue placeholder="ทั้งหมด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="nurse">พยาบาล</SelectItem>
                <SelectItem value="ward_head">หัวหน้าวอร์ด</SelectItem>
                <SelectItem value="admin">ผู้ดูแลระบบ</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="วอร์ด">
            <Select
              value={wardFilter}
              onValueChange={(value) => {
                setWardFilter(value);
                resetPage();
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-md bg-white">
                <SelectValue placeholder="ทั้งหมด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                {data.wards.map((ward) => (
                  <SelectItem key={ward.id} value={ward.id}>
                    {ward.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="สถานะ">
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value);
                resetPage();
              }}
            >
              <SelectTrigger className="h-10 w-full rounded-md bg-white">
                <SelectValue placeholder="ทั้งหมด" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="active">ใช้งาน</SelectItem>
                <SelectItem value="inactive">ปิดใช้งาน</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
        </div>

        <Button
          type="button"
          className="mt-4 h-9 rounded-md"
          onClick={() => setEditingUser(emptyUser)}
        >
          <HugeiconsIcon icon={Add01Icon} size={17} strokeWidth={2} />
          เพิ่มผู้ใช้
        </Button>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#EAF4F7]">
              <TableRow className="hover:bg-[#EAF4F7]">
                <TableHead className="min-w-24">รหัส</TableHead>
                <TableHead className="min-w-48">ชื่อผู้ใช้</TableHead>
                <TableHead className="min-w-36">บทบาท</TableHead>
                <TableHead className="min-w-32">วอร์ดหลัก</TableHead>
                <TableHead className="min-w-48">วอร์ดที่ดูแล</TableHead>
                <TableHead className="min-w-28">สถานะ</TableHead>
                <TableHead className="min-w-28 text-center">
                  การดำเนินการ
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedUsers.length > 0 ? (
                paginatedUsers.map((user) => (
                  <TableRow key={user.id} className="bg-white">
                    <TableCell className="font-medium text-muted-foreground">
                      {user.staffCode || user.employeeCode || user.username}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="font-medium">{user.displayName}</p>
                        <p className="text-xs text-muted-foreground">
                          {user.username}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RoleBadge role={user.role} />
                    </TableCell>
                    <TableCell>{user.homeWardCode}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        {user.allowedWardCodes.length > 0 ? (
                          user.allowedWardCodes.map((wardCode) => (
                            <span
                              key={wardCode}
                              className="rounded-full bg-[#EEF7F8] px-2.5 py-1 text-xs font-semibold text-[#42545A]"
                            >
                              {wardCode}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={user.status} />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-md"
                        aria-label={`แก้ไข ${user.displayName}`}
                        onClick={() => setEditingUser(user)}
                      >
                        <HugeiconsIcon icon={MoreHorizontalIcon} size={18} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-28 text-center text-muted-foreground"
                  >
                    ไม่พบข้อมูลผู้ใช้
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            แสดง {paginatedUsers.length} จาก {filteredUsers.length} รายการ
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setPage((value) => Math.max(value - 1, 1))}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={16} />
              ก่อนหน้า
            </Button>
            <span className="rounded-md bg-[#EEF7F8] px-3 py-1 text-sm font-medium">
              {currentPage} / {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((value) => Math.min(value + 1, totalPages))}
            >
              ถัดไป
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
            </Button>
          </div>
        </div>
      </section>

      {editingUser ? (
        <UserEditorDialog
          key={editingUser.id || "new-user"}
          user={editingUser}
          wards={data.wards}
          onClose={() => setEditingUser(null)}
          onSaved={(savedUser) => {
            setUsers((currentUsers) => {
              const exists = currentUsers.some(
                (user) => user.id === savedUser.id,
              );

              return exists
                ? currentUsers.map((user) =>
                    user.id === savedUser.id ? savedUser : user,
                  )
                : [savedUser, ...currentUsers];
            });
            setEditingUser(null);
          }}
        />
      ) : null}
    </div>
  );
}

function UserEditorDialog({
  user,
  wards,
  onClose,
  onSaved,
}: {
  user: UserManagementRow | null;
  wards: UserManagementData["wards"];
  onClose: () => void;
  onSaved: (user: UserManagementRow) => void;
}) {
  const [draft, setDraft] = useState<UserManagementRow>(user ?? emptyUser);
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  const isOpen = true;
  const isAdmin = draft.role === "admin";

  function updateDraft<K extends keyof UserManagementRow>(
    key: K,
    value: UserManagementRow[K],
  ) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function toggleAllowedWard(wardId: string) {
    setDraft((current) => {
      const exists = current.allowedWardIds.includes(wardId);

      return {
        ...current,
        allowedWardIds: exists
          ? current.allowedWardIds.filter((id) => id !== wardId)
          : [...current.allowedWardIds, wardId],
      };
    });
  }

  function handleSubmit() {
    startTransition(async () => {
      const allowedWardIds = Array.from(
        new Set(
          [draft.homeWardId, ...draft.allowedWardIds].filter(
            (wardId): wardId is string => Boolean(wardId),
          ),
        ),
      );
      const result = await saveManagedUserAction({
        userId: draft.id || null,
        username: draft.username,
        displayName: draft.displayName,
        employeeCode: draft.employeeCode ?? "",
        status: draft.status,
        role: draft.role,
        password,
        staffCode: draft.staffCode,
        homeWardId: isAdmin ? null : draft.homeWardId,
        allowedWardIds: isAdmin ? [] : allowedWardIds,
        position: draft.position,
        payPosition: draft.payPosition,
        otRate: draft.otRate,
        shiftPayRate: draft.shiftPayRate,
        isTrainee: draft.isTrainee,
      });

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      onSaved(result.user);
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b px-6 pt-6 pb-4">
          <DialogTitle>
            {draft.id ? "แก้ไขข้อมูลผู้ใช้" : "เพิ่มผู้ใช้"}
          </DialogTitle>
          <DialogDescription>
            แก้ไขข้อมูลบัญชี บทบาท วอร์ด และข้อมูลบุคลากรของผู้ใช้นี้
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-6 pb-6">
          <section className="space-y-4">
            <SectionHeading
              title="บัญชีผู้ใช้"
              description="ข้อมูลสำหรับเข้าสู่ระบบ"
            />
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="รหัสพนักงาน"
                value={draft.employeeCode ?? ""}
                onChange={(value) => updateDraft("employeeCode", value || null)}
              />
              <TextField
                label="ชื่อผู้ใช้"
                value={draft.username}
                onChange={(value) => updateDraft("username", value)}
              />
              <TextField
                label={draft.id ? "รหัสผ่านใหม่" : "รหัสผ่าน"}
                hint={draft.id ? "เว้นว่างหากไม่ต้องการเปลี่ยน" : undefined}
                type="password"
                value={password}
                onChange={setPassword}
              />
              <TextField
                label="ชื่อที่แสดง"
                value={draft.displayName}
                onChange={(value) => updateDraft("displayName", value)}
              />
              {!isAdmin ? (
                <TextField
                  label="รหัสบุคลากร"
                  value={draft.staffCode}
                  onChange={(value) => updateDraft("staffCode", value)}
                />
              ) : null}
            </div>
          </section>

          <section className="space-y-4 border-t pt-8">
            <SectionHeading
              title="บทบาทและสถานะ"
              description="สิทธิ์การใช้งานในระบบ"
            />
            <SegmentedField
              label="บทบาท"
              value={draft.role}
              onChange={(value) =>
                updateDraft("role", value as UserManagementRole)
              }
              options={[
                { label: "พยาบาล", value: "nurse" },
                { label: "หัวหน้าวอร์ด", value: "ward_head" },
                { label: "ผู้ดูแลระบบ", value: "admin" },
              ]}
            />
            <SegmentedField
              label="สถานะการใช้งาน"
              value={draft.status}
              onChange={(value) => updateDraft("status", value)}
              options={[
                { label: "ใช้งาน", value: "active" },
                { label: "ปิดใช้งาน", value: "inactive" },
              ]}
            />
          </section>

          {!isAdmin ? (
            <>
              <section className="space-y-4 border-t pt-8">
                <WardPickerField
                  label="วอร์ดหลัก"
                  description="เลือกวอร์ดที่ผู้ใช้สังกัด"
                  value={draft.homeWardId ?? ""}
                  onChange={(value) => updateDraft("homeWardId", value)}
                  wards={wards}
                />
              </section>

              <section className="space-y-4 border-t pt-8">
                <SectionHeading
                  title="ข้อมูลตำแหน่ง"
                  description="ตำแหน่งและอัตราค่าตอบแทน"
                />
                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    label="ตำแหน่ง"
                    value={draft.position}
                    onChange={(value) => updateDraft("position", value)}
                  />
                  <TextField
                    label="ตำแหน่งเบิกจ่าย"
                    value={draft.payPosition}
                    onChange={(value) => updateDraft("payPosition", value)}
                  />
                  <TextField
                    label="ค่า OT (บาท/ชม.)"
                    type="number"
                    value={draft.otRate}
                    onChange={(value) => updateDraft("otRate", value)}
                  />
                  <TextField
                    label="ค่าเวร (บาท/เวร)"
                    type="number"
                    value={draft.shiftPayRate}
                    onChange={(value) => updateDraft("shiftPayRate", value)}
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-lg border bg-white px-4 py-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={draft.isTrainee}
                    onChange={(event) =>
                      updateDraft("isTrainee", event.target.checked)
                    }
                    className="size-4 accent-[#008585]"
                  />
                  เป็นพยาบาลฝึกหัด
                </label>
              </section>

              <section className="space-y-3 border-t pt-8">
                <SectionHeading
                  title="วอร์ดที่ขึ้นเวรได้"
                  description="เลือกวอร์ดเพิ่มเติมที่ผู้ใช้สามารถขึ้นเวรได้"
                />
                <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto rounded-xl border bg-[#F8FDFE] p-3">
                  {wards.map((ward) => {
                    const checked = draft.allowedWardIds.includes(ward.id);

                    return (
                      <button
                        key={ward.id}
                        type="button"
                        onClick={() => toggleAllowedWard(ward.id)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                          checked
                            ? "border-brand bg-brand/10 text-brand"
                            : "border-[#DDEBED] bg-white text-muted-foreground hover:border-brand/30 hover:text-brand"
                        }`}
                      >
                        {ward.code}
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          ) : (
            <section className="border-t pt-8">
              <div className="rounded-xl border border-dashed bg-[#F8FDFE] px-4 py-5 text-sm text-muted-foreground">
                ผู้ดูแลระบบไม่จำเป็นต้องผูกกับวอร์ดหรือข้อมูลบุคลากร
              </div>
            </section>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t bg-white px-6 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button type="button" disabled={isPending} onClick={handleSubmit}>
            {isPending ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function TextField({
  label,
  hint,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "password" | "number";
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
      </div>
      <Input
        type={type}
        min={type === "number" ? 0 : undefined}
        step={type === "number" ? "0.01" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md bg-white"
      />
    </div>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function SegmentedField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div
        className="grid gap-2 rounded-md border bg-[#F8FDFE] p-1"
        style={{
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        }}
      >
        {options.map((option) => {
          const active = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={`min-h-9 rounded-[6px] px-3 py-2 text-sm font-medium transition ${
                active
                  ? "bg-brand text-white shadow-sm"
                  : "bg-transparent text-muted-foreground hover:bg-white hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WardPickerField({
  label,
  description,
  value,
  onChange,
  wards,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  wards: UserManagementData["wards"];
}) {
  const [keyword, setKeyword] = useState("");
  const selectedWard = wards.find((ward) => ward.id === value);
  const filteredWards = useMemo(() => {
    const query = keyword.trim().toLowerCase();

    if (!query) {
      return wards;
    }

    return wards.filter(
      (ward) =>
        ward.code.toLowerCase().includes(query) ||
        ward.name.toLowerCase().includes(query),
    );
  }, [keyword, wards]);

  return (
    <div className="space-y-4">
      <SectionHeading title={label} description={description} />
      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="relative border-b">
          <HugeiconsIcon
            icon={Search01Icon}
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="ค้นหาวอร์ด..."
            className="h-10 rounded-none border-0 bg-white pl-9 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="max-h-56 overflow-y-auto">
          {filteredWards.length > 0 ? (
            filteredWards.map((ward) => {
              const active = ward.id === value;

              return (
                <button
                  key={ward.id}
                  type="button"
                  onClick={() => onChange(ward.id)}
                  className={`flex w-full items-center justify-between gap-4 px-4 py-2.5 text-left text-sm transition ${
                    active
                      ? "bg-brand/10 text-brand"
                      : "bg-white text-foreground hover:bg-[#F8FDFE] hover:text-brand"
                  }`}
                >
                  <span className="font-medium">{ward.code}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {ward.name}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              ไม่พบวอร์ดที่ค้นหา
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t bg-[#F8FDFE] px-4 py-2 text-xs text-muted-foreground">
          <span>วอร์ดที่เลือก</span>
          <span className="rounded-full bg-brand/10 px-2.5 py-1 font-semibold text-brand">
            {selectedWard ? selectedWard.code : "ยังไม่ได้เลือก"}
          </span>
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: UserManagementRole }) {
  const classNameByRole: Record<UserManagementRole, string> = {
    nurse: "bg-emerald-100 text-emerald-700",
    ward_head: "bg-blue-100 text-blue-700",
    admin: "bg-violet-100 text-violet-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classNameByRole[role]}`}
    >
      {formatRole(role)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === "active";

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
        isActive ? "bg-brand/10 text-brand" : "bg-slate-100 text-slate-600"
      }`}
    >
      {isActive ? "ใช้งาน" : "ปิดใช้งาน"}
    </span>
  );
}

function formatRole(role: UserManagementRole) {
  const roleLabels: Record<UserManagementRole, string> = {
    nurse: "พยาบาล",
    ward_head: "หัวหน้าวอร์ด",
    admin: "ผู้ดูแลระบบ",
  };

  return roleLabels[role];
}
