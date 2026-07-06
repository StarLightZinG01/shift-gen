"use server";

import { getCurrentSession } from "@/lib/auth/session";
import { importStaffUsers, mergeImportErrors } from "@/lib/import-users/import-staff-users";
import { parseStaffExcel } from "@/lib/import-users/parse-staff-excel";
import type { ImportStaffUsersSummary } from "@/lib/import-users/types";

export type ImportUsersActionState = {
  message: string;
  summary: ImportStaffUsersSummary | null;
};

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".xlsx", ".xls", ".csv"]);

export async function importUsersAction(
  _prevState: ImportUsersActionState,
  formData: FormData,
): Promise<ImportUsersActionState> {
  const session = await getCurrentSession();

  if (!session) {
    return {
      message: "กรุณาเข้าสู่ระบบก่อน import รายชื่อผู้ใช้",
      summary: null,
    };
  }

  const file = formData.get("file");
  const resetPassword = formData.get("resetPassword") === "on";

  if (!(file instanceof File) || file.size === 0) {
    return {
      message: "กรุณาเลือกไฟล์ Excel ก่อน import",
      summary: null,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      message: "ไฟล์มีขนาดใหญ่เกิน 5MB",
      summary: null,
    };
  }

  if (!isAllowedFile(file.name)) {
    return {
      message: "รองรับเฉพาะไฟล์ .xlsx, .xls หรือ .csv",
      summary: null,
    };
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = parseStaffExcel(buffer);
    const importSummary = await importStaffUsers(parsed.rows, {
      resetPassword,
    });
    const summary = mergeImportErrors(importSummary, parsed.errors);

    return {
      message: "",
      summary,
    };
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "ไม่สามารถ import รายชื่อผู้ใช้ได้",
      summary: null,
    };
  }
}

function isAllowedFile(fileName: string) {
  const lowerFileName = fileName.toLowerCase();
  return Array.from(ALLOWED_EXTENSIONS).some((extension) =>
    lowerFileName.endsWith(extension),
  );
}
