import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWardVersionScopes,
  toAssignmentScopeWhere,
} from "./assignment-scopes.ts";

test("assignment scopes keep schedule version and ward paired", () => {
  assert.deepEqual(
    toAssignmentScopeWhere([
      { scheduleVersionId: "version-cardio", wardId: "cardio" },
      { scheduleVersionId: "version-vip", wardId: "vip" },
    ]),
    [
      { scheduleVersionId: "version-cardio", wardId: "cardio" },
      { scheduleVersionId: "version-vip", wardId: "vip" },
    ],
  );
});

test("assignment scopes do not collapse different wards in a shared version", () => {
  assert.deepEqual(
    buildWardVersionScopes([
      { scheduleVersionId: "shared-version", wardId: "cardio" },
      { scheduleVersionId: "shared-version", wardId: "vip" },
      { scheduleVersionId: "shared-version", wardId: "cardio" },
    ]),
    [
      { scheduleVersionId: "shared-version", wardId: "cardio" },
      { scheduleVersionId: "shared-version", wardId: "vip" },
    ],
  );
});
