import Link from "next/link";
import { CalendarRemove01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Button } from "@/components/ui/button";
import type { MyScheduleEmptyData } from "@/lib/my-schedule/types";

type EmptyScheduleStateProps = {
  data: MyScheduleEmptyData;
};

export function EmptyScheduleState({ data }: EmptyScheduleStateProps) {
  const showAdminLink = data.reason === "admin-no-ward";

  return (
    <section className="rounded-2xl border border-dashed bg-white px-6 py-12 text-center shadow-sm">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
        <HugeiconsIcon icon={CalendarRemove01Icon} size={24} strokeWidth={2} />
      </div>
      <h1 className="mt-4 text-2xl font-bold">{data.title}</h1>
      <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
        {data.description}
      </p>
      {showAdminLink ? (
        <Button asChild className="mt-6 rounded-md">
          <Link href="/home/manual-schedule">
            ไปหน้าแก้ไขตารางเวรหลัง GA
          </Link>
        </Button>
      ) : null}
    </section>
  );
}
