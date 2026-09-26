"use server";

import { revalidatePath } from "next/cache";

import { getCurrentSession } from "@/lib/auth/current-session";
import { importStaffUsers } from "@/lib/import-users/import-staff-users";
import {
  buildPersonnelImportPreview,
  parseStaffExcel,
} from "@/lib/import-users/parse-staff-excel";
import type {
  ImportStaffUsersSummary,
  PersonnelImportPreview,
} from "@/lib/import-users/types";

export type PersonnelPreviewActionResult = {
  ok: boolean;
  message: string;
  preview: PersonnelImportPreview | null;
};

export type PersonnelImportActionResult = {
  ok: boolean;
  message: string;
  summary: ImportStaffUsersSummary | null;
};

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".xlsx", ".xls"]);

export async function previewPersonnelImportAction(
  formData: FormData,
): Promise<PersonnelPreviewActionResult> {
  const authorizationError = await requireAdmin();
  if (authorizationError) {
    return { ok: false, message: authorizationError, preview: null };
  }

  const fileResult = getValidatedFile(formData);
  if (typeof fileResult === "string") {
    return { ok: false, message: fileResult, preview: null };
  }

  try {
    const parsed = parseStaffExcel(Buffer.from(await fileResult.arrayBuffer()));
    const preview = buildPersonnelImportPreview(parsed, fileResult.name);

    return {
      ok: parsed.errors.length === 0,
      message:
        parsed.errors.length === 0
          ? "ตรวจสอบไฟล์เรียบร้อย พร้อมนำเข้าข้อมูล"
          : "พบข้อมูลที่ต้องแก้ไขก่อนนำเข้า",
      preview,
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error, "ไม่สามารถอ่านไฟล์ Excel ได้"),
      preview: null,
    };
  }
}

export async function confirmPersonnelImportAction(
  formData: FormData,
): Promise<PersonnelImportActionResult> {
  const authorizationError = await requireAdmin();
  if (authorizationError) {
    return { ok: false, message: authorizationError, summary: null };
  }

  const fileResult = getValidatedFile(formData);
  if (typeof fileResult === "string") {
    return { ok: false, message: fileResult, summary: null };
  }

  try {
    const parsed = parseStaffExcel(Buffer.from(await fileResult.arrayBuffer()));
    if (parsed.errors.length > 0) {
      return {
        ok: false,
        message: "ไฟล์มีข้อมูลไม่ถูกต้อง กรุณาตรวจสอบไฟล์อีกครั้ง",
        summary: null,
      };
    }

    const summary = await importStaffUsers(parsed.rows);
    revalidatePath("/home/schedule-rounds");
    revalidatePath("/home/personnel-import");

    return {
      ok: summary.failedCount === 0 && summary.skippedCount === 0,
      message:
        summary.failedCount === 0 && summary.skippedCount === 0
          ? `นำเข้าข้อมูลบุคลากรสำเร็จ ${summary.successCount} รายการ`
          : `นำเข้าได้ ${summary.successCount} รายการ ข้าม ${summary.skippedCount} รายการ และไม่สำเร็จ ${summary.failedCount} รายการ`,
      summary: { ...summary, totalRows: parsed.totalRows },
    };
  } catch (error) {
    return {
      ok: false,
      message: getErrorMessage(error, "ไม่สามารถนำเข้าข้อมูลบุคลากรได้"),
      summary: null,
    };
  }
}

async function requireAdmin() {
  const session = await getCurrentSession();
  if (!session) return "กรุณาเข้าสู่ระบบก่อนใช้งาน";
  if (!session.roles.includes("admin")) return "เฉพาะผู้ดูแลระบบเท่านั้นที่นำเข้าข้อมูลได้";
  return null;
}

function getValidatedFile(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return "กรุณาเลือกไฟล์ Excel";
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return "ไฟล์มีขนาดใหญ่เกิน 10 MB";
  }
  if (!isAllowedFile(file.name)) {
    return "รองรับเฉพาะไฟล์ .xlsx หรือ .xls";
  }
  return file;
}

function isAllowedFile(fileName: string) {
  const lowerFileName = fileName.toLowerCase();
  return Array.from(ALLOWED_EXTENSIONS).some((extension) =>
    lowerFileName.endsWith(extension),
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
