import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveCycleStatus,
  resolveScheduledCycleStatus,
} from "./cycle-status.ts";

const dates = {
  requestOpenDate: new Date("2026-09-01T00:00:00.000Z"),
  dataLockDate: new Date("2026-09-22T00:00:00.000Z"),
};

test("a stale locked value is displayed from the configured dates", () => {
  assert.equal(
    resolveCycleStatus(
      { ...dates, status: "locked" },
      new Date("2026-09-06T05:00:00.000Z"),
    ),
    "open",
  );
});

test("timeline status opens and locks on the configured Bangkok dates", () => {
  assert.equal(
    resolveScheduledCycleStatus(dates, new Date("2026-08-31T16:59:59.000Z")),
    "preparing",
  );
  assert.equal(
    resolveScheduledCycleStatus(dates, new Date("2026-08-31T17:00:00.000Z")),
    "open",
  );
  assert.equal(
    resolveScheduledCycleStatus(dates, new Date("2026-09-21T17:00:00.000Z")),
    "locked",
  );
});

test("active GA and published statuses take precedence over dates", () => {
  assert.equal(resolveCycleStatus({ ...dates, status: "generating" }), "generating");
  assert.equal(resolveCycleStatus({ ...dates, status: "published" }), "published");
});
