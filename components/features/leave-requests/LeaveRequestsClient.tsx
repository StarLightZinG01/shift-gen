"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Calendar03Icon,
  CalendarCheckIcon,
  Delete02Icon,
  SentIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "sonner";

import { saveLeaveRequestsAction } from "@/app/actions/leave-requests";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  leaveRequestTypes,
  leaveRequestWeekDays,
} from "@/lib/leave-requests/constants";
import { formatSelectableWardLabel } from "@/lib/leave-requests/formatters";
import type {
  LeaveRequestDraft,
  LeaveRequestPageData,
  LeaveRequestType,
} from "@/lib/leave-requests/types";
import { cn } from "@/lib/utils";

type LeaveRequestsClientProps = {
  data: LeaveRequestPageData;
};

export function LeaveRequestsClient({
  data,
}: LeaveRequestsClientProps) {
  const hasSelectableWard = data.allowedWards.length > 0;
  const canSubmit = Boolean(data.cycle && data.staffId && hasSelectableWard);
  const [wardId, setWardId] = useState(data.allowedWards[0]?.id ?? "");
  const [requests, setRequests] = useState<LeaveRequestDraft[]>(
    data.existingRequests,
  );
  const [isPending, startTransition] = useTransition();

  const selectedDates = useMemo(
    () => new Set(requests.map((request) => request.date)),
    [requests],
  );

  function toggleDate(date: number) {
    if (!canSubmit) {
      return;
    }

    setRequests((current) => {
      if (current.some((request) => request.date === date)) {
        return current.filter((request) => request.date !== date);
      }

      return [
        ...current,
        { date, type: "Off" as LeaveRequestType, reason: "" },
      ].sort((a, b) => a.date - b.date);
    });
  }

  function updateRequest(
    date: number,
    updates: Partial<Omit<LeaveRequestDraft, "date">>,
  ) {
    setRequests((current) =>
      current.map((request) =>
        request.date === date ? { ...request, ...updates } : request,
      ),
    );
  }

  function removeRequest(date: number) {
    setRequests((current) =>
      current.filter((request) => request.date !== date),
    );
  }

  function handleSubmit() {
    if (!data.cycle) {
      toast.error("ยังไม่มีรอบจัดตารางสำหรับส่งคำขอ");
      return;
    }

    startTransition(async () => {
      const result = await saveLeaveRequestsAction({
        cycleId: data.cycle?.id,
        wardId,
        requests,
      });

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
    });
  }

  if (data.isAdmin && !data.staffId) {
    return (
      <main className="container pb-8">
        <section className="rounded-[22px] border bg-white p-8 text-center shadow-[0_14px_35px_rgba(15,23,42,0.07)] sm:rounded-3xl">
          <HugeiconsIcon
            icon={Calendar03Icon}
            size={36}
            className="mx-auto text-brand"
          />
          <h1 className="mt-4 text-2xl font-bold">
            ผู้ดูแลระบบไม่ต้องยื่นคำขอวันลา
          </h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            บัญชีแอดมินไม่ได้ผูกกับบุคลากรหรือวอร์ดใดโดยตรง
            จึงไม่มีปฏิทินคำขอส่วนตัวให้ส่งในหน้านี้
            หากต้องการตรวจสอบคำขอของวอร์ด ให้ไปที่หน้าข้อมูลการจัดตาราง
          </p>
          <Button asChild className="mt-5 rounded-md">
            <a href="/home/schedule-rounds">ไปหน้าข้อมูลการจัดตาราง</a>
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="container pb-8">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:gap-6">
        <div className="space-y-5">
          <section className="rounded-[22px] border bg-white p-6 shadow-[0_14px_35px_rgba(15,23,42,0.07)] sm:rounded-3xl sm:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/25 bg-brand/12 px-3 py-1 text-xs font-medium text-brand">
                  <HugeiconsIcon icon={Calendar03Icon} size={14} />
                  เดือน {data.cycle?.monthLabel ?? "ยังไม่มีรอบจัดตาราง"}
                </div>
                <h1 className="text-[1.625rem] font-bold leading-tight text-foreground sm:text-3xl">
                  ยื่นคำขอลา / แจ้งวันไม่พร้อมเข้าเวร
                </h1>
                <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <HugeiconsIcon icon={CalendarCheckIcon} size={16} />
                  <span>
                    ส่งก่อนวันที่ <strong className="text-foreground">19</strong>{" "}
                    เวลา{" "}
                    <strong className="text-foreground">
                      {data.cycle?.requestCloseLabel ?? "-"}
                    </strong>
                  </span>
                  <span>เพื่อให้ระบบนำไปใช้จัดตาราง</span>
                </p>
              </div>

              <div className="w-full lg:w-64">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  วอร์ดที่สามารถปฏิบัติงานได้
                </p>
                {hasSelectableWard ? (
                  <Select value={wardId} onValueChange={setWardId}>
                    <SelectTrigger className="h-11 w-full rounded-md border-brand bg-brand px-4 font-semibold text-white shadow-[0_12px_24px_rgba(0,133,133,0.22)] hover:bg-[#006f6f] [&_svg]:text-white">
                      <SelectValue placeholder="เลือกวอร์ด" />
                    </SelectTrigger>
                    <SelectContent>
                      {data.allowedWards.map((ward) => (
                        <SelectItem key={ward.id} value={ward.id}>
                          {formatSelectableWardLabel(ward)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="rounded-md border border-dashed bg-[#F7FCFD] px-4 py-3 text-sm text-muted-foreground">
                    ไม่มีวอร์ดให้เลือก
                  </div>
                )}
              </div>
            </div>
          </section>

          {!hasSelectableWard ? (
            <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-[0_14px_35px_rgba(15,23,42,0.04)] sm:rounded-3xl">
              {data.message ??
                "บัญชีนี้ไม่ได้ผูกกับข้อมูลบุคลากรหรือวอร์ด จึงยังไม่สามารถยื่นคำขอลา / แจ้งวันไม่พร้อมเข้าเวรได้"}
            </div>
          ) : null}

          {data.message && hasSelectableWard ? (
            <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-[0_14px_35px_rgba(15,23,42,0.04)] sm:rounded-3xl">
              {data.message}
            </div>
          ) : null}

          <section className="overflow-hidden rounded-[22px] border bg-white shadow-[0_14px_35px_rgba(15,23,42,0.07)] sm:rounded-3xl">
            <div className="overflow-hidden bg-white sm:overflow-x-auto">
              <div className="min-w-0 sm:min-w-[720px]">
                <div className="grid grid-cols-7 border-b border-[#DDEBED] bg-[#F6FBFC]">
                  {leaveRequestWeekDays.map((day, index) => (
                    <div
                      key={day}
                      className={cn(
                        "flex h-10 items-center px-3 text-xs font-semibold text-[#334155] sm:h-11 sm:text-sm",
                        index === 0 || index === 6 ? "text-red-500" : "",
                      )}
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 bg-white">
                  {Array.from({ length: data.cycle?.firstDayOffset ?? 0 }).map((_, index) => (
                    <div
                      key={`blank-start-${index}`}
                      className="h-[68px] border-r border-b border-[#E4EEF1] bg-white last:border-r-0 sm:h-24 md:h-28"
                    />
                  ))}

                  {Array.from({ length: data.cycle?.daysInMonth ?? 0 }, (_, index) => {
                    const date = index + 1;
                    const selected = selectedDates.has(date);
                    const column = ((data.cycle?.firstDayOffset ?? 0) + index) % 7;
                    const weekend = column === 0 || column === 6;

                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => toggleDate(date)}
                        disabled={!canSubmit}
                        className={cn(
                          "relative h-[68px] border-r border-b border-[#E4EEF1] bg-white p-3 text-left text-sm font-semibold text-[#0F172A] transition hover:bg-[#EFFBFC] disabled:cursor-not-allowed disabled:text-muted-foreground/55 disabled:hover:bg-white sm:h-24 md:h-28",
                          weekend && "text-red-500",
                          selected &&
                            "bg-brand text-white ring-2 ring-inset ring-brand/70 hover:bg-[#007575]",
                        )}
                      >
                        {selected ? (
                          <span className="absolute top-2 right-2 flex size-5 items-center justify-center rounded-full bg-white/25 text-xs text-white">
                            ✓
                          </span>
                        ) : null}
                        <span>{date}</span>
                      </button>
                    );
                  })}

                  {Array.from({ length: data.cycle?.trailingEmptyCells ?? 0 }).map((_, index) => (
                    <div
                      key={`blank-end-${index}`}
                      className="h-[68px] border-r border-b border-[#E4EEF1] bg-white last:border-r-0 sm:h-24 md:h-28"
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        <aside className="rounded-[22px] border bg-white p-5 shadow-[0_14px_35px_rgba(15,23,42,0.07)] sm:rounded-3xl sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xl font-bold text-foreground">คำขอของฉัน</p>
              <p className="mt-1 text-sm text-muted-foreground">
                สำหรับเดือน {data.cycle?.monthLabel ?? "ยังไม่มีรอบจัดตาราง"}
              </p>
            </div>
            <span className="rounded-full bg-brand/12 px-3 py-1 text-xs font-semibold text-brand">
              {requests.length} รายการ
            </span>
          </div>

          {requests.length > 0 ? (
            <div className="mt-5 space-y-3">
              {requests.map((request) => (
                <RequestCard
                  key={request.date}
                  monthLabel={data.cycle?.monthLabel ?? ""}
                  request={request}
                  onChange={updateRequest}
                  onRemove={removeRequest}
                />
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed bg-[#F7FCFD] p-6 text-center">
              <HugeiconsIcon
                icon={Calendar03Icon}
                size={28}
                className="mx-auto text-muted-foreground"
              />
              <p className="mt-3 text-sm font-medium text-foreground">
                {canSubmit ? "ยังไม่ได้เลือกวันที่" : "ยังไม่พร้อมส่งคำขอ"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {canSubmit
                  ? "กดเลือกวันที่ในปฏิทินเพื่อเพิ่มคำขอ"
                  : data.message ?? "ยังไม่มีข้อมูลที่จำเป็นสำหรับส่งคำขอ"}
              </p>
            </div>
          )}

          <Button
            className="mt-5 h-11 w-full rounded-md shadow-[0_12px_24px_rgba(0,133,133,0.18)]"
            disabled={!canSubmit || requests.length === 0 || isPending}
            onClick={handleSubmit}
          >
            <HugeiconsIcon icon={CalendarCheckIcon} strokeWidth={2} />
            {isPending ? "กำลังส่งคำขอ..." : "ส่งคำขอ"}
            <HugeiconsIcon icon={SentIcon} strokeWidth={2} />
          </Button>
        </aside>
      </div>
    </main>
  );
}

type RequestCardProps = {
  monthLabel: string;
  request: LeaveRequestDraft;
  onChange: (
    date: number,
    updates: Partial<Omit<LeaveRequestDraft, "date">>,
  ) => void;
  onRemove: (date: number) => void;
};

function RequestCard({
  monthLabel,
  request,
  onChange,
  onRemove,
}: RequestCardProps) {
  return (
    <div className="rounded-2xl border bg-[#F5FCFD] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">
            วันที่ {request.date} {monthLabel}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            เลือกประเภทคำขอและใส่เหตุผลเพิ่มเติมได้
          </p>
        </div>

        <button
          type="button"
          onClick={() => onRemove(request.date)}
          className="rounded-md p-1.5 text-red-500 transition hover:bg-red-50"
          aria-label={`ลบคำขอวันที่ ${request.date}`}
        >
          <HugeiconsIcon icon={Delete02Icon} size={18} strokeWidth={1.8} />
        </button>
      </div>

      <div className="mt-3">
        <Select
          value={request.type}
          onValueChange={(value) =>
            onChange(request.date, { type: value as LeaveRequestType })
          }
        >
          <SelectTrigger className="h-9 w-full rounded-md border-brand bg-brand text-white hover:bg-[#006f6f] [&_svg]:text-white">
            <SelectValue placeholder="เลือกประเภทคำขอ" />
          </SelectTrigger>
          <SelectContent>
            {leaveRequestTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label} - {type.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <textarea
        value={request.reason}
        onChange={(event) =>
          onChange(request.date, { reason: event.target.value })
        }
        placeholder="กรอกเหตุผล (ไม่บังคับ)"
        className="mt-3 min-h-24 w-full resize-none rounded-md border bg-white px-3 py-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-brand focus:ring-3 focus:ring-brand/15"
      />
    </div>
  );
}
