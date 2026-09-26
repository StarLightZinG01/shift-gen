import assert from "node:assert/strict";
import test from "node:test";

import { getNextManualVersionNumber } from "./version-number.ts";

test("starts a ward version sequence at one", () => {
  assert.equal(getNextManualVersionNumber(null), 1);
});

test("successive manual saves receive new version numbers", () => {
  const firstSave = getNextManualVersionNumber(3);
  const secondSave = getNextManualVersionNumber(firstSave);

  assert.equal(firstSave, 4);
  assert.equal(secondSave, 5);
});

test("global and ward version sequences advance independently", () => {
  assert.equal(getNextManualVersionNumber(10), 11);
  assert.equal(getNextManualVersionNumber(2), 3);
});
