import { createHash } from "node:crypto";

import * as XLSX from "xlsx";
import { z } from "zod";

import type {
  ImportedStaffCategory,
  ParsedStaffImport,
  PersonnelImportPreview,
  StaffImportRow,
} from "./types";

const COLUMN_ALIASES = {
  staffCode: ["รหัสบุคลากร (ID)", "รหัสบุคลากร", "รหัส", "staff_code"],
  fullName: ["ชื่อ-นามสกุล", "ชื่อ นามสกุล", "ชื่อ", "full_name"],
  homeWard: [
    "หน่วยงาน (Unit/SMU ย่อย)",
    "หน่วยงาน",
    "วอร์ดหลัก",
    "home_ward",
  ],
  position: ["ตำแหน่ง", "position"],
  payPosition: [
    "ตำแหน่งตามการเบิกจ่าย",
    "ตำแหน่งเบิกจ่าย",
    "pay_position",
  ],
  otRate: ["ค่าตอบแทน OT", "OT", "ot_rate"],
  shiftPayRate: ["ค่าเวร (บ ด)", "ค่าเวร", "shift_pay_rate"],
  isNewNurse: [
    "พยาบาลใหม่ (ขึ้นเวรคู่ไม่ได้)",
    "พยาบาลใหม่",
    "is_new_nurse",
  ],
  canBeInCharge: ["Incharge", "in_charge", "can_be_in_charge"],
} as const;

const REQUIRED_COLUMNS = [
  "staffCode",
  "homeWard",
  "position",
  "payPosition",
  "otRate",
  "shiftPayRate",
  "isNewNurse",
  "canBeInCharge",
] as const;

type ColumnKey = keyof typeof COLUMN_ALIASES;
type RawExcelRow = Record<string, unknown>;

const staffRowSchema = z.object({
  staffCode: z.string().min(1),
  generatedStaffCode: z.boolean(),
  fullName: z.string().min(1),
  homeWard: z.string().min(1, "ต้องระบุหน่วยงาน"),
  position: z.string().min(1, "ต้องระบุตำแหน่ง"),
  payPosition: z.string().min(1, "ต้องระบุตำแหน่งตามการเบิกจ่าย"),
  staffCategory: z.enum(["RN", "PN", "NA", "OTHER"]),
  otRate: z.number().finite("ค่าตอบแทน OT ต้องเป็นตัวเลข").nonnegative(),
  shiftPayRate: z.number().finite("ค่าเวรต้องเป็นตัวเลข").nonnegative(),
  isHead: z.boolean(),
  isNewNurse: z.boolean(),
  canBeInCharge: z.boolean(),
});

export function parseStaffExcel(input: Buffer | ArrayBuffer): ParsedStaffImport {
  const workbook = XLSX.read(input, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    return emptyResult("ไม่พบแผ่นงานในไฟล์ Excel");
  }

  const sheet = workbook.Sheets[sheetName];
  const headerRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
  const headers = (headerRows[0] ?? []).map((value) => String(value).trim());
  const missingColumns = REQUIRED_COLUMNS.filter(
    (key) => !hasAliasedColumn(headers, key),
  );

  if (missingColumns.length > 0) {
    return {
      sheetName,
      rows: [],
      errors: [
        {
          rowNumber: 1,
          message: `ไม่พบคอลัมน์ที่จำเป็น: ${missingColumns
            .map((key) => COLUMN_ALIASES[key][0])
            .join(", ")}`,
        },
      ],
      warnings: [],
      totalRows: Math.max(headerRows.length - 1, 0),
    };
  }

  const rawRows = XLSX.utils.sheet_to_json<RawExcelRow>(sheet, {
    defval: "",
    raw: true,
  });
  const candidates: StaffImportRow[] = [];
  const errors: ParsedStaffImport["errors"] = [];
  const warnings: ParsedStaffImport["warnings"] = [];
  const hasFullNameColumn = hasAliasedColumn(headers, "fullName");

  rawRows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    const sourceCode = normalizeCode(getString(rawRow, "staffCode"));
    const generatedStaffCode = !sourceCode;
    const staffCode =
      sourceCode ||
      makeGeneratedStaffCode({
        rowNumber,
        homeWard: getString(rawRow, "homeWard"),
        position: getString(rawRow, "position"),
        payPosition: getString(rawRow, "payPosition"),
      });
    const position = getString(rawRow, "position");
    const payPosition = getString(rawRow, "payPosition");
    const newNurseValue = getBoolean(rawRow, "isNewNurse");
    const inChargeValue = getBoolean(rawRow, "canBeInCharge");
    const otRateValue = getNumber(rawRow, "otRate");
    const shiftPayRateValue = getNumber(rawRow, "shiftPayRate");
    const candidate = {
      staffCode,
      generatedStaffCode,
      fullName: getString(rawRow, "fullName") || staffCode,
      homeWard: getString(rawRow, "homeWard"),
      position,
      payPosition,
      staffCategory: getStaffCategory(payPosition),
      otRate: otRateValue.value,
      shiftPayRate: shiftPayRateValue.value,
      isHead: position.includes("หัวหน้า"),
      isNewNurse: newNurseValue.value,
      canBeInCharge: inChargeValue.value,
    };

    const booleanErrors = [
      newNurseValue.valid ? null : "ค่าพยาบาลใหม่ต้องเป็น True หรือ False",
      inChargeValue.valid ? null : "ค่า Incharge ต้องเป็น True หรือ False",
    ].filter((message): message is string => Boolean(message));
    const numberErrors = [
      otRateValue.valid ? null : "ค่าตอบแทน OT ต้องเป็นตัวเลข",
      shiftPayRateValue.valid ? null : "ค่าเวรต้องเป็นตัวเลข",
    ].filter((message): message is string => Boolean(message));
    const parsed = staffRowSchema.safeParse(candidate);

    if (!parsed.success || booleanErrors.length > 0 || numberErrors.length > 0) {
      errors.push({
        rowNumber,
        staffCode,
        message: [
          ...(parsed.success
            ? []
            : parsed.error.issues.map((issue) => issue.message)),
          ...booleanErrors,
          ...numberErrors,
        ].join(", "),
      });
      return;
    }

    if (generatedStaffCode) {
      warnings.push({
        rowNumber,
        staffCode,
        message: `ไม่มีรหัสบุคลากร ระบบจึงสร้างรหัสภายใน ${staffCode}`,
      });
    }

    if (otRateValue.missing || shiftPayRateValue.missing) {
      const missingLabels = [
        otRateValue.missing && "ค่าตอบแทน OT",
        shiftPayRateValue.missing && "ค่าเวร",
      ].filter(Boolean);
      warnings.push({
        rowNumber,
        staffCode,
        message: `${missingLabels.join(" และ ")}ว่าง ระบบจะใช้ค่า 0`,
      });
    }

    candidates.push({ rowNumber, ...parsed.data });
  });

  const duplicatedCodes = findDuplicatedCodes(candidates);
  const rows = candidates.filter((row) => {
    if (!duplicatedCodes.has(row.staffCode)) {
      return true;
    }

    errors.push({
      rowNumber: row.rowNumber,
      staffCode: row.staffCode,
      message: `รหัสบุคลากร ${row.staffCode} ซ้ำภายในไฟล์`,
    });
    return false;
  });

  if (!hasFullNameColumn) {
    warnings.unshift({
      rowNumber: 1,
      message: "ไฟล์ไม่มีคอลัมน์ชื่อ-นามสกุล ระบบจะใช้รหัสบุคลากรเป็นชื่อแสดงผลเริ่มต้น",
    });
  }

  return {
    sheetName,
    rows,
    errors: errors.sort((a, b) => a.rowNumber - b.rowNumber),
    warnings,
    totalRows: rawRows.length,
  };
}

export function buildPersonnelImportPreview(
  parsed: ParsedStaffImport,
  fileName: string,
): PersonnelImportPreview {
  const categoryCounts: PersonnelImportPreview["categoryCounts"] = {
    RN: 0,
    PN: 0,
    NA: 0,
    OTHER: 0,
  };
  const wardMap = new Map<string, number>();

  for (const row of parsed.rows) {
    categoryCounts[row.staffCategory] += 1;
    wardMap.set(row.homeWard, (wardMap.get(row.homeWard) ?? 0) + 1);
  }

  return {
    fileName,
    sheetName: parsed.sheetName,
    totalRows: parsed.totalRows,
    validRows: parsed.rows.length,
    invalidRows: parsed.errors.length,
    generatedCodeCount: parsed.rows.filter((row) => row.generatedStaffCode).length,
    wardCount: wardMap.size,
    headCount: parsed.rows.filter((row) => row.isHead).length,
    newNurseCount: parsed.rows.filter((row) => row.isNewNurse).length,
    inChargeCount: parsed.rows.filter((row) => row.canBeInCharge).length,
    categoryCounts,
    wardCounts: Array.from(wardMap, ([ward, count]) => ({ ward, count })).sort(
      (a, b) => a.ward.localeCompare(b.ward, "th"),
    ),
    sampleRows: parsed.rows.slice(0, 50),
    errors: parsed.errors,
    warnings: parsed.warnings,
  };
}

function emptyResult(message: string): ParsedStaffImport {
  return {
    sheetName: "",
    rows: [],
    errors: [{ rowNumber: 1, message }],
    warnings: [],
    totalRows: 0,
  };
}

function getString(row: RawExcelRow, key: ColumnKey) {
  return String(getAliasedValue(row, key) ?? "").trim();
}

function getNumber(row: RawExcelRow, key: ColumnKey) {
  const value = getString(row, key).replace(/,/g, "");
  if (!value) return { value: 0, valid: true, missing: true };

  const numberValue = Number(value);
  return {
    value: numberValue,
    valid: Number.isFinite(numberValue) && numberValue >= 0,
    missing: false,
  };
}

function getBoolean(row: RawExcelRow, key: "isNewNurse" | "canBeInCharge") {
  const rawValue = getAliasedValue(row, key);

  if (typeof rawValue === "boolean") {
    return { value: rawValue, valid: true };
  }

  const value = String(rawValue ?? "").trim().toLowerCase();
  if (["true", "yes", "y", "1", "ใช่"].includes(value)) {
    return { value: true, valid: true };
  }
  if (["false", "no", "n", "0", "ไม่ใช่"].includes(value)) {
    return { value: false, valid: true };
  }

  return { value: false, valid: false };
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

function hasAliasedColumn(headers: string[], key: ColumnKey) {
  const normalizedHeaders = new Set(headers.map(normalizeColumn));
  return COLUMN_ALIASES[key].some((alias) =>
    normalizedHeaders.has(normalizeColumn(alias)),
  );
}

function normalizeColumn(column: string) {
  return column.trim().toLowerCase().replace(/[\s_()\-/]/g, "");
}

function normalizeCode(value: string) {
  const code = value.trim();
  return !code || code === "-" ? "" : code.toUpperCase();
}

function makeGeneratedStaffCode(input: {
  rowNumber: number;
  homeWard: string;
  position: string;
  payPosition: string;
}) {
  const digest = createHash("sha1")
    .update(`${input.rowNumber}|${input.homeWard}|${input.position}|${input.payPosition}`)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
  return `AUTO-${digest}`;
}

function getStaffCategory(payPosition: string): ImportedStaffCategory {
  const normalized = payPosition.trim().toUpperCase();
  if (normalized.startsWith("RN")) return "RN";
  if (normalized === "PN") return "PN";
  if (normalized === "NA") return "NA";
  return "OTHER";
}

function findDuplicatedCodes(rows: StaffImportRow[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.staffCode, (counts.get(row.staffCode) ?? 0) + 1);
  }
  return new Set(
    Array.from(counts)
      .filter(([, count]) => count > 1)
      .map(([code]) => code),
  );
}
