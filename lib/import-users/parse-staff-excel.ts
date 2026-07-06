import * as XLSX from "xlsx";
import { z } from "zod";

import type { ParsedStaffImport, StaffImportRow } from "./types";

const COLUMN_ALIASES = {
  staffCode: ["รหัส", "staff_code", "staffCode", "Staff Code", "code"],
  fullName: ["ชื่อ", "full_name", "fullName", "Full Name", "name"],
  homeWard: ["วอร์ดหลัก", "home_ward", "homeWard", "Home Ward", "ward"],
  role: ["บทบาท", "role", "Role"],
  position: ["ตำแหน่ง", "position", "Position"],
  payPosition: [
    "ตำแหน่งเบิกจ่าย",
    "pay_position",
    "payPosition",
    "Pay Position",
  ],
  otRate: ["OT", "ot_rate", "otRate", "OT Rate"],
  shiftPayRate: ["ค่าเวร", "shift_pay_rate", "shiftPayRate", "Shift Pay Rate"],
  isTrainee: [
    "พยาบาลฝึกหัด",
    "ฝึกหัด",
    "trainee",
    "is_trainee",
    "isTrainee",
  ],
  allowedWards: [
    "วอร์ดที่ขึ้นได้",
    "allowed_wards",
    "allowedWards",
    "Allowed Wards",
  ],
} as const;

type ColumnKey = keyof typeof COLUMN_ALIASES;
type RawExcelRow = Record<string, unknown>;

const staffRowSchema = z.object({
  staffCode: z.string().min(1, "ต้องระบุรหัส"),
  fullName: z.string().min(1, "ต้องระบุชื่อ"),
  homeWard: z.string().min(1, "ต้องระบุวอร์ดหลัก"),
  role: z.string().optional(),
  position: z.string().optional(),
  payPosition: z.string().optional(),
  otRate: z.number().nonnegative("OT ต้องเป็นตัวเลข 0 หรือมากกว่า"),
  shiftPayRate: z.number().nonnegative("ค่าเวรต้องเป็นตัวเลข 0 หรือมากกว่า"),
  isHead: z.boolean(),
  isTrainee: z.boolean(),
  allowedWards: z.array(z.string()),
});

export function parseStaffExcel(input: Buffer | ArrayBuffer): ParsedStaffImport {
  const workbook = XLSX.read(input, { type: "buffer" });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return {
      rows: [],
      errors: [{ rowNumber: 1, message: "ไม่พบ sheet ในไฟล์ Excel" }],
      totalRows: 0,
    };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<RawExcelRow>(sheet, {
    defval: "",
    raw: false,
  });

  const rows: StaffImportRow[] = [];
  const errors: ParsedStaffImport["errors"] = [];

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const position = emptyToUndefined(getString(rawRow, "position"));
    const candidate = {
      staffCode: getString(rawRow, "staffCode"),
      fullName: getString(rawRow, "fullName"),
      homeWard: getString(rawRow, "homeWard"),
      role: emptyToUndefined(getString(rawRow, "role")),
      position,
      payPosition: emptyToUndefined(getString(rawRow, "payPosition")),
      otRate: getNumber(rawRow, "otRate"),
      shiftPayRate: getNumber(rawRow, "shiftPayRate"),
      isHead: isHeadPosition(position),
      isTrainee: getBoolean(rawRow, "isTrainee"),
      allowedWards: splitAllowedWards(getString(rawRow, "allowedWards")),
    };

    const parsed = staffRowSchema.safeParse(candidate);

    if (!parsed.success) {
      errors.push({
        rowNumber,
        staffCode: candidate.staffCode || undefined,
        message: parsed.error.issues.map((issue) => issue.message).join(", "),
      });
      return;
    }

    rows.push({
      rowNumber,
      ...parsed.data,
    });
  });

  return {
    rows,
    errors,
    totalRows: rawRows.length,
  };
}

function getString(row: RawExcelRow, key: ColumnKey) {
  const value = getAliasedValue(row, key);
  return String(value ?? "").trim();
}

function getNumber(row: RawExcelRow, key: ColumnKey) {
  const value = getString(row, key).replace(/,/g, "");

  if (!value) {
    return 0;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : Number.NaN;
}

function getBoolean(row: RawExcelRow, key: ColumnKey) {
  const value = getString(row, key).trim().toLowerCase();

  if (!value) {
    return false;
  }

  if (["true", "yes", "y", "1", "ใช่", "ฝึกหัด", "trainee"].includes(value)) {
    return true;
  }

  if (["false", "no", "n", "0", "ไม่ใช่"].includes(value)) {
    return false;
  }

  return false;
}

function isHeadPosition(position?: string) {
  return position?.includes("หัวหน้า") ?? false;
}

function getAliasedValue(row: RawExcelRow, key: ColumnKey) {
  const normalizedRow = new Map(
    Object.entries(row).map(([column, value]) => [normalizeColumn(column), value]),
  );

  for (const alias of COLUMN_ALIASES[key]) {
    const value = normalizedRow.get(normalizeColumn(alias));

    if (value !== undefined) {
      return value;
    }
  }

  return "";
}

function normalizeColumn(column: string) {
  return column.trim().toLowerCase().replace(/[\s_-]/g, "");
}

function emptyToUndefined(value: string) {
  return value ? value : undefined;
}

function splitAllowedWards(value: string) {
  return value
    .split(/[,;|\n]+/)
    .map((ward) => ward.trim())
    .filter(Boolean);
}
