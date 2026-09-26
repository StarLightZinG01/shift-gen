import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";

import { SignJWT } from "jose";

const root = resolve(import.meta.dirname, "..");
const baseUrl = process.env.LOAD_TEST_BASE_URL ?? "http://localhost:3100";
const databaseUrl = process.env.LOAD_TEST_DATABASE_URL;
const cycleId = process.env.LOAD_TEST_CYCLE_ID;
const wardId = process.env.LOAD_TEST_WARD_ID;
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? 15);
const rounds = Number(process.env.LOAD_TEST_ROUNDS ?? 3);
const outputPath = resolve(
  root,
  process.env.LOAD_TEST_OUTPUT ?? "load-tests/results/ga-concurrency-latest.json",
);
const psqlPath =
  process.env.PSQL_PATH ?? "C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe";

assertLoadTestTarget();

const envFile = readEnvFile(resolve(root, ".env"));
const authSecret = process.env.AUTH_SECRET ?? envFile.AUTH_SECRET;
if (!authSecret || authSecret.length < 32) {
  throw new Error("AUTH_SECRET is missing or too short");
}

const actionId = findServerActionId("startGaRunAction");
const admin = getAdminSessionData();
const sessionToken = await createSessionToken(admin, authSecret);
const initialActiveRuns = Number(
  sqlScalar(
    `SELECT count(*) FROM ga_runs WHERE cycle_id='${cycleId}' AND status IN ('queued','running','processing')`,
  ),
);
if (initialActiveRuns !== 0) {
  throw new Error(`Test cycle already has ${initialActiveRuns} active GA runs`);
}

const report = {
  startedAt: new Date().toISOString(),
  target: { baseUrl, database: new URL(databaseUrl).pathname.slice(1), cycleId, wardId },
  actionId,
  concurrency,
  rounds: [],
};

console.log(`GA concurrency load test: ${rounds} rounds x ${concurrency} requests`);
console.log(`Target: ${baseUrl} / ${report.target.database}`);

for (let round = 1; round <= rounds; round += 1) {
  const before = getCounts();
  const startedAt = Date.now();
  const responses = await Promise.all(
    Array.from({ length: concurrency }, (_, index) => sendStartRequest(index + 1)),
  );
  const elapsedMs = Date.now() - startedAt;
  const after = getCounts();
  const created = {
    batches: after.batches - before.batches,
    runs: after.runs - before.runs,
    scheduleVersions: after.scheduleVersions - before.scheduleVersions,
    wardVersions: after.wardVersions - before.wardVersions,
  };
  const successResponses = responses.filter((item) => item.resultStatus === "success");
  const rejectedResponses = responses.filter((item) => item.resultStatus === "error");
  const invalidResponses = responses.filter(
    (item) => item.httpStatus >= 500 || item.resultStatus === "unknown",
  );
  const passed =
    created.batches === 1 &&
    created.runs === 1 &&
    successResponses.length === 1 &&
    rejectedResponses.length === concurrency - 1 &&
    invalidResponses.length === 0;

  const roundReport = {
    round,
    elapsedMs,
    passed,
    created,
    responseSummary: {
      success: successResponses.length,
      rejected: rejectedResponses.length,
      invalid: invalidResponses.length,
      httpStatuses: countBy(responses, (item) => String(item.httpStatus)),
      resultMessages: countBy(responses, (item) => item.message ?? "unparsed"),
    },
    responses,
  };
  report.rounds.push(roundReport);
  console.log(
    `Round ${round}: ${passed ? "PASS" : "FAIL"} | batches=${created.batches} runs=${created.runs} | success=${successResponses.length} rejected=${rejectedResponses.length} invalid=${invalidResponses.length} | ${elapsedMs}ms`,
  );

  resetRound();
}

report.finishedAt = new Date().toISOString();
report.passed = report.rounds.every((round) => round.passed);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(`Result: ${report.passed ? "PASS" : "FAIL"}`);
console.log(`Detailed output: ${outputPath}`);
process.exitCode = report.passed ? 0 : 1;

async function sendStartRequest(requestNo) {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}/home/schedule-rounds`, {
      method: "POST",
      headers: {
        Accept: "text/x-component",
        "Content-Type": "text/plain;charset=UTF-8",
        "Next-Action": actionId,
        Origin: baseUrl,
        Cookie: `shiftgen_session=${sessionToken}`,
      },
      body: JSON.stringify([{ cycleId, targetWardIds: [wardId] }]),
    });
    const body = await response.text();
    const parsed = parseActionResult(body);
    return {
      requestNo,
      elapsedMs: Date.now() - startedAt,
      httpStatus: response.status,
      resultStatus: parsed.status,
      message: parsed.message,
      bodySample: body.slice(0, 500),
    };
  } catch (error) {
    return {
      requestNo,
      elapsedMs: Date.now() - startedAt,
      httpStatus: 0,
      resultStatus: "unknown",
      message: error instanceof Error ? error.message : String(error),
      bodySample: "",
    };
  }
}

function parseActionResult(body) {
  const status = body.includes('"status":"success"')
    ? "success"
    : body.includes('"status":"error"')
      ? "error"
      : "unknown";
  const messageMatch = body.match(/"message":"((?:\\.|[^"\\])*)"/);
  let message = null;
  if (messageMatch) {
    try {
      message = JSON.parse(`"${messageMatch[1]}"`);
    } catch {
      message = messageMatch[1];
    }
  }
  return { status, message };
}

function getCounts() {
  const values = sqlRows(`
    SELECT
      (SELECT count(*) FROM ga_run_batches WHERE cycle_id='${cycleId}'),
      (SELECT count(*) FROM ga_runs WHERE cycle_id='${cycleId}'),
      (SELECT count(*) FROM schedule_versions WHERE cycle_id='${cycleId}'),
      (SELECT count(*) FROM schedule_ward_versions WHERE cycle_id='${cycleId}')
  `)[0];
  return {
    batches: Number(values[0]),
    runs: Number(values[1]),
    scheduleVersions: Number(values[2]),
    wardVersions: Number(values[3]),
  };
}

function resetRound() {
  sqlExec(`
    WITH active_batches AS (
      SELECT id, schedule_version_id
      FROM ga_run_batches
      WHERE cycle_id='${cycleId}' AND status IN ('queued','running','processing')
    )
    UPDATE ga_runs SET status='failed', finished_at=now()
    WHERE batch_id IN (SELECT id FROM active_batches)
      AND status IN ('queued','running','processing');

    WITH active_batches AS (
      SELECT id, schedule_version_id
      FROM ga_run_batches
      WHERE cycle_id='${cycleId}' AND status IN ('queued','running','processing')
    )
    UPDATE schedule_ward_versions SET status='failed'
    WHERE schedule_version_id IN (SELECT schedule_version_id FROM active_batches);

    WITH active_batches AS (
      SELECT id, schedule_version_id
      FROM ga_run_batches
      WHERE cycle_id='${cycleId}' AND status IN ('queued','running','processing')
    )
    UPDATE schedule_versions SET status='failed'
    WHERE id IN (SELECT schedule_version_id FROM active_batches);

    UPDATE ga_run_batches SET status='failed', finished_at=now()
    WHERE cycle_id='${cycleId}' AND status IN ('queued','running','processing');
    UPDATE schedule_cycles SET status='open' WHERE id='${cycleId}';
  `);
}

function getAdminSessionData() {
  const row = sqlRows(`
    SELECT u.id,u.username,u.display_name,coalesce(u.employee_code,''),u.session_version
    FROM users u
    JOIN user_roles ur ON ur.user_id=u.id
    JOIN roles r ON r.id=ur.role_id
    WHERE r.name='admin' AND u.status='active'
    ORDER BY u.created_at
    LIMIT 1
  `)[0];
  if (!row) throw new Error("No active admin account exists in the load-test database");
  return {
    userId: row[0],
    username: row[1],
    displayName: row[2],
    employeeCode: row[3] || null,
    roles: ["admin"],
    staffId: null,
    homeWardId: null,
    homeWardCode: null,
    isHead: false,
    sessionVersion: Number(row[4]),
  };
}

async function createSessionToken(payload, secret) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));
}

function findServerActionId(exportedName) {
  const manifest = JSON.parse(
    readFileSync(resolve(root, ".next/server/server-reference-manifest.json"), "utf8"),
  );
  const entry = Object.entries(manifest.node).find(
    ([, value]) => value.exportedName === exportedName,
  );
  if (!entry) throw new Error(`Cannot find server action ${exportedName} in build manifest`);
  return entry[0];
}

function sqlScalar(query) {
  return sqlRows(query)[0]?.[0] ?? "";
}

function sqlRows(query) {
  const output = runPsql(["-At", "-F", "\t", "-c", query]);
  if (!output.trim()) return [];
  return output.trim().split(/\r?\n/).map((line) => line.split("\t"));
}

function sqlExec(query) {
  runPsql(["-v", "ON_ERROR_STOP=1", "-q", "-c", query]);
}

function runPsql(args) {
  const url = new URL(databaseUrl);
  return execFileSync(
    psqlPath,
    ["-h", url.hostname, "-p", url.port || "5432", "-U", decodeURIComponent(url.username), "-d", url.pathname.slice(1), ...args],
    {
      encoding: "utf8",
      env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) },
    },
  );
}

function countBy(items, select) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const key = select(item);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map())].sort(([a], [b]) => a.localeCompare(b)),
  );
}

function readEnvFile(path) {
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map((match) => [match[1], match[2].replace(/^"|"$/g, "")]),
  );
}

function assertLoadTestTarget() {
  if (!databaseUrl || !cycleId || !wardId) {
    throw new Error("LOAD_TEST_DATABASE_URL, LOAD_TEST_CYCLE_ID and LOAD_TEST_WARD_ID are required");
  }
  const database = new URL(databaseUrl);
  const server = new URL(baseUrl);
  if (!["localhost", "127.0.0.1"].includes(database.hostname)) {
    throw new Error("Load test database must be hosted on localhost");
  }
  if (!database.pathname.toLowerCase().includes("loadtest")) {
    throw new Error("Load test database name must include 'loadtest'");
  }
  if (!["localhost", "127.0.0.1"].includes(server.hostname)) {
    throw new Error("Load test server must be hosted on localhost");
  }
  if (!Number.isInteger(concurrency) || concurrency < 10 || concurrency > 20) {
    throw new Error("LOAD_TEST_CONCURRENCY must be an integer from 10 to 20");
  }
  if (!Number.isInteger(rounds) || rounds < 3) {
    throw new Error("LOAD_TEST_ROUNDS must be at least 3");
  }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(cycleId) || !uuid.test(wardId)) {
    throw new Error("Cycle and ward IDs must be UUIDs");
  }
}
