"use client";

import {
  createContext,
  type ReactNode,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import {
  saveScheduleManagementAction,
  type ScheduleManagementActionState,
} from "@/app/actions/schedule-management";
import {
  buildLiveScheduleManagementData,
  type LiveScheduleManagementData,
} from "@/lib/schedule-management/live-form-data";
import type {
  StaffingRequirements,
  StaffRow,
} from "@/lib/schedule-management/types";

const initialState: ScheduleManagementActionState = {
  ok: null,
  message: "",
  submittedAt: 0,
};

type ScheduleManagementFormProps = {
  children: ReactNode;
  initialStaffRows: StaffRow[];
  initialStaffingRequirements: StaffingRequirements | null;
};

const ScheduleManagementLiveDataContext =
  createContext<LiveScheduleManagementData | null>(null);

export function ScheduleManagementForm({
  children,
  initialStaffRows,
  initialStaffingRequirements,
}: ScheduleManagementFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [liveData, setLiveData] = useState<LiveScheduleManagementData>({
    staffRows: initialStaffRows,
    staffingRequirements: initialStaffingRequirements,
  });
  const [state, formAction] = useActionState(
    saveScheduleManagementAction,
    initialState,
  );

  useEffect(() => {
    if (state.ok === null || !state.message) {
      return;
    }

    if (state.ok) {
      toast.success(state.message);
    } else {
      toast.error(state.message);
    }
  }, [state]);

  useEffect(() => {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const updateLiveData = () => {
      setLiveData(buildLiveScheduleManagementData(form, initialStaffRows));
    };
    const handleFormMutation = () => window.setTimeout(updateLiveData, 0);
    const observer = new MutationObserver(handleFormMutation);

    updateLiveData();
    form.addEventListener("input", updateLiveData);
    form.addEventListener("change", updateLiveData);
    form.addEventListener("click", handleFormMutation);
    observer.observe(form, { childList: true, subtree: true });

    return () => {
      form.removeEventListener("input", updateLiveData);
      form.removeEventListener("change", updateLiveData);
      form.removeEventListener("click", handleFormMutation);
      observer.disconnect();
    };
  }, [initialStaffRows]);

  return (
    <ScheduleManagementLiveDataContext.Provider value={liveData}>
      <form ref={formRef} action={formAction} className="space-y-6">
        {children}
      </form>
    </ScheduleManagementLiveDataContext.Provider>
  );
}

export function useScheduleManagementLiveData() {
  const value = useContext(ScheduleManagementLiveDataContext);

  if (!value) {
    throw new Error(
      "useScheduleManagementLiveData ต้องใช้งานภายใน ScheduleManagementForm",
    );
  }

  return value;
}
