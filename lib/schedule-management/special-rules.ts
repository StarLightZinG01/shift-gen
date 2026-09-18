export const AVAILABLE_SPECIAL_RULE_KEYS = [
  "incharge_min_per_shift",
  "icu_new_not_together",
  "sunday_morning_rn_exact",
  "morning_rn_by_day",
  "weekday_morning_pn_exact",
  "pn_na_equal_per_shift",
] as const;

export type AvailableSpecialRuleKey =
  (typeof AVAILABLE_SPECIAL_RULE_KEYS)[number];

export type SpecialRuleParameters = Record<string, number>;

export type SpecialRuleSetting = {
  ruleKey: AvailableSpecialRuleKey;
  enabled: boolean;
  parameters: SpecialRuleParameters;
};

export type SpecialRuleDefinition = {
  ruleKey: AvailableSpecialRuleKey;
  title: string;
  description: string;
  parameterFields: Array<{
    key: string;
    label: string;
    min: number;
  }>;
  defaults: SpecialRuleParameters;
};

export const SPECIAL_RULE_DEFINITIONS: SpecialRuleDefinition[] = [
  {
    ruleKey: "incharge_min_per_shift",
    title: "ทุกกะต้องมี RN.Incharge",
    description: "กำหนดจำนวน RN.Incharge ขั้นต่ำที่ต้องมีในทุกกะ",
    parameterFields: [{ key: "minCount", label: "จำนวน Incharge ขั้นต่ำต่อกะ", min: 1 }],
    defaults: { minCount: 1 },
  },
  {
    ruleKey: "icu_new_not_together",
    title: "RN ICU/RNSuC และ RN new ห้ามขึ้นร่วมกัน",
    description: "ไม่จัด RN ICU หรือ RNSuC และพยาบาลใหม่ให้อยู่ในกะเดียวกัน",
    parameterFields: [],
    defaults: {},
  },
  {
    ruleKey: "sunday_morning_rn_exact",
    title: "กำหนดจำนวน RN เวรเช้าวันอาทิตย์",
    description: "จำนวน RN ต้องเท่ากับค่าที่ระบุในทุกเช้าวันอาทิตย์",
    parameterFields: [{ key: "exactCount", label: "จำนวน RN", min: 0 }],
    defaults: { exactCount: 4 },
  },
  {
    ruleKey: "morning_rn_by_day",
    title: "กำหนด RN เวรเช้าตามประเภทวัน",
    description: "กำหนดจำนวน RN เวรเช้าแยกระหว่างวันจันทร์/พุธ วันอังคาร/พฤหัสบดี/ศุกร์ และวันหยุด",
    parameterFields: [
      { key: "mondayWednesday", label: "RN วันจันทร์และพุธ", min: 0 },
      { key: "tuesdayThursdayFriday", label: "RN วันอังคาร พฤหัสบดี และศุกร์", min: 0 },
      { key: "holiday", label: "RN วันหยุด", min: 0 },
    ],
    defaults: { mondayWednesday: 7, tuesdayThursdayFriday: 6, holiday: 4 },
  },
  {
    ruleKey: "weekday_morning_pn_exact",
    title: "วันราชการเวรเช้าต้องมี PN 1 คน",
    description: "ใช้เฉพาะวันจันทร์-ศุกร์ที่ไม่ใช่วันหยุด โดยไม่นับ NA รวมกับ PN",
    parameterFields: [{ key: "exactCount", label: "จำนวน PN", min: 0 }],
    defaults: { exactCount: 1 },
  },
  {
    ruleKey: "pn_na_equal_per_shift",
    title: "PN และ NA ต้องขึ้นเป็นคู่",
    description: "ทุกกะต้องมี PN และ NA อย่างน้อยตามจำนวนที่กำหนดและมีจำนวนเท่ากัน",
    parameterFields: [{ key: "minEach", label: "จำนวนคู่ขั้นต่ำต่อกะ", min: 1 }],
    defaults: { minEach: 1 },
  },
];

export const PENDING_SPECIAL_RULES = [
  {
    wardCodes: ["MED1"],
    title: "เวรเช้า PN/NA รวม Clerk ตามจำนวนวันราชการและวันหยุด",
    reason: "รอข้อมูลว่าบุคลากรคนใดเป็น Clerk",
  },
  {
    wardCodes: ["STROKE"],
    title: "เวรเช้า PN รวม Clerk ตามจำนวนวันราชการและวันหยุด",
    reason: "รอข้อมูลวอร์ด Stroke และข้อมูล Clerk",
  },
  {
    wardCodes: ["ER"],
    title: "แต่ละเวรต้องมีพี่ Senior อย่างน้อย 4 คน",
    reason: "รอข้อมูลว่าบุคลากรคนใดเป็น Senior",
  },
] as const;

export function buildDefaultSpecialRuleSettings(
  wardCode: string,
): SpecialRuleSetting[] {
  const code = wardCode.trim().toUpperCase();

  return SPECIAL_RULE_DEFINITIONS.map((definition) => {
    const setting: SpecialRuleSetting = {
      ruleKey: definition.ruleKey,
      enabled: false,
      parameters: { ...definition.defaults },
    };

    if (["NICU", "LR"].includes(code) && definition.ruleKey === "incharge_min_per_shift") {
      setting.enabled = true;
      setting.parameters.minCount = 1;
    }
    if (code === "LR" && definition.ruleKey === "icu_new_not_together") {
      setting.enabled = true;
    }
    if (code === "PICU" && definition.ruleKey === "incharge_min_per_shift") {
      setting.enabled = true;
      setting.parameters.minCount = 2;
    }
    if (code === "VIP_SURG" && definition.ruleKey === "sunday_morning_rn_exact") {
      setting.enabled = true;
      setting.parameters.exactCount = 4;
    }
    if (code === "EYE" && definition.ruleKey === "morning_rn_by_day") {
      setting.enabled = true;
    }
    if (code === "EYE" && definition.ruleKey === "weekday_morning_pn_exact") {
      setting.enabled = true;
    }
    if (code === "ER" && definition.ruleKey === "pn_na_equal_per_shift") {
      setting.enabled = true;
      setting.parameters.minEach = 1;
    }

    return setting;
  });
}

export function mergeStoredSpecialRuleSettings(
  wardCode: string,
  stored: Array<{ ruleKey: string; enabled: boolean; parameters: unknown }>,
) {
  const defaults = buildDefaultSpecialRuleSettings(wardCode);
  const storedByKey = new Map(stored.map((item) => [item.ruleKey, item]));

  return defaults.map((setting) => {
    const saved = storedByKey.get(setting.ruleKey);
    if (!saved) return setting;
    return {
      ...setting,
      enabled: saved.enabled,
      parameters: normalizeParameters(saved.parameters, setting.parameters),
    };
  });
}

export function normalizeParameters(
  value: unknown,
  fallback: SpecialRuleParameters,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...fallback };
  }

  const raw = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(fallback).map(([key, defaultValue]) => {
      const numberValue = Number(raw[key]);
      return [key, Number.isFinite(numberValue) ? Math.max(0, Math.trunc(numberValue)) : defaultValue];
    }),
  );
}
