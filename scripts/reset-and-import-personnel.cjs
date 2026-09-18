/* eslint-disable @typescript-eslint/no-require-imports */

const fs = require("node:fs");
const { createHash, randomUUID } = require("node:crypto");
const { spawnSync } = require("node:child_process");

require("dotenv/config");

const bcrypt = require("bcryptjs");
const XLSX = require("xlsx");

const args = parseArgs(process.argv.slice(2));
const excelPath = args.file;
const backupPath = args.backup;
const confirmed = args["confirm-reset"] === true;

if (!excelPath || !backupPath) {
  fail("Usage: node scripts/reset-and-import-personnel.cjs --file <xlsx> --backup <dump> [--confirm-reset]");
}
if (!fs.existsSync(excelPath)) fail(`Excel file not found: ${excelPath}`);
if (!fs.existsSync(backupPath)) fail(`Backup file not found: ${backupPath}`);

const rows = parseWorkbook(excelPath);
const summary = summarize(rows);
console.log(JSON.stringify({ mode: confirmed ? "import" : "dry-run", ...summary }, null, 2));

if (!confirmed) {
  console.log("Dry run complete. No database data was changed.");
  process.exit(0);
}

const databaseUrl = (process.env.DATABASE_URL || "").replace(/\?schema=public$/, "");
if (!databaseUrl) fail("DATABASE_URL is not configured.");

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));

async function main() {
  const importRows = await addPasswordHashes(rows);
  const sql = buildSql(importRows, excelPath, backupPath);
  const result = spawnSync("psql", [databaseUrl, "-v", "ON_ERROR_STOP=1"], {
    input: sql,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Database import failed.");
  }

  console.log(result.stdout.trim());
  console.log("Personnel reset and import completed successfully.");
}

function parseWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) fail("The workbook does not contain a worksheet.");

  const sheet = workbook.Sheets[sheetName];
  const values = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
  const rows = values.map((raw, index) => parseRow(raw, index + 2));
  const errors = rows.flatMap((row) => row.errors.map((message) => `Row ${row.rowNumber}: ${message}`));
  const duplicatedCodes = findDuplicates(rows.map((row) => row.staffCode));

  if (duplicatedCodes.length > 0) {
    errors.push(`Duplicate staff codes: ${duplicatedCodes.join(", ")}`);
  }
  if (errors.length > 0) {
    fail(`Excel validation failed:\n${errors.slice(0, 30).join("\n")}`);
  }

  return rows;
}

function parseRow(raw, rowNumber) {
  const homeWard = text(value(raw, ["หน่วยงาน (Unit/SMU ย่อย)", "หน่วยงาน", "วอร์ดหลัก"]));
  const position = text(value(raw, ["ตำแหน่ง"]));
  const payPosition = text(value(raw, ["ตำแหน่งตามการเบิกจ่าย", "ตำแหน่งเบิกจ่าย"]));
  const sourceCode = normalizeCode(value(raw, ["รหัสบุคลากร (ID)", "รหัสบุคลากร", "รหัส"]));
  const generatedStaffCode = !sourceCode;
  const staffCode = sourceCode || generatedCode(rowNumber, homeWard, position, payPosition);
  const otRate = numberValue(value(raw, ["ค่าตอบแทน OT", "OT"]));
  const shiftPayRate = numberValue(value(raw, ["ค่าเวร (บ ด)", "ค่าเวร"]));
  const isNewNurse = booleanValue(value(raw, ["พยาบาลใหม่ (ขึ้นเวรคู่ไม่ได้)", "พยาบาลใหม่"]));
  const canBeInCharge = booleanValue(value(raw, ["Incharge"]));
  const errors = [];

  if (!homeWard) errors.push("missing unit/ward");
  if (!position) errors.push("missing position");
  if (!payPosition) errors.push("missing payroll position");
  if (!otRate.valid) errors.push("invalid OT rate");
  if (!shiftPayRate.valid) errors.push("invalid shift rate");
  if (!isNewNurse.valid) errors.push("invalid new-nurse flag");
  if (!canBeInCharge.valid) errors.push("invalid Incharge flag");

  return {
    rowNumber,
    staffCode,
    generatedStaffCode,
    fullName: text(value(raw, ["ชื่อ-นามสกุล", "ชื่อ นามสกุล", "ชื่อ"])) || staffCode,
    homeWard,
    position,
    payPosition,
    staffCategory: category(payPosition),
    otRate: otRate.value,
    shiftPayRate: shiftPayRate.value,
    isHead: position.includes("หัวหน้า"),
    isNewNurse: isNewNurse.value,
    canBeInCharge: canBeInCharge.value,
    errors,
  };
}

async function addPasswordHashes(rows) {
  const result = rows.map((row) => ({ ...row, passwordHash: null }));
  const loginRows = result.filter((row) => !row.generatedStaffCode);

  for (let index = 0; index < loginRows.length; index += 8) {
    const batch = loginRows.slice(index, index + 8);
    await Promise.all(
      batch.map(async (row) => {
        row.passwordHash = await bcrypt.hash(`Nuh${row.staffCode}`, 12);
      }),
    );
  }

  return result;
}

function buildSql(rows, excelPath, backupPath) {
  const wardIds = new Map();
  for (const row of rows) {
    if (!wardIds.has(row.homeWard)) wardIds.set(row.homeWard, randomUUID());
  }

  const userIds = new Map(
    rows.filter((row) => !row.generatedStaffCode).map((row) => [row.staffCode, randomUUID()]),
  );
  const staffIds = new Map(rows.map((row) => [row.staffCode, randomUUID()]));
  const sql = [
    "BEGIN;",
    `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.name='admin') THEN RAISE EXCEPTION 'No admin account found; reset cancelled'; END IF; END $$;`,
    "TRUNCATE TABLE schedule_cycles, staff, wards, audit_logs RESTART IDENTITY CASCADE;",
    "DELETE FROM user_roles WHERE user_id NOT IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE r.name = 'admin');",
    "DELETE FROM users WHERE id NOT IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE r.name = 'admin');",
    "UPDATE ga_settings SET updated_by = NULL WHERE updated_by IS NOT NULL AND updated_by NOT IN (SELECT id FROM users);",
    roleInsert("nurse", "บุคลากรผู้ปฏิบัติงาน"),
    roleInsert("ward_head", "หัวหน้าหน่วยหรือหอผู้ป่วย"),
  ];

  sql.push(
    batchInsert(
      "wards",
      ["id", "code", "name", "created_at", "updated_at"],
      Array.from(wardIds, ([name, id]) => [id, wardCode(name), name, raw("NOW()"), raw("NOW()")]),
    ),
  );

  const loginRows = rows.filter((row) => !row.generatedStaffCode);
  sql.push(
    batchInsert(
      "users",
      ["id", "username", "password_hash", "display_name", "employee_code", "status", "created_at", "updated_at"],
      loginRows.map((row) => [
        userIds.get(row.staffCode), row.staffCode, row.passwordHash, row.fullName,
        row.staffCode, "active", raw("NOW()"), raw("NOW()"),
      ]),
    ),
  );
  sql.push(
    batchInsert(
      "user_roles",
      ["id", "user_id", "role_id", "created_at"],
      loginRows.map((row) => [
        randomUUID(), userIds.get(row.staffCode),
        raw(`(SELECT id FROM roles WHERE name = ${quote(row.isHead ? "ward_head" : "nurse")})`),
        raw("NOW()"),
      ]),
    ),
  );
  sql.push(
    batchInsert(
      "staff",
      [
        "id", "user_id", "staff_code", "full_name", "home_ward_id", "position",
        "pay_position", "staff_category", "ot_rate", "shift_pay_rate", "is_head",
        "is_trainee", "is_new_nurse", "can_be_in_charge", "created_at", "updated_at",
      ],
      rows.map((row) => [
        staffIds.get(row.staffCode), userIds.get(row.staffCode) || null, row.staffCode,
        row.fullName, wardIds.get(row.homeWard), row.position, row.payPosition,
        raw(`${quote(row.staffCategory)}::"StaffCategory"`), row.otRate, row.shiftPayRate,
        row.isHead, row.isNewNurse, row.isNewNurse, row.canBeInCharge,
        raw("NOW()"), raw("NOW()"),
      ]),
    ),
  );
  sql.push(
    batchInsert(
      "staff_ward_permissions",
      ["id", "staff_id", "ward_id", "created_at"],
      rows.map((row) => [
        randomUUID(), staffIds.get(row.staffCode), wardIds.get(row.homeWard), raw("NOW()"),
      ]),
    ),
  );
  sql.push(
    `INSERT INTO audit_logs (id, user_id, action, target_type, detail, created_at) VALUES (${quote(randomUUID())}, (SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.name='admin' ORDER BY u.created_at LIMIT 1), 'PERSONNEL_RESET_IMPORT', 'staff', ${quote(JSON.stringify({ excelPath, backupPath, importedRows: rows.length }))}::jsonb, NOW());`,
    "COMMIT;",
    "SELECT (SELECT COUNT(*) FROM ga_settings) AS ga_settings, (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM staff) AS staff, (SELECT COUNT(*) FROM wards) AS wards, (SELECT COUNT(*) FROM schedule_cycles) AS cycles;",
    "SELECT staff_category, COUNT(*) FROM staff GROUP BY staff_category ORDER BY staff_category;",
    "SELECT COUNT(*) FILTER (WHERE is_head) AS heads, COUNT(*) FILTER (WHERE is_new_nurse) AS new_nurses, COUNT(*) FILTER (WHERE can_be_in_charge) AS incharge_capable, COUNT(*) FILTER (WHERE user_id IS NULL) AS without_login FROM staff;",
  );

  return sql.filter(Boolean).join("\n");
}

function roleInsert(name, description) {
  return `INSERT INTO roles (id, name, description, created_at, updated_at) VALUES (${quote(randomUUID())}, ${quote(name)}, ${quote(description)}, NOW(), NOW()) ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, updated_at = NOW();`;
}

function batchInsert(table, columns, values, size = 200) {
  const statements = [];
  for (let index = 0; index < values.length; index += size) {
    const batch = values.slice(index, index + size);
    statements.push(
      `INSERT INTO ${identifier(table)} (${columns.map(identifier).join(", ")}) VALUES\n${batch
        .map((row) => `(${row.map(sqlValue).join(", ")})`)
        .join(",\n")};`,
    );
  }
  return statements.join("\n");
}

function sqlValue(value) {
  if (value && value.__raw) return value.__raw;
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return quote(value);
}

function raw(value) {
  return { __raw: value };
}

function quote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function identifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function value(row, aliases) {
  const normalized = new Map(Object.entries(row).map(([key, item]) => [normalize(key), item]));
  for (const alias of aliases) {
    if (normalized.has(normalize(alias))) return normalized.get(normalize(alias));
  }
  return "";
}

function normalize(value) {
  return String(value).trim().toLowerCase().replace(/[\s_()\-/]/g, "");
}

function text(value) {
  return String(value ?? "").trim();
}

function normalizeCode(value) {
  const code = text(value);
  return !code || code === "-" ? "" : code.toUpperCase();
}

function numberValue(value) {
  const normalized = text(value).replace(/,/g, "");
  if (!normalized) return { value: 0, valid: true };
  const number = Number(normalized);
  return { value: number, valid: Number.isFinite(number) && number >= 0 };
}

function booleanValue(value) {
  if (typeof value === "boolean") return { value, valid: true };
  const normalized = text(value).toLowerCase();
  if (["true", "yes", "y", "1", "ใช่"].includes(normalized)) return { value: true, valid: true };
  if (["false", "no", "n", "0", "ไม่ใช่"].includes(normalized)) return { value: false, valid: true };
  return { value: false, valid: false };
}

function generatedCode(rowNumber, homeWard, position, payPosition) {
  const digest = createHash("sha1")
    .update(`${rowNumber}|${homeWard}|${position}|${payPosition}`)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase();
  return `AUTO-${digest}`;
}

function category(payPosition) {
  const normalized = payPosition.toUpperCase();
  if (normalized.startsWith("RN")) return "RN";
  if (normalized === "PN") return "PN";
  if (normalized === "NA") return "NA";
  return "OTHER";
}

function wardCode(name) {
  return name.trim().replace(/\s+/g, "_").toUpperCase();
}

function findDuplicates(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return Array.from(counts).filter(([, count]) => count > 1).map(([value]) => value);
}

function summarize(rows) {
  return {
    staff: rows.length,
    loginAccounts: rows.filter((row) => !row.generatedStaffCode).length,
    generatedCodes: rows.filter((row) => row.generatedStaffCode).length,
    wards: new Set(rows.map((row) => row.homeWard)).size,
    heads: rows.filter((row) => row.isHead).length,
    newNurses: rows.filter((row) => row.isNewNurse).length,
    inchargeCapable: rows.filter((row) => row.canBeInCharge).length,
    categories: Object.fromEntries(
      ["RN", "PN", "NA", "OTHER"].map((item) => [item, rows.filter((row) => row.staffCategory === item).length]),
    ),
  };
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    if (!key.startsWith("--")) continue;
    const name = key.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) result[name] = true;
    else {
      result[name] = next;
      index += 1;
    }
  }
  return result;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
