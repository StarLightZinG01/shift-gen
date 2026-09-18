import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDefaultSpecialRuleSettings,
  mergeStoredSpecialRuleSettings,
} from "./special-rules.ts";

test("Eye enables the current morning RN and weekday PN rules", () => {
  const settings = buildDefaultSpecialRuleSettings("EYE");
  const rnRule = settings.find((item) => item.ruleKey === "morning_rn_by_day");
  const pnRule = settings.find((item) => item.ruleKey === "weekday_morning_pn_exact");

  assert.equal(rnRule?.enabled, true);
  assert.deepEqual(rnRule?.parameters, {
    mondayWednesday: 7,
    tuesdayThursdayFriday: 6,
    holiday: 4,
  });
  assert.equal(pnRule?.enabled, true);
  assert.deepEqual(pnRule?.parameters, { exactCount: 1 });
});

test("Eye preserves every RN value saved by the user", () => {
  const first = mergeStoredSpecialRuleSettings("EYE", [
    {
      ruleKey: "morning_rn_by_day",
      enabled: true,
      parameters: { mondayWednesday: 5, tuesdayThursdayFriday: 4, holiday: 3 },
    },
  ]).find((item) => item.ruleKey === "morning_rn_by_day");
  const second = mergeStoredSpecialRuleSettings("EYE", [
    {
      ruleKey: "morning_rn_by_day",
      enabled: true,
      parameters: { mondayWednesday: 8, tuesdayThursdayFriday: 6, holiday: 4 },
    },
  ]).find((item) => item.ruleKey === "morning_rn_by_day");

  assert.deepEqual(first?.parameters, {
    mondayWednesday: 5,
    tuesdayThursdayFriday: 4,
    holiday: 3,
  });
  assert.deepEqual(second?.parameters, {
    mondayWednesday: 8,
    tuesdayThursdayFriday: 6,
    holiday: 4,
  });
});
