import assert from "node:assert/strict";
import test from "node:test";

import {
  canManageWardScheduleVersions,
  isSubmittedPreparationStatus,
  selectLatestPublishedWardVersion,
  userVisibleWardVersionStatuses,
} from "./dashboard-rules.ts";

test("nurse dashboards expose published ward versions only", () => {
  assert.deepEqual(userVisibleWardVersionStatuses, ["published"]);
  assert.equal(userVisibleWardVersionStatuses.includes("published"), true);
  assert.equal(userVisibleWardVersionStatuses.includes("draft" as "published"), false);
});

test("submitted ward counts exclude draft preparations", () => {
  assert.equal(isSubmittedPreparationStatus("draft"), false);
  assert.equal(isSubmittedPreparationStatus("submitted"), true);
  assert.equal(isSubmittedPreparationStatus("ready"), true);

  const statuses = ["draft", "submitted", "ready"];
  assert.equal(statuses.filter(isSubmittedPreparationStatus).length, 2);
});

test("only admin and ward heads can browse ward schedule versions", () => {
  assert.equal(canManageWardScheduleVersions(["ward_head"]), true);
  assert.equal(canManageWardScheduleVersions(["admin"]), true);
  assert.equal(canManageWardScheduleVersions(["nurse"]), false);
});

test("home dashboard selects the newest published ward version", () => {
  const versions = [
    {
      id: "draft-new",
      status: "draft",
      createdAt: new Date("2026-09-25"),
      scheduleVersion: { cycle: { year: 2569, month: 10 } },
    },
    {
      id: "main-old",
      status: "published",
      createdAt: new Date("2026-09-26"),
      scheduleVersion: { cycle: { year: 2569, month: 8 } },
    },
    {
      id: "main-new",
      status: "published",
      createdAt: new Date("2026-09-20"),
      scheduleVersion: { cycle: { year: 2569, month: 9 } },
    },
  ];

  assert.equal(selectLatestPublishedWardVersion(versions)?.id, "main-new");
  assert.equal(
    selectLatestPublishedWardVersion([
      {
        id: "draft",
        status: "draft",
        createdAt: new Date("2026-09-25"),
        scheduleVersion: { cycle: { year: 2569, month: 9 } },
      },
    ]),
    null,
  );
});
