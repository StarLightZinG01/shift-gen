export function getNextManualVersionNumber(
  currentMax: number | null | undefined,
) {
  return (currentMax ?? 0) + 1;
}
