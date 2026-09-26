import assert from "node:assert/strict";
import test from "node:test";

import { isCurrentCycleStatus } from "./current-cycle.ts";

test("a generating cycle remains the current schedule-management cycle", () => {
  assert.equal(isCurrentCycleStatus("generating"), true);
});

test("completed historical cycles are not selected as current", () => {
  assert.equal(isCurrentCycleStatus("published"), false);
  assert.equal(isCurrentCycleStatus("cancelled"), false);
});
