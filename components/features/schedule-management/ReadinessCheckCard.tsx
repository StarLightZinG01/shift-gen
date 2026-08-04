"use client";

import { buildReadinessChecks } from "@/lib/schedule-management/readiness";
import { useEffect, useRef, useState } from "react";
import type {
  StaffingRequirements,
  StaffRow,
} from "@/lib/schedule-management/types";

type ReadinessCheckCardProps = {
  staffRows: StaffRow[];
  staffingRequirements: StaffingRequirements | null;
};

export function ReadinessCheckCard({
  staffRows,
  staffingRequirements,
}: ReadinessCheckCardProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [liveData, setLiveData] = useState({
    staffRows,
    staffingRequirements,
  });
  const checks = buildReadinessChecks(liveData);

  useEffect(() => {
    const form = containerRef.current?.closest("form");

    if (!form) {
      return;
    }

    const updateReadiness = () => {
      const formData = new FormData(form);
      setLiveData({
        staffRows: buildLiveStaffRows(formData, staffRows),
        staffingRequirements: buildLiveStaffingRequirements(formData),
      });
    };

    const handleFormChange = () => {
      updateReadiness();
    };

    const handleFormClick = () => {
      window.setTimeout(updateReadiness, 0);
    };

    const observer = new MutationObserver(updateReadiness);

    updateReadiness();
    form.addEventListener("input", handleFormChange);
    form.addEventListener("change", handleFormChange);
    form.addEventListener("click", handleFormClick);
    observer.observe(form, {
      childList: true,
      subtree: true,
    });

    return () => {
      form.removeEventListener("input", handleFormChange);
      form.removeEventListener("change", handleFormChange);
      form.removeEventListener("click", handleFormClick);
      observer.disconnect();
    };
  }, [staffRows]);

  return (
    <section
      ref={containerRef}
      className="h-full rounded-2xl border bg-white p-6 shadow-sm"
    >
      <h2 className="font-semibold">5. ตรวจสอบความพร้อมของข้อมูล</h2>

      <div className="mt-5 space-y-3">
        {checks.map((check) => (
          <div
            key={check.id}
            className="flex items-center gap-3 rounded-xl border border-[#E4EEF1] bg-[#F8FDFE] px-4 py-3"
          >
            <span
              className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                check.status === "passed"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {check.status === "passed" ? "✓" : "!"}
            </span>
            <span
              className={`text-sm font-medium ${
                check.status === "passed"
                  ? "text-[#0F172A]"
                  : "text-amber-900"
              }`}
            >
              {check.message}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function buildLiveStaffingRequirements(
  formData: FormData,
): StaffingRequirements | null {
  const night = buildLiveShiftRequirement(formData, "night");
  const morning = buildLiveShiftRequirement(formData, "morning");
  const afternoon = buildLiveShiftRequirement(formData, "afternoon");

  return {
    night,
    morning,
    afternoon,
  };
}

function buildLiveShiftRequirement(formData: FormData, prefix: string) {
  return {
    min: parseLiveNumber(formData.get(`${prefix}Min`)),
    max: parseLiveNumber(formData.get(`${prefix}Max`)),
  };
}

function parseLiveNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return Number.NaN;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return Number.NaN;
  }

  return Number(trimmedValue);
}

function buildLiveStaffRows(formData: FormData, initialRows: StaffRow[]) {
  const initialById = new Map(initialRows.map((row) => [row.id, row]));

  return formData.getAll("staffRowKey").map((rowKey) => {
    const id = String(rowKey);
    const initialRow = initialById.get(id);
    const staffId = getFormText(formData, `staff.${id}.staffId`) || initialRow?.staffId || null;

    return {
      id,
      staffId,
      rowType: (getFormText(formData, `staff.${id}.rowType`) ||
        initialRow?.rowType ||
        "home") as StaffRow["rowType"],
      code: getFormText(formData, `staff.${id}.code`) || initialRow?.code || "",
      fullName:
        getFormText(formData, `staff.${id}.fullName`) || initialRow?.fullName || "",
      homeWard:
        getFormText(formData, `staff.${id}.homeWard`) || initialRow?.homeWard || "",
      allowedWards: initialRow?.allowedWards ?? [],
      payPosition:
        getFormText(formData, `staff.${id}.payPosition`) ||
        initialRow?.payPosition ||
        "",
      otRate: getFormText(formData, `staff.${id}.otRate`) || initialRow?.otRate || "",
      shiftPayRate:
        getFormText(formData, `staff.${id}.shiftPayRate`) ||
        initialRow?.shiftPayRate ||
        "",
      off: getFormText(formData, `staff.${id}.off`) || initialRow?.off || "",
      vacation:
        getFormText(formData, `staff.${id}.vacation`) || initialRow?.vacation || "",
      leave: getFormText(formData, `staff.${id}.leave`) || initialRow?.leave || "",
      academic:
        getFormText(formData, `staff.${id}.academic`) || initialRow?.academic || "",
      preferredShifts:
        getFormText(formData, `staff.${id}.preferredShifts`) ||
        initialRow?.preferredShifts ||
        "",
      isHead: parseBooleanText(
        getFormText(formData, `staff.${id}.isHead`),
        initialRow?.isHead ?? false,
      ),
      isTrainee: parseBooleanText(
        getFormText(formData, `staff.${id}.isTrainee`),
        initialRow?.isTrainee ?? false,
      ),
    };
  });
}

function getFormText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function parseBooleanText(value: string, fallback: boolean) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
}
