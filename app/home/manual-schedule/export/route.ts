import { getCurrentSession } from "@/lib/auth/session";
import {
  buildScheduleExcel,
  buildScheduleExcelFileName,
} from "@/lib/my-schedule/export-excel";
import { getWardScheduleExportData } from "@/lib/my-schedule/queries";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session || !session.roles.includes("admin")) {
    return textResponse("เฉพาะผู้ดูแลระบบเท่านั้นที่ดาวน์โหลดไฟล์นี้ได้", 403);
  }

  const url = new URL(request.url);
  const versionId = url.searchParams.get("versionId") ?? "";
  const wardId = url.searchParams.get("wardId") ?? "";
  if (!versionId || !wardId) {
    return textResponse("กรุณาระบุเวอร์ชันและวอร์ด", 400);
  }

  const data = await getWardScheduleExportData({ versionId, wardId });
  if (!data) {
    return textResponse("ไม่พบตารางเวรสำหรับดาวน์โหลด", 404);
  }

  const workbook = await buildScheduleExcel(data);
  const fileName = buildScheduleExcelFileName(data);
  return new Response(new Uint8Array(workbook), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}

function textResponse(message: string, status: number) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
