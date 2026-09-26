export type StaffAccountState = {
  id: string;
  user: { status: string } | null;
};

export function isGaEligibleStaffAccount(
  staff: Pick<StaffAccountState, "user">,
) {
  return staff.user === null || staff.user.status === "active";
}

export function collectInactiveStaffIds(staff: StaffAccountState[]) {
  return new Set(
    staff
      .filter((member) => !isGaEligibleStaffAccount(member))
      .map((member) => member.id),
  );
}

export function formatInactiveStaffRequestWarning(staff: {
  code: string;
  name: string;
  count: number;
}) {
  return `บัญชี inactive ของ ${staff.code} ${staff.name} มีคำขอค้างอยู่ ${staff.count} รายการในรอบนี้ ระบบไม่นำบุคลากรและคำขอดังกล่าวไปจัดตาราง`;
}
