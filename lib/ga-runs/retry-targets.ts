export function getRetryWardIds(inputSnapshot: unknown) {
  if (
    inputSnapshot === null ||
    typeof inputSnapshot !== "object" ||
    Array.isArray(inputSnapshot)
  ) {
    return [];
  }

  const wards = (inputSnapshot as Record<string, unknown>).wards;
  if (!Array.isArray(wards)) return [];

  return Array.from(
    new Set(
      wards.flatMap((ward) => {
        if (ward === null || typeof ward !== "object" || Array.isArray(ward)) {
          return [];
        }
        const id = (ward as Record<string, unknown>).id;
        return typeof id === "string" && id.length > 0 ? [id] : [];
      }),
    ),
  );
}
