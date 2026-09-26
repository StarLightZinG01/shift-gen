import assert from "node:assert/strict";
import test from "node:test";

import {
  getAdminSessionAccess,
  isSessionCurrent,
} from "./session-validity.ts";

const session = { sessionVersion: 3 };

test("accepts an active user with the current session version", () => {
  assert.equal(
    isSessionCurrent(session, { status: "active", sessionVersion: 3 }),
    true,
  );
});

test("rejects a revoked session version", () => {
  assert.equal(
    isSessionCurrent(session, { status: "active", sessionVersion: 4 }),
    false,
  );
});

test("rejects an inactive user", () => {
  assert.equal(
    isSessionCurrent(session, { status: "inactive", sessionVersion: 3 }),
    false,
  );
});

test("rejects a session whose user no longer exists", () => {
  assert.equal(isSessionCurrent(session, null), false);
});

test("allows a current admin session", () => {
  assert.equal(getAdminSessionAccess({ roles: ["admin"] }), "allow");
});

test("keeps a valid non-admin signed in but denies the admin page", () => {
  assert.equal(getAdminSessionAccess({ roles: ["nurse"] }), "forbidden");
});

test("sends a missing or revoked session through cookie cleanup", () => {
  assert.equal(getAdminSessionAccess(null), "session-expired");
});
