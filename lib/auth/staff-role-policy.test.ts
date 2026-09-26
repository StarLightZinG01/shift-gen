import assert from "node:assert/strict";
import test from "node:test";

import { getStaffRoleSyncPlan } from "./staff-role-policy.ts";

test("promotes a nurse to ward head without retaining the nurse role", () => {
  assert.deepEqual(getStaffRoleSyncPlan(["nurse"], true), {
    desiredRoleName: "ward_head",
    roleNamesToRemove: ["nurse"],
    shouldAddDesiredRole: true,
    preservesAdmin: false,
  });
});

test("demotes a ward head to nurse", () => {
  assert.deepEqual(getStaffRoleSyncPlan(["ward_head"], false), {
    desiredRoleName: "nurse",
    roleNamesToRemove: ["ward_head"],
    shouldAddDesiredRole: true,
    preservesAdmin: false,
  });
});

test("does not rewrite an already synchronized clinical role", () => {
  const plan = getStaffRoleSyncPlan(["ward_head"], true);
  assert.deepEqual(plan.roleNamesToRemove, []);
  assert.equal(plan.shouldAddDesiredRole, false);
});

test("never removes or replaces an admin role during staff synchronization", () => {
  assert.deepEqual(getStaffRoleSyncPlan(["admin"], false), {
    desiredRoleName: "nurse",
    roleNamesToRemove: [],
    shouldAddDesiredRole: false,
    preservesAdmin: true,
  });

  const multiRolePlan = getStaffRoleSyncPlan(["admin", "ward_head"], false);
  assert.deepEqual(multiRolePlan.roleNamesToRemove, []);
  assert.equal(multiRolePlan.shouldAddDesiredRole, false);
  assert.equal(multiRolePlan.preservesAdmin, true);
});
