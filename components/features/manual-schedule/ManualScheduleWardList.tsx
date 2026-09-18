"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ManualScheduleData } from "@/lib/manual-schedule/types";

type ManualScheduleWardListProps = {
  data: ManualScheduleData;
};

const pageSize = 8;

export function ManualScheduleWardList({ data }: ManualScheduleWardListProps) {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);

  const filteredWards = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    if (!normalizedKeyword) {
      return data.wardOptions;
    }

    return data.wardOptions.filter((ward) => {
      const searchText = `${ward.code} ${ward.name}`.toLowerCase();
      return searchText.includes(normalizedKeyword);
    });
  }, [data.wardOptions, keyword]);
  const pageCount = Math.max(Math.ceil(filteredWards.length / pageSize), 1);
  const safePage = Math.min(page, pageCount);
  const paginatedWards = filteredWards.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  return (
    <section className="rounded-2xl border bg-white shadow-sm">
      <div className="border-b px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-brand">แก้ไขตารางเวร</p>
          <h2 className="mt-1 text-xl font-semibold">เลือกวอร์ดที่ต้องการแก้ไข</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            แอดมินสามารถเลือกวอร์ดจากรายการ แล้วเข้าไปแก้ตารางเวรในหน้าเฉพาะได้
          </p>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <Input
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
            setPage(1);
          }}
          placeholder="ค้นหาชื่อวอร์ดหรือรหัสวอร์ด"
          className="h-10 rounded-md bg-white"
        />

        <div className="overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
          <Table className="min-w-[1240px]">
            <TableHeader>
              <TableRow className="bg-[#F4FBFA] hover:bg-[#F4FBFA]">
                <TableHead className="min-w-28">วอร์ด</TableHead>
                <TableHead className="min-w-40">ชื่อวอร์ด</TableHead>
                <TableHead className="min-w-36">Hard Constraint</TableHead>
                <TableHead className="min-w-36">Soft Constraint</TableHead>
                <TableHead className="min-w-36">Objective</TableHead>
                <TableHead className="min-w-32">Fitness</TableHead>
                <TableHead className="min-w-44">วันที่จัดตาราง</TableHead>
                <TableHead className="min-w-44">วันที่แก้ไขล่าสุด</TableHead>
                <TableHead className="min-w-32 text-right">การดำเนินการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedWards.map((ward) => (
                <TableRow key={ward.id}>
                  <TableCell className="font-semibold text-brand">
                    {ward.code}
                  </TableCell>
                  <TableCell>{ward.name}</TableCell>
                  <TableCell>
                    <ScoreText value={ward.hardScore} />
                  </TableCell>
                  <TableCell>
                    <ScoreText value={ward.softScore} />
                  </TableCell>
                  <TableCell>
                    <ScoreText value={ward.objective} />
                  </TableCell>
                  <TableCell>
                    <ScoreText value={ward.fitness} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {ward.generatedAtLabel}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {ward.latestEditedAtLabel}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" className="rounded-md">
                      <Link
                        href={`/home/manual-schedule?manualWardId=${ward.id}`}
                      >
                        เข้าไปแก้ไข
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {paginatedWards.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    ไม่พบวอร์ดที่ตรงกับคำค้นหา
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            แสดง {paginatedWards.length} จาก {filteredWards.length} วอร์ด
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-md"
              disabled={safePage <= 1}
              onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
            >
              ก่อนหน้า
            </Button>
            <span className="min-w-20 text-center text-sm text-muted-foreground">
              {safePage} / {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-md"
              disabled={safePage >= pageCount}
              onClick={() =>
                setPage((currentPage) => Math.min(currentPage + 1, pageCount))
              }
            >
              ถัดไป
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScoreText({ value }: { value: string | null }) {
  return (
    <span className="font-mono text-sm font-medium text-slate-700">
      {value ?? "-"}
    </span>
  );
}
