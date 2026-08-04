import { formatCurrency } from "@/lib/my-schedule/formatters";

export function formatCompensationAmount(value: number) {
  return `${formatCurrency(value)} บาท`;
}
