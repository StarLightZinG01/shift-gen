"use client";

import { useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MyScheduleVersionOption } from "@/lib/my-schedule/types";

type VersionSelectorProps = {
  options: MyScheduleVersionOption[];
  value: string;
};

export function VersionSelector({ options, value }: VersionSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  return (
    <Select
      value={value}
      onValueChange={(nextValue) => {
        const params = new URLSearchParams(searchParams);
        params.set("versionId", nextValue);
        router.push(`/home/my-schedule?${params.toString()}`);
      }}
    >
      <SelectTrigger className="h-10 w-full rounded-md bg-white sm:w-[260px]">
        <SelectValue placeholder="เลือกรอบตารางเวร" />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
