export function formatMonthYear(month: number, year: number) {
  const buddhistYear = year > 2400 ? year : year + 543;
  return new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric",
  }).format(new Date(buddhistYear - 543, month - 1, 1));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatWardLabel(ward: { code: string; name: string }) {
  return ward.code === ward.name ? ward.code : `${ward.code} - ${ward.name}`;
}

export function formatShiftLabel(shiftCode: string) {
  return shiftCode || "0";
}
