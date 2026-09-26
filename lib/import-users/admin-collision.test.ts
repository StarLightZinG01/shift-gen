import assert from "node:assert/strict";
import test from "node:test";

import { hasAdminRole } from "./admin-collision.ts";

test("recognizes an Admin account before personnel import upsert", () => {
  assert.equal(hasAdminRole(["admin"]), true);
  assert.equal(hasAdminRole(["Admin", "nurse"]), true);
  assert.equal(hasAdminRole(["ward_head", "nurse"]), false);
});
