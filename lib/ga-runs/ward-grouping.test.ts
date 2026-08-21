import assert from "node:assert/strict";
import test from "node:test";

import { buildGaWardGroups } from "./ward-grouping.ts";

const wards = [
  { id: "a", code: "A" },
  { id: "b", code: "B" },
  { id: "c", code: "C" },
  { id: "d", code: "D" },
];

test("keeps unrelated wards in separate groups", () => {
  const groups = buildGaWardGroups({
    wards,
    staff: [
      { id: "N1", allowed_wards: ["A"] },
      { id: "N2", allowed_wards: ["B"] },
    ],
  });
  assert.deepEqual(groups.map((group) => group.wardCodes), [["A"], ["B"], ["C"], ["D"]]);
});

test("joins wards transitively through shared staff", () => {
  const groups = buildGaWardGroups({
    wards,
    staff: [
      { id: "N1", allowed_wards: ["A", "B"] },
      { id: "N2", allowed_wards: ["B", "C"] },
      { id: "N3", allowed_wards: ["D"] },
    ],
  });
  assert.deepEqual(groups.map((group) => group.wardCodes), [["A", "B", "C"], ["D"]]);
  assert.deepEqual(groups[0].sharedStaffCodes, ["N1", "N2"]);
});

test("ignores allowed wards outside the selected input", () => {
  const groups = buildGaWardGroups({
    wards: wards.slice(0, 2),
    staff: [{ id: "N1", allowed_wards: ["A", "C"] }],
  });
  assert.deepEqual(groups.map((group) => group.wardCodes), [["A"], ["B"]]);
});
