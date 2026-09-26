import assert from "node:assert/strict";
import test from "node:test";

import { getRetryWardIds } from "./retry-targets.ts";

test("retry targets only wards stored in the failed run snapshot", () => {
  assert.deepEqual(
    getRetryWardIds({
      wards: [{ id: "ward-a" }, { id: "ward-b" }, { id: "ward-a" }],
    }),
    ["ward-a", "ward-b"],
  );
});

test("invalid snapshots cannot widen retry to other failed wards", () => {
  assert.deepEqual(getRetryWardIds(null), []);
  assert.deepEqual(getRetryWardIds({ wards: [{ code: "A" }, null, "ward-b"] }), []);
});
