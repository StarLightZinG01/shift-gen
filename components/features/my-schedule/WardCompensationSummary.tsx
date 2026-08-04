import type {
  MyScheduleCompensationDetailRow,
  MyScheduleWardCompensationSummary,
} from "@/lib/my-schedule/types";

type WardCompensationSummaryProps = {
  summary: MyScheduleWardCompensationSummary;
};

export function WardCompensationSummary({
  summary,
}: WardCompensationSummaryProps) {
  const otRows = summary.detailRows.filter((row) => row.category === "ot");
  const shiftPayRows = summary.detailRows.filter(
    (row) => row.category === "shift_pay",
  );
  const extraRows = summary.detailRows.filter((row) => row.category === "extra");
  const maxRowCount = Math.max(otRows.length, shiftPayRows.length, 1);

  return (
    <section className="border-t bg-[#F8FDFE] p-5">
      <div className="overflow-hidden rounded-xl border border-[#B8DCDC] bg-white shadow-sm">
        <div className="border-b border-[#B8DCDC] bg-[#FFF86A] px-4 py-2 text-center text-sm font-semibold text-slate-950">
          ค่า OT / เวร
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-[#E4F7F5] text-brand">
                  <th className="border border-[#DDEBED] px-3 py-2 text-left">
                    รายการ OT
                  </th>
                  <th className="border border-[#DDEBED] px-3 py-2 text-right">
                    อัตรา
                  </th>
                  <th className="border border-[#DDEBED] px-3 py-2 text-right">
                    จำนวน
                  </th>
                  <th className="border border-[#DDEBED] px-3 py-2 text-right">
                    รวม
                  </th>
                  <th className="border border-[#DDEBED] px-3 py-2 text-left">
                    รายการค่าเวร
                  </th>
                  <th className="border border-[#DDEBED] px-3 py-2 text-right">
                    อัตรา
                  </th>
                  <th className="border border-[#DDEBED] px-3 py-2 text-right">
                    จำนวน
                  </th>
                  <th className="border border-[#DDEBED] px-3 py-2 text-right">
                    รวม
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxRowCount }, (_, index) => (
                  <CompensationPairRow
                    key={`compensation-pair-${index}`}
                    left={otRows[index]}
                    right={shiftPayRows[index]}
                  />
                ))}

                {extraRows.map((row) => (
                  <tr key={row.id} className="bg-white">
                    <td className="border border-[#DDEBED] px-3 py-2 font-medium text-slate-900">
                      {row.label}
                    </td>
                    <td className="border border-[#DDEBED] px-3 py-2 text-right">
                      {formatNumber(row.rate)}
                    </td>
                    <td className="border border-[#DDEBED] px-3 py-2 text-right">
                      {formatNumber(row.quantity)}
                    </td>
                    <td className="border border-[#DDEBED] px-3 py-2 text-right font-semibold text-brand">
                      {formatMoney(row.amount)}
                    </td>
                    <td
                      colSpan={4}
                      className="border border-[#DDEBED] bg-[#F8FDFE]"
                    />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-[#B8DCDC] lg:border-l lg:border-t-0">
            <div className="grid h-full grid-rows-3">
              <SummaryAmount
                label="OT รวม"
                amount={summary.totalOtAmount}
              />
              <SummaryAmount
                label="ค่าเวรรวม"
                amount={summary.totalShiftPayAmount}
              />
              <SummaryAmount
                label="รวมทั้งหมด"
                amount={summary.totalAmount}
                emphasized
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CompensationPairRow({
  left,
  right,
}: {
  left?: MyScheduleCompensationDetailRow;
  right?: MyScheduleCompensationDetailRow;
}) {
  return (
    <tr className="bg-white">
      <CompensationCells row={left} />
      <CompensationCells row={right} />
    </tr>
  );
}

function CompensationCells({
  row,
}: {
  row?: MyScheduleCompensationDetailRow;
}) {
  return (
    <>
      <td className="border border-[#DDEBED] px-3 py-2 font-medium text-slate-900">
        {row?.label ?? ""}
      </td>
      <td className="border border-[#DDEBED] px-3 py-2 text-right text-slate-900">
        {row ? formatNumber(row.rate) : ""}
      </td>
      <td className="border border-[#DDEBED] px-3 py-2 text-right text-slate-900">
        {row ? formatNumber(row.quantity) : ""}
      </td>
      <td className="border border-[#DDEBED] px-3 py-2 text-right font-semibold text-brand">
        {row ? formatMoney(row.amount) : ""}
      </td>
    </>
  );
}

function SummaryAmount({
  label,
  amount,
  emphasized = false,
}: {
  label: string;
  amount: number;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-[1fr_auto] items-center gap-4 border-b border-[#DDEBED] px-4 py-3 last:border-b-0 ${
        emphasized ? "bg-brand/10" : "bg-white"
      }`}
    >
      <span className="font-semibold text-slate-900">{label}</span>
      <span
        className={`font-semibold ${
          emphasized ? "text-lg text-brand" : "text-slate-950"
        }`}
      >
        {formatMoney(amount)}
      </span>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("th-TH", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
