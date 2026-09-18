import { getCurrentSession } from "@/lib/auth/session";
import {
  buildScheduleExcel,
  buildScheduleExcelFileName,
} from "@/lib/my-schedule/export-excel";
import { getMySchedulePageData } from "@/lib/my-schedule/queries";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return new Response("กรุณาเข้าสู่ระบบก่อนดาวน์โหลดตารางเวร", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const url = new URL(request.url);
  const data = await getMySchedulePageData({
    session,
    versionId: url.searchParams.get("versionId") ?? undefined,
  });
  if (data.status !== "loaded") {
    return new Response(data.description, {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
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
