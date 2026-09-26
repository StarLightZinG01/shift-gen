import assert from "node:assert/strict";
import test from "node:test";

import {
  isCycleDataLocked,
  isRequestWindowOpen,
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

test("data editing stops on the lock date and while GA is running", () => {
  assert.equal(
    isCycleDataLocked({ ...dates, status: "open" }, new Date("2026-09-21T17:00:00.000Z")),
    true,
  );
  assert.equal(isCycleDataLocked({ ...dates, status: "generating" }), true);
});

test("leave requests are accepted only during the configured request window", () => {
  const requestWindow = {
    ...dates,
    requestCloseDate: new Date("2026-09-15T00:00:00.000Z"),
    status: "open",
  };

  assert.equal(
    isRequestWindowOpen(requestWindow, new Date("2026-09-05T05:00:00.000Z")),
    true,
  );
  assert.equal(
    isRequestWindowOpen(requestWindow, new Date("2026-09-15T17:00:00.000Z")),
    false,
  );
});

test("requests remain open until the day before a same-day data lock", () => {
  const requestWindow = {
    requestOpenDate: new Date("2026-09-01T00:00:00.000Z"),
    requestCloseDate: new Date("2026-09-30T00:00:00.000Z"),
    dataLockDate: new Date("2026-09-30T00:00:00.000Z"),
    status: "locked",
  };

  assert.equal(
    isRequestWindowOpen(requestWindow, new Date("2026-09-29T16:59:59.000Z")),
    true,
  );
  assert.equal(
    isRequestWindowOpen(requestWindow, new Date("2026-09-29T17:00:00.000Z")),
    false,
  );
});
