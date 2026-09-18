/* eslint-disable @typescript-eslint/no-require-imports */
const { spawnSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
require("dotenv/config");

const apply = process.argv.includes("--apply");
const connection = new URL(process.env.DATABASE_URL);
const env = {
  ...process.env,
  PGHOST: connection.hostname,
  PGPORT: connection.port || "5432",
  PGDATABASE: decodeURIComponent(connection.pathname.slice(1)),
  PGUSER: decodeURIComponent(connection.username),
  PGPASSWORD: decodeURIComponent(connection.password),
  PGCLIENTENCODING: "UTF8",
};

function sql(query) {
  const result = spawnSync("psql", ["-X", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1"], {
    input: query,
    encoding: "utf8",
    env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || "Database command failed");
  return result.stdout.trim();
}

const quote = (value) => `'${String(value).replace(/'/g, "''")}'`;
const staff = [];
function add(code, position, category, head = false, incharge = false, newNurse = false) {
  staff.push({
    id: randomUUID(), code: `TEST-${code}`, position, category,
    name: `Test ${code}${head ? " Head" : ""}${newNurse ? " New" : ""}`,
    head, incharge, newNurse,
    ot: category === "RN" ? 800 : category === "PN" ? 500 : 400,
    allowance: category === "RN" ? 360 : category === "PN" ? 240 : 200,
  });
}
add("HEAD01", "RN", "RN", true, true);
add("ANES01", "RNanes", "RN", false, true);
for (let i = 1; i <= 3; i++) add(`ICU0${i}`, "RNICU", "RN", false, true);
for (let i = 1; i <= 2; i++) add(`SUC0${i}`, "RNSuC", "RN", false, true);
for (let i = 1; i <= 8; i++) add(`RN0${i}`, "RN", "RN", false, i <= 4, i >= 7);
for (let i = 1; i <= 5; i++) add(`PN0${i}`, "PN", "PN");
for (let i = 1; i <= 5; i++) add(`NA0${i}`, "NA", "NA");

const codes = staff.map((row) => quote(row.code)).join(",");
const conflict = sql(`SELECT json_build_object(
  'wards', (SELECT count(*) FROM wards WHERE lower(code) = 'test' OR lower(name) = 'test'),
  'staff', (SELECT count(*) FROM staff WHERE staff_code IN (${codes}))
);`);
const existing = JSON.parse(conflict);
if (existing.wards || existing.staff) {
  throw new Error(`Test data already exists; nothing changed: ${conflict}`);
}

console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ward: "test", count: staff.length,
  incharge: staff.filter((row) => row.incharge).length,
  newNurse: staff.filter((row) => row.newNurse).length,
  positions: Object.fromEntries([...new Set(staff.map((row) => row.position))]
    .map((position) => [position, staff.filter((row) => row.position === position).length])),
}, null, 2));

if (apply) {
  const wardId = randomUUID();
  const values = staff.map((row) => `(${quote(row.id)}, ${quote(row.code)}, ${quote(row.name)},
    ${quote(wardId)}, ${quote(row.position)}, ${quote(row.position)}, ${quote(row.category)},
    ${row.ot}, ${row.allowance}, ${row.head}, ${row.newNurse}, ${row.newNurse}, ${row.incharge}, now(), now())`);
  // The whole fixture commits together; existing rows are never updated or deleted.
  sql(`BEGIN;
    INSERT INTO wards (id, code, name, created_at, updated_at)
    VALUES (${quote(wardId)}, 'test', 'test', now(), now());
    INSERT INTO staff (id, staff_code, full_name, home_ward_id, position, pay_position,
      staff_category, ot_rate, shift_pay_rate, is_head, is_trainee, is_new_nurse, can_be_in_charge,
      created_at, updated_at) VALUES ${values.join(",")};
    INSERT INTO staff_ward_permissions (id, staff_id, ward_id, created_at)
    VALUES ${staff.map((row) => `(${quote(randomUUID())}, ${quote(row.id)}, ${quote(wardId)}, now())`).join(",")};
    COMMIT;`);
  console.log(sql(`SELECT json_build_object('wardId', w.id, 'code', w.code,
    'staff', count(s.id), 'heads', count(*) FILTER (WHERE s.is_head),
    'rn', count(*) FILTER (WHERE s.staff_category = 'RN'),
    'pn', count(*) FILTER (WHERE s.staff_category = 'PN'),
    'na', count(*) FILTER (WHERE s.staff_category = 'NA'),
    'incharge', count(*) FILTER (WHERE s.can_be_in_charge),
    'newNurse', count(*) FILTER (WHERE s.is_new_nurse))
    FROM wards w JOIN staff s ON s.home_ward_id = w.id
    WHERE w.id = ${quote(wardId)} GROUP BY w.id;`));
}
