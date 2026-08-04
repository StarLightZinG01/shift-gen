"use client";

import { type ReactNode, useActionState, useEffect } from "react";
import { toast } from "sonner";

import {
  saveScheduleManagementAction,
  type ScheduleManagementActionState,
} from "@/app/actions/schedule-management";

const initialState: ScheduleManagementActionState = {
  ok: null,
  message: "",
  submittedAt: 0,
};

type ScheduleManagementFormProps = {
  children: ReactNode;
};

export function ScheduleManagementForm({
  children,
}: ScheduleManagementFormProps) {
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

  return (
    <form action={formAction} className="space-y-6">
      {children}
    </form>
  );
}
