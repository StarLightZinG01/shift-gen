export type WardGroupingInput = {
  wards: Array<{ id: string; code: string }>;
  staff: Array<{ id: string; allowed_wards: string[] }>;
};

export type GaWardGroup = {
  index: number;
  wardIds: string[];
  wardCodes: string[];
  sharedStaffCodes: string[];
};

export function buildGaWardGroups(input: WardGroupingInput): GaWardGroup[] {
  const wards = [...input.wards].sort((a, b) =>
    a.code.localeCompare(b.code, "th"),
  );
  const wardCodeSet = new Set(wards.map((ward) => ward.code));
  const wardByCode = new Map(wards.map((ward) => [ward.code, ward]));
  const parent = new Map(wards.map((ward) => [ward.code, ward.code]));

  function find(code: string): string {
    const currentParent = parent.get(code);
    if (!currentParent || currentParent === code) {
      return code;
    }
    const root = find(currentParent);
    parent.set(code, root);
    return root;
  }

  function union(left: string, right: string) {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) {
      parent.set(rightRoot, leftRoot);
    }
  }

  const eligibleWardsByStaff = new Map<string, string[]>();
  for (const staff of input.staff) {
    const eligibleWards = Array.from(
      new Set(staff.allowed_wards.filter((wardCode) => wardCodeSet.has(wardCode))),
    ).sort((a, b) => a.localeCompare(b, "th"));
    eligibleWardsByStaff.set(staff.id, eligibleWards);
    for (let index = 1; index < eligibleWards.length; index += 1) {
      union(eligibleWards[0], eligibleWards[index]);
    }
  }

  const wardCodesByRoot = new Map<string, string[]>();
  for (const ward of wards) {
    const root = find(ward.code);
    const groupWardCodes = wardCodesByRoot.get(root) ?? [];
    groupWardCodes.push(ward.code);
    wardCodesByRoot.set(root, groupWardCodes);
  }

  return Array.from(wardCodesByRoot.values())
    .map((wardCodes) => {
      const groupWardCodeSet = new Set(wardCodes);
      const sharedStaffCodes = Array.from(eligibleWardsByStaff.entries())
        .filter(([, eligibleWards]) =>
          eligibleWards.filter((wardCode) => groupWardCodeSet.has(wardCode)).length > 1,
        )
        .map(([staffCode]) => staffCode)
        .sort((a, b) => a.localeCompare(b, "th"));
      return {
        wardIds: wardCodes.map((code) => wardByCode.get(code)!.id),
        wardCodes,
        sharedStaffCodes,
      };
    })
    .sort((a, b) => a.wardCodes[0].localeCompare(b.wardCodes[0], "th"))
    .map((group, index) => ({ index: index + 1, ...group }));
}
