import assert from "node:assert/strict";
import test from "node:test";

import {
  collectInactiveStaffIds,
  formatInactiveStaffRequestWarning,
  isGaEligibleStaffAccount,
} from "./staff-eligibility.ts";

test("excludes inactive linked accounts but keeps active and accountless staff", () => {
  assert.equal(isGaEligibleStaffAccount({ user: { status: "inactive" } }), false);
  assert.equal(isGaEligibleStaffAccount({ user: { status: "active" } }), true);
  assert.equal(isGaEligibleStaffAccount({ user: null }), true);
});

test("formats the readiness warning for inactive staff requests", () => {
  assert.match(
    formatInactiveStaffRequestWarning({ code: "RN001", name: "Test", count: 2 }),
    /RN001 Test.*2 รายการ/,
  );
});

test("collects inactive IDs for filtering every GA input source", () => {
  assert.deepEqual(
    [...collectInactiveStaffIds([
      { id: "inactive-home", user: { status: "inactive" } },
      { id: "inactive-helper", user: { status: "disabled" } },
      { id: "active", user: { status: "active" } },
      { id: "without-account", user: null },
    ])],
    ["inactive-home", "inactive-helper"],
  );
});
