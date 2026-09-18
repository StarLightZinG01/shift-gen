import ExcelJS from "exceljs";

import type {
  MyScheduleLoadedData,
  MyScheduleStaffRow,
} from "@/lib/my-schedule/types";

const FONT_NAME = "TH Sarabun New";
const COLORS = {
  border: "FF000000",
  greenHeader: "FFC5E0B3",
  greenHoliday: "FFE2F0D9",
  greenTotal: "FFDDEBF7",
  orange: "FFF4B183",
  yellow: "FFFFFF66",
  white: "FFFFFFFF",
  gray: "FFF2F2F2",
  red: "FFFF0000",
};
const allShiftCodes = ["ช", "บ", "ด"] as const;
const dailyTotalShiftCodes = ["ด", "ช", "บ"] as const;
const noteShiftCodes = ["V", "ว", "ล"] as const;

type WorkShiftCode = (typeof allShiftCodes)[number];
type NoteShiftCode = (typeof noteShiftCodes)[number];

type StaffSummary = {
  regularWorkTarget: number;
  actualWorkTotal: number;
  overtimeTotal: number;
  otShiftCounts: Record<WorkShiftCode, number>;
  regularShiftCounts: Record<WorkShiftCode, number>;
  allShiftCounts: Record<WorkShiftCode, number>;
  regularWorkTotal: number;
  noteCounts: Record<NoteShiftCode, number>;
};

export async function buildScheduleExcel(
  data: MyScheduleLoadedData,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ShiftGen";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  buildScheduleSheet(workbook, data);
  buildStaffSheet(workbook, data);

  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

export function buildScheduleExcelFileName(data: MyScheduleLoadedData) {
  const safeWardCode = data.ward.code.replace(/[\\/:*?"<>|]/g, "-");
  return `ตารางเวร_${safeWardCode}_${data.cycle.year}-${String(data.cycle.month).padStart(2, "0")}.xlsx`;
}

function buildScheduleSheet(workbook: ExcelJS.Workbook, data: MyScheduleLoadedData) {
  const sheet = workbook.addWorksheet("ส่งฝ่าย", {
    views: [{ showGridLines: false, state: "frozen", xSplit: 2, ySplit: 4 }],
    pageSetup: {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.2,
        right: 0.2,
        top: 0.35,
        bottom: 0.35,
        header: 0.1,
        footer: 0.1,
      },
    },
  });

  const days = Array.from({ length: data.daysInMonth }, (_, index) => index + 1);
  const holidayDaySet = new Set(data.holidayDays);
  const dayMetas = days.map((day) =>
    buildDayMeta(day, data.cycle.month, data.cycle.year, holidayDaySet),
  );
  const regularWorkTarget = dayMetas.filter((day) => !day.isHoliday).length;
  const dayStartColumn = 3;
  const dayEndColumn = dayStartColumn + data.daysInMonth - 1;
  const summaryStartColumn = dayEndColumn + 1;
  const lastColumn = summaryStartColumn + 16;
  const lastColumnLetter = columnLetter(lastColumn);
  const staffStartRow = 5;
  const staffEndRow = staffStartRow + data.staffRows.length - 1;
  const reservedStaffRows = Math.max(data.staffRows.length + 2, 15);
  const dailyTotalsStartRow = staffStartRow + reservedStaffRows;
  const compensationHeaderRow = dailyTotalsStartRow + 5;

  sheet.getRow(1).height = 6;
  sheet.getRow(2).height = 24;
  sheet.getRow(3).height = 25;
  sheet.getRow(4).height = 25;
  sheet.mergeCells(1, 1, 1, lastColumn);
  sheet.mergeCells(2, 1, 2, lastColumn);
  const titleCell = sheet.getCell(2, 1);
  titleCell.value = `ปฏิบัติงานที่ ${data.ward.name} (${data.ward.code}) ประจำเดือน ${thaiMonthName(data.cycle.month)} พ.ศ. ${toBuddhistYear(data.cycle.year)}`;
  titleCell.font = baseFont({ bold: true, size: 16 });
  titleCell.alignment = centeredAlignment();

  configureColumns(sheet, data.daysInMonth, summaryStartColumn, lastColumn);
  buildMainHeaders({
    sheet,
    dayMetas,
    summaryStartColumn,
    lastColumn,
  });

  const summaries = new Map<string, StaffSummary>();
  data.staffRows.forEach((staff, index) => {
    const rowNumber = staffStartRow + index;
    const summary = summarizeStaff(staff, days, regularWorkTarget);
    summaries.set(staff.id, summary);
    buildStaffScheduleRow({
      sheet,
      staff,
      rowNumber,
      dayMetas,
      dayStartColumn,
      dayEndColumn,
      summaryStartColumn,
      summary,
      sequence: index + 1,
    });
  });

  for (
    let rowNumber = staffEndRow + 1;
    rowNumber < dailyTotalsStartRow;
    rowNumber += 1
  ) {
    sheet.getRow(rowNumber).height = 21;
    applyBorders(sheet.getRow(rowNumber), 1, lastColumn);
    applyHolidayFills(sheet, rowNumber, dayMetas, dayStartColumn);
  }

  buildDailyTotals({
    sheet,
    rows: data.staffRows,
    summaries: Array.from(summaries.values()),
    dayMetas,
    dayStartColumn,
    staffStartRow,
    staffEndRow,
    summaryStartColumn,
    lastColumn,
    startRow: dailyTotalsStartRow,
  });
  buildLegend(sheet, dailyTotalsStartRow + 5, dayStartColumn);
  buildCompensationTable({
    sheet,
    data,
    startRow: compensationHeaderRow,
    startColumn: summaryStartColumn,
    lastColumn,
  });

  sheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: staffEndRow, column: lastColumn },
  };
  sheet.pageSetup.printArea = `A2:${lastColumnLetter}${Math.max(compensationHeaderRow + data.compensationSummary.detailRows.length + 2, dailyTotalsStartRow + 10)}`;
  sheet.headerFooter.oddFooter = "&LShiftGen&Cหน้า &P จาก &N&R&D &T";
}

function configureColumns(
  sheet: ExcelJS.Worksheet,
  daysInMonth: number,
  summaryStartColumn: number,
  lastColumn: number,
) {
  sheet.getColumn(1).width = 5;
  sheet.getColumn(2).width = 24;
  for (let column = 3; column < 3 + daysInMonth; column += 1) {
    sheet.getColumn(column).width = 4.2;
  }
  for (let column = summaryStartColumn; column <= lastColumn; column += 1) {
    sheet.getColumn(column).width = 5.2;
  }
  sheet.getColumn(summaryStartColumn).width = 7;
  sheet.getColumn(summaryStartColumn + 1).width = 7;
  sheet.getColumn(summaryStartColumn + 2).width = 6;
  sheet.getColumn(lastColumn - 2).width = 5;
}

function buildMainHeaders({
  sheet,
  dayMetas,
  summaryStartColumn,
  lastColumn,
}: {
  sheet: ExcelJS.Worksheet;
  dayMetas: ReturnType<typeof buildDayMeta>[];
  summaryStartColumn: number;
  lastColumn: number;
}) {
  sheet.mergeCells(3, 1, 4, 1);
  sheet.mergeCells(3, 2, 4, 2);
  setHeaderCell(sheet.getCell(3, 1), "ที่", COLORS.greenHeader);
  setHeaderCell(sheet.getCell(3, 2), "ชื่อ - นามสกุล", COLORS.greenHeader);

  dayMetas.forEach((meta, index) => {
    const column = 3 + index;
    const fill = meta.isHoliday ? COLORS.greenHoliday : COLORS.white;
    setHeaderCell(sheet.getCell(3, column), meta.day, fill);
    setHeaderCell(sheet.getCell(4, column), meta.weekday, fill, meta.isHoliday ? COLORS.red : undefined);
  });

  mergeHeader(sheet, 3, summaryStartColumn, summaryStartColumn + 1, "วันทำการ", COLORS.greenHeader);
  setHeaderCell(sheet.getCell(4, summaryStartColumn), "ราชการ", COLORS.greenHeader);
  setHeaderCell(sheet.getCell(4, summaryStartColumn + 1), "จริง", COLORS.greenHeader);

  sheet.mergeCells(3, summaryStartColumn + 2, 4, summaryStartColumn + 2);
  setHeaderCell(sheet.getCell(3, summaryStartColumn + 2), "OT\nรวม", COLORS.orange);

  mergeHeader(sheet, 3, summaryStartColumn + 3, summaryStartColumn + 6, "จำนวน OT", COLORS.greenHeader);
  ["ชOT", "บOT", "ดOT", "OTรวม"].forEach((label, index) =>
    setHeaderCell(sheet.getCell(4, summaryStartColumn + 3 + index), label, COLORS.greenHeader),
  );

  mergeHeader(sheet, 3, summaryStartColumn + 7, summaryStartColumn + 10, "จำนวนวันทำการ", COLORS.greenHeader);
  ["ช", "บ", "ด", "รวมทำการ"].forEach((label, index) =>
    setHeaderCell(sheet.getCell(4, summaryStartColumn + 7 + index), label, COLORS.greenHeader),
  );

  mergeHeader(sheet, 3, summaryStartColumn + 11, summaryStartColumn + 13, "จำนวนเวรทั้งหมด", COLORS.greenHeader);
  ["ช", "บ", "ด"].forEach((label, index) =>
    setHeaderCell(sheet.getCell(4, summaryStartColumn + 11 + index), label, COLORS.greenHeader),
  );

  mergeHeader(sheet, 3, summaryStartColumn + 14, lastColumn, "หมายเหตุ", COLORS.greenHeader);
  noteShiftCodes.forEach((label, index) =>
    setHeaderCell(sheet.getCell(4, summaryStartColumn + 14 + index), label, COLORS.greenHeader),
  );
}

function buildStaffScheduleRow({
  sheet,
  staff,
  rowNumber,
  dayMetas,
  dayStartColumn,
  dayEndColumn,
  summaryStartColumn,
  summary,
  sequence,
}: {
  sheet: ExcelJS.Worksheet;
  staff: MyScheduleStaffRow;
  rowNumber: number;
  dayMetas: ReturnType<typeof buildDayMeta>[];
  dayStartColumn: number;
  dayEndColumn: number;
  summaryStartColumn: number;
  summary: StaffSummary;
  sequence: number;
}) {
  const row = sheet.getRow(rowNumber);
  row.height = 22;
  row.getCell(1).value = sequence;
  row.getCell(2).value = staff.fullName || staff.staffCode;
  row.getCell(2).note = `รหัสบุคลากร: ${staff.staffCode}${staff.isHead ? "\nหัวหน้าวอร์ด" : ""}`;
  row.getCell(2).alignment = { horizontal: "left", vertical: "middle" };

  dayMetas.forEach((meta, index) => {
    const cell = row.getCell(dayStartColumn + index);
    cell.value = formatShiftWithOt(
      staff.shiftsByDay[meta.day] ?? "0",
      staff.otByDay[meta.day] === true,
      staff.otShiftsByDay[meta.day],
    );
    cell.alignment = centeredAlignment();
    if (meta.isHoliday) {
      cell.fill = solidFill(COLORS.greenHoliday);
    }
    if (cell.value === "0") {
      cell.font = baseFont({ color: "FF808080" });
    }
  });

  const dayRange = `${columnLetter(dayStartColumn)}${rowNumber}:${columnLetter(dayEndColumn)}${rowNumber}`;
  setFormula(row.getCell(summaryStartColumn), regularWorkTargetFormula(summary.regularWorkTarget), summary.regularWorkTarget);
  setFormula(
    row.getCell(summaryStartColumn + 1),
    `COUNTIF(${dayRange},"*ช*")+COUNTIF(${dayRange},"*บ*")+COUNTIF(${dayRange},"*ด*")+COUNTIF(${dayRange},"V")+COUNTIF(${dayRange},"ว")`,
    summary.actualWorkTotal,
  );
  setFormula(
    row.getCell(summaryStartColumn + 2),
    `SUM(${columnLetter(summaryStartColumn + 3)}${rowNumber}:${columnLetter(summaryStartColumn + 5)}${rowNumber})`,
    summary.overtimeTotal,
  );

  allShiftCodes.forEach((code, index) => {
    setFormula(
      row.getCell(summaryStartColumn + 3 + index),
      `COUNTIF(${dayRange},"*${code}OT*")`,
      summary.otShiftCounts[code],
    );
  });
  setFormula(
    row.getCell(summaryStartColumn + 6),
    `SUM(${columnLetter(summaryStartColumn + 3)}${rowNumber}:${columnLetter(summaryStartColumn + 5)}${rowNumber})`,
    summary.overtimeTotal,
  );

  allShiftCodes.forEach((code, index) => {
    setFormula(
      row.getCell(summaryStartColumn + 7 + index),
      `${columnLetter(summaryStartColumn + 11 + index)}${rowNumber}-${columnLetter(summaryStartColumn + 3 + index)}${rowNumber}`,
      summary.regularShiftCounts[code],
    );
  });
  setFormula(
    row.getCell(summaryStartColumn + 10),
    `SUM(${columnLetter(summaryStartColumn + 7)}${rowNumber}:${columnLetter(summaryStartColumn + 9)}${rowNumber})+${columnLetter(summaryStartColumn + 14)}${rowNumber}+${columnLetter(summaryStartColumn + 15)}${rowNumber}`,
    summary.regularWorkTotal,
  );

  allShiftCodes.forEach((code, index) => {
    setFormula(
      row.getCell(summaryStartColumn + 11 + index),
      `COUNTIF(${dayRange},"*${code}*")`,
      summary.allShiftCounts[code],
    );
  });
  noteShiftCodes.forEach((code, index) => {
    setFormula(
      row.getCell(summaryStartColumn + 14 + index),
      `COUNTIF(${dayRange},"${code}")`,
      summary.noteCounts[code],
    );
  });

  row.eachCell({ includeEmpty: true }, (cell, column) => {
    if (column > summaryStartColumn + 16) {
      return;
    }
    cell.font ??= baseFont();
    cell.alignment ??= centeredAlignment();
    cell.border = thinBorder();
  });
  row.getCell(summaryStartColumn + 2).fill = solidFill("FFFFF2CC");
  for (let column = summaryStartColumn; column <= summaryStartColumn + 1; column += 1) {
    row.getCell(column).fill = solidFill("FFEAF7F7");
  }
}

function buildDailyTotals({
  sheet,
  rows,
  summaries,
  dayMetas,
  dayStartColumn,
  staffStartRow,
  staffEndRow,
  summaryStartColumn,
  lastColumn,
  startRow,
}: {
  sheet: ExcelJS.Worksheet;
  rows: MyScheduleStaffRow[];
  summaries: StaffSummary[];
  dayMetas: ReturnType<typeof buildDayMeta>[];
  dayStartColumn: number;
  staffStartRow: number;
  staffEndRow: number;
  summaryStartColumn: number;
  lastColumn: number;
  startRow: number;
}) {
  const totalSummary = sumStaffSummaries(summaries);

  dailyTotalShiftCodes.forEach((code, rowIndex) => {
    const rowNumber = startRow + rowIndex;
    const row = sheet.getRow(rowNumber);
    row.height = 20;
    row.getCell(2).value = code;
    row.getCell(2).font = baseFont({ bold: true });
    row.getCell(2).alignment = centeredAlignment();

    dayMetas.forEach((meta, dayIndex) => {
      const result = rows.reduce(
        (total, staff) => total + splitShiftCode(staff.shiftsByDay[meta.day] ?? "0").filter((part) => part === code).length,
        0,
      );
      const column = dayStartColumn + dayIndex;
      const columnName = columnLetter(column);
      setFormula(
        row.getCell(column),
        `COUNTIF(${columnName}${staffStartRow}:${columnName}${staffEndRow},"*${code}*")`,
        result,
      );
      if (meta.isHoliday) {
        row.getCell(column).fill = solidFill(COLORS.greenHoliday);
      }
    });

    if (rowIndex === 0) {
      const summaryValues = [
        totalSummary.regularWorkTarget,
        totalSummary.actualWorkTotal,
        totalSummary.overtimeTotal,
        ...allShiftCodes.map((shift) => totalSummary.otShiftCounts[shift]),
        totalSummary.overtimeTotal,
        ...allShiftCodes.map((shift) => totalSummary.regularShiftCounts[shift]),
        totalSummary.regularWorkTotal,
        ...allShiftCodes.map((shift) => totalSummary.allShiftCounts[shift]),
        ...noteShiftCodes.map((shift) => totalSummary.noteCounts[shift]),
      ];
      summaryValues.forEach((value, index) => {
        row.getCell(summaryStartColumn + index).value = value;
        row.getCell(summaryStartColumn + index).fill = solidFill(COLORS.greenTotal);
      });
    }

    applyBorders(row, 1, lastColumn);
    for (let column = 1; column <= lastColumn; column += 1) {
      row.getCell(column).alignment = centeredAlignment();
      row.getCell(column).font ??= baseFont();
    }
  });
}

function buildLegend(sheet: ExcelJS.Worksheet, startRow: number, startColumn: number) {
  const entries = [
    ["ช = เวรเช้า", "ชOT = OT เช้า"],
    ["บ = เวรบ่าย", "บOT = OT บ่าย"],
    ["ด = เวรดึก", "ดOT = OT ดึก"],
    ["V = Vacation", "0 = วันหยุด"],
    ["ว = ประชุมวิชาการ", "ล = ลาประเภทอื่น"],
  ];
  sheet.getCell(startRow, startColumn - 1).value = "หมายเหตุ";
  sheet.getCell(startRow, startColumn - 1).font = baseFont({ bold: true });

  entries.forEach(([left, right], index) => {
    const row = startRow + 1 + index;
    sheet.getCell(row, startColumn - 1).value = left;
    sheet.getCell(row, startColumn + 4).value = right;
    sheet.getCell(row, startColumn - 1).font = baseFont();
    sheet.getCell(row, startColumn + 4).font = baseFont();
  });
}

function buildCompensationTable({
  sheet,
  data,
  startRow,
  startColumn,
  lastColumn,
}: {
  sheet: ExcelJS.Worksheet;
  data: MyScheduleLoadedData;
  startRow: number;
  startColumn: number;
  lastColumn: number;
}) {
  sheet.mergeCells(startRow, startColumn, startRow, lastColumn);
  const header = sheet.getCell(startRow, startColumn);
  header.value = "ค่า OT / เวร";
  header.fill = solidFill(COLORS.yellow);
  header.font = baseFont({ bold: true });
  header.alignment = centeredAlignment();
  applyMergedRangeBorder(sheet, startRow, startColumn, startRow, lastColumn);

  const details = data.compensationSummary.detailRows;
  const totals = data.compensationSummary.totalRows;
  const rowCount = Math.max(details.length, totals.length, 1);

  for (let index = 0; index < rowCount; index += 1) {
    const row = startRow + 1 + index;
    const detail = details[index];
    const total = totals[index];
    mergeAndSet(sheet, row, startColumn, startColumn + 1, detail?.label ?? "");
    mergeAndSet(sheet, row, startColumn + 2, startColumn + 3, detail?.rate ?? "");
    mergeAndSet(sheet, row, startColumn + 4, startColumn + 5, detail?.quantity ?? "");
    mergeAndSetFormula(
      sheet,
      row,
      startColumn + 6,
      startColumn + 8,
      detail
        ? `${columnLetter(startColumn + 2)}${row}*${columnLetter(startColumn + 4)}${row}`
        : null,
      detail?.amount ?? "",
    );
    mergeAndSet(sheet, row, startColumn + 9, startColumn + 12, total?.label ?? "");
    mergeAndSet(sheet, row, startColumn + 13, lastColumn, total?.amount ?? "");

    for (let column = startColumn; column <= lastColumn; column += 1) {
      const cell = sheet.getCell(row, column);
      cell.font = baseFont({ bold: total?.id === "total-all" });
      cell.alignment = centeredAlignment();
      cell.numFmt = typeof cell.value === "number" ? "#,##0.00" : cell.numFmt;
      cell.border = thinBorder();
      if (total?.id === "total-all" && column >= startColumn + 9) {
        cell.fill = solidFill(COLORS.greenHeader);
      }
    }
  }
}

function buildStaffSheet(workbook: ExcelJS.Workbook, data: MyScheduleLoadedData) {
  const sheet = workbook.addWorksheet("รายชื่อแนบ", {
    views: [{ showGridLines: false, state: "frozen", ySplit: 4 }],
    pageSetup: {
      orientation: "portrait",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  const lastColumn = 8;
  sheet.mergeCells(1, 1, 1, lastColumn);
  sheet.getCell(1, 1).value = `รายชื่อเจ้าหน้าที่ปฏิบัติงาน ${data.ward.name} (${data.ward.code})`;
  sheet.getCell(1, 1).font = baseFont({ bold: true, size: 16 });
  sheet.getCell(1, 1).alignment = centeredAlignment();
  sheet.mergeCells(2, 1, 2, lastColumn);
  sheet.getCell(2, 1).value = `ประจำเดือน ${thaiMonthName(data.cycle.month)} พ.ศ. ${toBuddhistYear(data.cycle.year)}`;
  sheet.getCell(2, 1).font = baseFont();
  sheet.getCell(2, 1).alignment = centeredAlignment();

  const headers = [
    "ลำดับ",
    "รหัสบุคลากร",
    "ชื่อ - นามสกุล",
    "ตำแหน่ง",
    "บทบาท",
    "ค่า OT",
    "ค่าเวร (บ/ด)",
    "วอร์ดหลัก",
  ];
  headers.forEach((label, index) => setHeaderCell(sheet.getCell(4, index + 1), label, COLORS.greenHeader));
  [7, 14, 26, 14, 12, 11, 13, 14].forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });

  data.staffRows.forEach((staff, index) => {
    const row = sheet.getRow(index + 5);
    row.values = [
      index + 1,
      staff.staffCode,
      staff.fullName,
      staff.payPosition || "-",
      staff.isHead ? "หัวหน้าวอร์ด" : "บุคลากร",
      staff.otRate,
      staff.shiftPayRate,
      data.ward.code,
    ];
    row.height = 23;
    for (let column = 1; column <= lastColumn; column += 1) {
      const cell = row.getCell(column);
      cell.font = baseFont();
      cell.alignment = column === 3 ? { horizontal: "left", vertical: "middle" } : centeredAlignment();
      cell.border = thinBorder();
      if (column === 6 || column === 7) {
        cell.numFmt = "#,##0.00";
      }
    }
  });

  sheet.autoFilter = `A4:H${data.staffRows.length + 4}`;
  sheet.pageSetup.printArea = `A1:H${data.staffRows.length + 4}`;
}

function summarizeStaff(
  staff: MyScheduleStaffRow,
  days: number[],
  regularWorkTarget: number,
): StaffSummary {
  const summary: StaffSummary = {
    regularWorkTarget,
    actualWorkTotal: 0,
    overtimeTotal: 0,
    otShiftCounts: { "ช": 0, "บ": 0, "ด": 0 },
    regularShiftCounts: { "ช": 0, "บ": 0, "ด": 0 },
    allShiftCounts: { "ช": 0, "บ": 0, "ด": 0 },
    regularWorkTotal: 0,
    noteCounts: { V: 0, "ว": 0, "ล": 0 },
  };

  for (const day of days) {
    const shiftParts = splitShiftCode(staff.shiftsByDay[day] ?? "0");
    const otParts = resolveOtParts(
      staff.otByDay[day] === true,
      staff.otShiftsByDay[day],
      shiftParts,
    );
    const otSet = new Set(otParts);

    for (const part of shiftParts) {
      if (isWorkShift(part)) {
        summary.actualWorkTotal += 1;
        summary.allShiftCounts[part] += 1;
        if (otSet.has(part)) {
          summary.otShiftCounts[part] += 1;
          summary.overtimeTotal += 1;
        } else {
          summary.regularShiftCounts[part] += 1;
        }
      } else if (isNoteShift(part)) {
        summary.noteCounts[part] += 1;
        if (part === "V" || part === "ว") {
          summary.actualWorkTotal += 1;
        }
      }
    }
  }

  summary.regularWorkTotal =
    Object.values(summary.regularShiftCounts).reduce((sum, value) => sum + value, 0) +
    summary.noteCounts.V +
    summary.noteCounts["ว"];
  return summary;
}

function sumStaffSummaries(summaries: StaffSummary[]): StaffSummary {
  const total: StaffSummary = {
    regularWorkTarget: 0,
    actualWorkTotal: 0,
    overtimeTotal: 0,
    otShiftCounts: { "ช": 0, "บ": 0, "ด": 0 },
    regularShiftCounts: { "ช": 0, "บ": 0, "ด": 0 },
    allShiftCounts: { "ช": 0, "บ": 0, "ด": 0 },
    regularWorkTotal: 0,
    noteCounts: { V: 0, "ว": 0, "ล": 0 },
  };
  for (const summary of summaries) {
    total.regularWorkTarget += summary.regularWorkTarget;
    total.actualWorkTotal += summary.actualWorkTotal;
    total.overtimeTotal += summary.overtimeTotal;
    total.regularWorkTotal += summary.regularWorkTotal;
    allShiftCodes.forEach((code) => {
      total.otShiftCounts[code] += summary.otShiftCounts[code];
      total.regularShiftCounts[code] += summary.regularShiftCounts[code];
      total.allShiftCounts[code] += summary.allShiftCounts[code];
    });
    noteShiftCodes.forEach((code) => {
      total.noteCounts[code] += summary.noteCounts[code];
    });
  }
  return total;
}

function formatShiftWithOt(shiftCode: string, isOt: boolean, otShifts: string | null) {
  const normalized = shiftCode.trim().replace(/OT/gi, "") || "0";
  if (normalized === "0" || !isOt) {
    return normalized;
  }
  const parts = splitShiftCode(normalized).filter(isWorkShift);
  const otSet = new Set(resolveOtParts(isOt, otShifts, parts));
  return parts.map((part) => `${part}${otSet.has(part) ? "OT" : ""}`).join("/");
}

function resolveOtParts(isOt: boolean, otShifts: string | null, shiftParts: string[]) {
  if (otShifts) {
    return splitShiftCode(otShifts.replace(/OT/gi, "")).filter(isWorkShift);
  }
  return isOt ? shiftParts.filter(isWorkShift) : [];
}

function splitShiftCode(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(/OT/gi, "");
  if (!normalized || normalized === "0") {
    return [];
  }
  if (normalized.includes("/")) {
    return normalized.split("/").filter(Boolean);
  }
  if (normalized === "ชบ") {
    return ["ช", "บ"];
  }
  if (normalized === "ดบ") {
    return ["ด", "บ"];
  }
  return [normalized];
}

function isWorkShift(value: string): value is WorkShiftCode {
  return allShiftCodes.includes(value as WorkShiftCode);
}

function isNoteShift(value: string): value is NoteShiftCode {
  return noteShiftCodes.includes(value as NoteShiftCode);
}

function buildDayMeta(day: number, month: number, year: number, holidayDays: Set<number>) {
  const date = new Date(normalizeYear(year), month - 1, day);
  const weekdayIndex = date.getDay();
  return {
    day,
    weekday: ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."][weekdayIndex],
    isHoliday: weekdayIndex === 0 || weekdayIndex === 6 || holidayDays.has(day),
  };
}

function mergeHeader(
  sheet: ExcelJS.Worksheet,
  row: number,
  startColumn: number,
  endColumn: number,
  label: string,
  fill: string,
) {
  sheet.mergeCells(row, startColumn, row, endColumn);
  setHeaderCell(sheet.getCell(row, startColumn), label, fill);
  applyMergedRangeBorder(sheet, row, startColumn, row, endColumn);
}

function setHeaderCell(cell: ExcelJS.Cell, value: string | number, fill: string, color?: string) {
  cell.value = value;
  cell.font = baseFont({ bold: true, color });
  cell.fill = solidFill(fill);
  cell.alignment = centeredAlignment();
  cell.border = thinBorder();
}

function mergeAndSet(
  sheet: ExcelJS.Worksheet,
  row: number,
  startColumn: number,
  endColumn: number,
  value: string | number,
) {
  sheet.mergeCells(row, startColumn, row, endColumn);
  sheet.getCell(row, startColumn).value = value;
  applyMergedRangeBorder(sheet, row, startColumn, row, endColumn);
}

function mergeAndSetFormula(
  sheet: ExcelJS.Worksheet,
  row: number,
  startColumn: number,
  endColumn: number,
  formula: string | null,
  result: string | number,
) {
  sheet.mergeCells(row, startColumn, row, endColumn);
  sheet.getCell(row, startColumn).value = formula ? { formula, result } : result;
  sheet.getCell(row, startColumn).numFmt = "#,##0.00";
  applyMergedRangeBorder(sheet, row, startColumn, row, endColumn);
}

function applyMergedRangeBorder(
  sheet: ExcelJS.Worksheet,
  startRow: number,
  startColumn: number,
  endRow: number,
  endColumn: number,
) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let column = startColumn; column <= endColumn; column += 1) {
      sheet.getCell(row, column).border = thinBorder();
    }
  }
}

function applyBorders(row: ExcelJS.Row, startColumn: number, endColumn: number) {
  for (let column = startColumn; column <= endColumn; column += 1) {
    row.getCell(column).border = thinBorder();
  }
}

function applyHolidayFills(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  dayMetas: ReturnType<typeof buildDayMeta>[],
  dayStartColumn: number,
) {
  dayMetas.forEach((meta, index) => {
    if (meta.isHoliday) {
      sheet.getCell(rowNumber, dayStartColumn + index).fill = solidFill(COLORS.greenHoliday);
    }
  });
}

function setFormula(cell: ExcelJS.Cell, formula: string, result: number) {
  cell.value = { formula, result };
  cell.alignment = centeredAlignment();
}

function regularWorkTargetFormula(value: number) {
  return `${value}`;
}

function baseFont({
  bold = false,
  size = 14,
  color = "FF000000",
}: {
  bold?: boolean;
  size?: number;
  color?: string;
} = {}): Partial<ExcelJS.Font> {
  return { name: FONT_NAME, family: 2, size, bold, color: { argb: color } };
}

function centeredAlignment(): Partial<ExcelJS.Alignment> {
  return { horizontal: "center", vertical: "middle", wrapText: true };
}

function solidFill(color: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: color } };
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const line = { style: "thin" as const, color: { argb: COLORS.border } };
  return { top: line, left: line, bottom: line, right: line };
}

function columnLetter(columnNumber: number) {
  let value = columnNumber;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function thaiMonthName(month: number) {
  return [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ][month - 1] ?? String(month);
}

function toBuddhistYear(year: number) {
  return year > 2400 ? year : year + 543;
}

function normalizeYear(year: number) {
  return year > 2400 ? year - 543 : year;
}
