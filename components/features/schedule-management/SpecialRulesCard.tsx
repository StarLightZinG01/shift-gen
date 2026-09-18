"use client";

import { useState } from "react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PENDING_SPECIAL_RULES,
  SPECIAL_RULE_DEFINITIONS,
  type SpecialRuleSetting,
} from "@/lib/schedule-management/special-rules";

export function SpecialRulesCard({
  initialSettings,
  wardCode,
}: {
  initialSettings: SpecialRuleSetting[];
  wardCode: string;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [parameterDrafts, setParameterDrafts] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        initialSettings.flatMap((setting) =>
          Object.entries(setting.parameters).map(([key, value]) => [
            `${setting.ruleKey}.${key}`,
            String(value),
          ]),
        ),
      ),
  );
  const pendingRules = PENDING_SPECIAL_RULES.filter((rule) =>
    (rule.wardCodes as readonly string[]).includes(wardCode.trim().toUpperCase()),
  );
  const enabledRuleCount = settings.filter((setting) => setting.enabled).length;

  return (
    <details className="group overflow-hidden rounded-2xl border bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <h2 className="font-semibold">3. กฎเฉพาะของวอร์ด</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {enabledRuleCount > 0
              ? `เปิดใช้ ${enabledRuleCount} กฎ`
              : "ยังไม่ได้เปิดใช้กฎเฉพาะ"}
            {pendingRules.length > 0 ? ` · รอข้อมูล ${pendingRules.length} กฎ` : ""}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-brand">
          <span className="hidden sm:inline">ดูและตั้งค่ากฎ</span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            size={20}
            strokeWidth={2}
            className="transition-transform duration-200 group-open:rotate-180"
          />
        </span>
      </summary>

      <div className="divide-y border-t">
        {SPECIAL_RULE_DEFINITIONS.map((definition) => {
          const setting = settings.find(
            (item) => item.ruleKey === definition.ruleKey,
          );
          if (!setting) return null;

          return (
            <div key={definition.ruleKey} className="px-4 py-4 sm:px-6">
              <input name="specialRuleKey" type="hidden" value={definition.ruleKey} />
              <input
                name={`specialRule.${definition.ruleKey}.enabled`}
                type="hidden"
                value={setting.enabled ? "true" : "false"}
              />
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <Label className="text-sm font-semibold leading-5">
                    {definition.title}
                  </Label>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground sm:text-sm">
                    {definition.description}
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={setting.enabled}
                  aria-label={`เปิดใช้ ${definition.title}`}
                  className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 ${
                    setting.enabled ? "bg-brand" : "bg-slate-200"
                  }`}
                  onClick={() =>
                    setSettings((current) =>
                      current.map((item) =>
                        item.ruleKey === definition.ruleKey
                          ? { ...item, enabled: !item.enabled }
                          : item,
                      ),
                    )
                  }
                >
                  <span
                    className={`absolute left-0 top-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${
                      setting.enabled ? "translate-x-[18px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>

              {setting.enabled && definition.parameterFields.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {definition.parameterFields.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{field.label}</Label>
                      <Input
                        name={`specialRule.${definition.ruleKey}.${field.key}`}
                        type="number"
                        inputMode="numeric"
                        min={field.min}
                        step={1}
                        value={
                          parameterDrafts[`${definition.ruleKey}.${field.key}`] ??
                          String(
                            setting.parameters[field.key] ??
                              definition.defaults[field.key],
                          )
                        }
                        onChange={(event) => {
                          const rawValue = event.target.value;
                          const draftKey = `${definition.ruleKey}.${field.key}`;
                          setParameterDrafts((current) => ({
                            ...current,
                            [draftKey]: rawValue,
                          }));

                          if (rawValue.trim() === "") return;
                          const value = Number(rawValue);
                          if (!Number.isFinite(value)) return;
                          setSettings((current) =>
                            current.map((item) =>
                              item.ruleKey === definition.ruleKey
                                ? {
                                    ...item,
                                    parameters: {
                                      ...item.parameters,
                                      [field.key]: Math.max(field.min, Math.trunc(value)),
                                    },
                                  }
                                : item,
                            ),
                          );
                        }}
                        onBlur={(event) => {
                          const draftKey = `${definition.ruleKey}.${field.key}`;
                          const value = Number(event.target.value);
                          const normalized = Number.isFinite(value)
                            ? Math.max(field.min, Math.trunc(value))
                            : (setting.parameters[field.key] ??
                              definition.defaults[field.key]);
                          setParameterDrafts((current) => ({
                            ...current,
                            [draftKey]: String(normalized),
                          }));
                          setSettings((current) =>
                            current.map((item) =>
                              item.ruleKey === definition.ruleKey
                                ? {
                                    ...item,
                                    parameters: {
                                      ...item.parameters,
                                      [field.key]: normalized,
                                    },
                                  }
                                : item,
                            ),
                          );
                        }}
                        className="h-9 max-w-56 bg-white"
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {pendingRules.length > 0 ? (
        <div className="border-t bg-slate-50 px-4 py-4 sm:px-6 sm:py-5">
          <h3 className="text-sm font-semibold">กฎที่รอข้อมูลเพิ่มเติม</h3>
          <div className="mt-3 divide-y rounded-lg border bg-white">
            {pendingRules.map((rule) => (
              <div key={rule.title} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{rule.title}</p>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    รอข้อมูล
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{rule.reason}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </details>
  );
}
