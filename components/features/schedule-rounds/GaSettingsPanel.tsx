"use client";

import { useState, useTransition } from "react";
import { AiSettingIcon, RotateClockwiseIcon, SaveIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  activateGaSettingsProfileAction,
  saveGaSettingsAction,
} from "@/app/actions/ga-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { defaultGaSettings } from "@/lib/schedule-rounds/ga-settings-defaults";
import type { GaSettingsData } from "@/lib/schedule-rounds/types";

import { GaRepairSettingsHint } from "./GaRepairSettingsHint";

type GaSettingsPanelProps = {
  data: GaSettingsData;
  profiles: GaSettingsData[];
};

type GaSettingsFormState = {
  profileKey: string;
  profileName: string;
  populationSize: string;
  generations: string;
  patience: string;
  eliteSize: string;
  tournamentSize: string;
  crossoverRate: string;
  mutationRate: string;
  fullRepairEvery: string;
  repairEliteEvery: string;
  randomSeed: string;
  maxSeconds: string;
  maxShiftsPer7Days: string;
  maxConsecutiveNights: string;
  maxConsecutiveWorkDays: string;
  maxTraineePerShift: string;
  minRestHours: string;
};

export function GaSettingsPanel({ data, profiles }: GaSettingsPanelProps) {
  const router = useRouter();
  const profileOptions = profiles.some((profile) => profile.profileKey === data.profileKey)
    ? profiles
    : [data, ...profiles];
  const [form, setForm] = useState<GaSettingsFormState>(() => mapDataToForm(data));
  const [selectedProfileKey, setSelectedProfileKey] = useState(data.profileKey);
  const [isPending, startTransition] = useTransition();

  function updateField<K extends keyof GaSettingsFormState>(
    key: K,
    value: GaSettingsFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetToDefaults() {
    setForm(mapDataToForm(defaultGaSettings));
    setSelectedProfileKey(defaultGaSettings.profileKey);
    toast.info("คืนค่าเริ่มต้นของ GA แล้ว กดบันทึกเพื่อเก็บลงฐานข้อมูล");
  }

  function handleSelectProfile(profileKey: string) {
    const selectedProfile = profileOptions.find((profile) => profile.profileKey === profileKey);

    if (!selectedProfile) {
      return;
    }

    setSelectedProfileKey(profileKey);
    setForm(mapDataToForm(selectedProfile));

    startTransition(async () => {
      const result = await activateGaSettingsProfileAction(profileKey);

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
    });
  }

  function handleSubmit() {
    saveSettings();
  }

  function handleSaveAsNew() {
    saveSettings({ saveAsNew: true });
  }

  function saveSettings({ saveAsNew = false }: { saveAsNew?: boolean } = {}) {
    startTransition(async () => {
      const result = await saveGaSettingsAction({
        profileKey: saveAsNew ? "" : form.profileKey,
        saveAsNew,
        profileName: form.profileName,
        populationSize: form.populationSize,
        generations: form.generations,
        patience: form.patience,
        eliteSize: form.eliteSize,
        tournamentSize: form.tournamentSize,
        crossoverRate: form.crossoverRate,
        mutationRate: form.mutationRate,
        fullRepairEvery: form.fullRepairEvery,
        repairEliteEvery: form.repairEliteEvery,
        randomSeed: form.randomSeed,
        maxSeconds: form.maxSeconds,
        maxShiftsPer7Days: form.maxShiftsPer7Days,
        maxConsecutiveNights: form.maxConsecutiveNights,
        maxConsecutiveWorkDays: form.maxConsecutiveWorkDays,
        maxTraineePerShift: form.maxTraineePerShift,
        minRestHours: form.minRestHours,
      });

      if (result.status === "error") {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
      if (result.profileKey) {
        setForm((current) => ({
          ...current,
          profileKey: result.profileKey ?? current.profileKey,
        }));
        setSelectedProfileKey(result.profileKey);
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
              <HugeiconsIcon icon={AiSettingIcon} size={14} strokeWidth={2} />
              ตั้งค่าการจัดตาราง
            </div>
            <h2 className="mt-3 text-xl font-semibold">ตั้งค่า GA</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ปรับค่าที่ใช้จูน Genetic Algorithm ก่อนเริ่มจัดตารางเวร ค่าเหล่านี้จะถูกบันทึกเป็นค่ากลางของระบบ
            </p>
          </div>
          <div className="rounded-xl border bg-[#F8FDFE] px-4 py-3 text-sm">
            <p className="font-medium">
              {data.source === "database" ? "บันทึกในฐานข้อมูลแล้ว" : "กำลังใช้ค่าเริ่มต้น"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              อัปเดตล่าสุด: {data.updatedAtLabel}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid gap-5 lg:grid-cols-3">
          <ProfileSelect
            label="เลือกชุดค่า GA"
            value={selectedProfileKey}
            profiles={profileOptions}
            disabled={isPending}
            onChange={handleSelectProfile}
          />
          <TextField
            label="ชื่อชุดค่า"
            value={form.profileName}
            onChange={(value) => updateField("profileName", value)}
          />
        </div>

        <GaCoreSettingsGroup>
          <NumberField
            label="Population Size"
            min={20}
            value={form.populationSize}
            onChange={(value) => updateField("populationSize", value)}
          />
          <NumberField
            label="Generations"
            min={1}
            value={form.generations}
            onChange={(value) => updateField("generations", value)}
          />
          <NumberField
            label="Patience"
            min={1}
            value={form.patience}
            onChange={(value) => updateField("patience", value)}
          />
          <NumberField
            label="Elite Size"
            min={1}
            value={form.eliteSize}
            onChange={(value) => updateField("eliteSize", value)}
          />
          <NumberField
            label="Tournament Size"
            min={2}
            value={form.tournamentSize}
            onChange={(value) => updateField("tournamentSize", value)}
          />
          <NumberField
            label="Crossover Rate"
            min={0}
            max={1}
            step="0.01"
            value={form.crossoverRate}
            onChange={(value) => updateField("crossoverRate", value)}
          />
          <NumberField
            label="Mutation Rate"
            min={0}
            max={1}
            step="0.001"
            value={form.mutationRate}
            onChange={(value) => updateField("mutationRate", value)}
          />
          <NumberField
            label="Full Repair Every"
            helper="จำนวน gen ต่อการซ่อมเต็ม"
            min={1}
            value={form.fullRepairEvery}
            onChange={(value) => updateField("fullRepairEvery", value)}
          />
          <NumberField
            label="Repair Elite Every"
            helper="จำนวน gen ต่อการซ่อม elite"
            min={1}
            value={form.repairEliteEvery}
            onChange={(value) => updateField("repairEliteEvery", value)}
          />
          <NumberField
            label="Max Seconds"
            min={1}
            value={form.maxSeconds}
            onChange={(value) => updateField("maxSeconds", value)}
          />
          <NumberField
            label="Random Seed"
            helper="เว้นว่าง = สุ่ม"
            value={form.randomSeed}
            onChange={(value) => updateField("randomSeed", value)}
          />
          <div className="hidden xl:block" />
          <GaRepairSettingsHint />
        </GaCoreSettingsGroup>

        <SettingGroup title="กฎพื้นฐานและข้อจำกัด">
          <NumberField
            label="จำนวนเวรสูงสุดใน 7 วัน"
            min={1}
            value={form.maxShiftsPer7Days}
            onChange={(value) => updateField("maxShiftsPer7Days", value)}
          />
          <NumberField
            label="ทำงานติดกันสูงสุด"
            min={1}
            value={form.maxConsecutiveWorkDays}
            onChange={(value) => updateField("maxConsecutiveWorkDays", value)}
          />
          <NumberField
            label="พยาบาลฝึกหัดสูงสุดต่อกะ"
            min={0}
            value={form.maxTraineePerShift}
            onChange={(value) => updateField("maxTraineePerShift", value)}
          />
          <NumberField
            label="ชั่วโมงพักขั้นต่ำ"
            min={0}
            value={form.minRestHours}
            onChange={(value) => updateField("minRestHours", value)}
          />
        </SettingGroup>

        <div className="mt-6 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-md"
            disabled={isPending}
            onClick={resetToDefaults}
          >
            <HugeiconsIcon icon={RotateClockwiseIcon} size={17} strokeWidth={2} />
            คืนค่าเริ่มต้น
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-md"
            disabled={isPending}
            onClick={handleSaveAsNew}
          >
            <HugeiconsIcon icon={SaveIcon} size={17} strokeWidth={2} />
            {isPending ? "กำลังบันทึก..." : "บันทึกเป็นชุดใหม่"}
          </Button>
          <Button
            type="button"
            className="h-10 rounded-md"
            disabled={isPending}
            onClick={handleSubmit}
          >
            <HugeiconsIcon icon={SaveIcon} size={17} strokeWidth={2} />
            {isPending ? "กำลังบันทึก..." : "บันทึกการตั้งค่า GA"}
          </Button>
        </div>
      </section>
    </div>
  );
}

function SettingGroup({
  title,
  children,
  hidden = false,
}: {
  title: string;
  children: React.ReactNode;
  hidden?: boolean;
}) {
  if (hidden) {
    return null;
  }

  return (
    <div className="mt-6 border-t pt-5">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </div>
  );
}

function GaCoreSettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 border-t pt-5">
      <h3 className="text-sm font-semibold text-foreground">ค่าหลักของ GA</h3>
      <div className="mt-4 grid gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3 [&>*:last-child]:md:col-span-2 [&>*:last-child]:xl:col-span-3">
        {children}
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        className="h-10 rounded-md bg-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function ProfileSelect({
  label,
  value,
  profiles,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  profiles: GaSettingsData[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <select
        className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {profiles.map((profile) => (
          <option key={profile.profileKey} value={profile.profileKey}>
            {profile.profileName} ({profile.profileKey})
            {profile.isActive ? " - ใช้งานอยู่" : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function NumberField({
  label,
  helper,
  value,
  min,
  max,
  step = "1",
  onChange,
}: {
  label: string;
  helper?: string;
  value: string;
  min?: number;
  max?: number;
  step?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        {helper ? <span className="text-xs text-muted-foreground">{helper}</span> : null}
      </div>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        className="h-10 rounded-md bg-white"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function mapDataToForm(data: GaSettingsData): GaSettingsFormState {
  return {
    profileKey: data.profileKey,
    profileName: data.profileName,
    populationSize: String(data.populationSize),
    generations: String(data.generations),
    patience: String(data.patience),
    eliteSize: String(data.eliteSize),
    tournamentSize: String(data.tournamentSize),
    crossoverRate: String(data.crossoverRate),
    mutationRate: String(data.mutationRate),
    fullRepairEvery: String(data.fullRepairEvery),
    repairEliteEvery: String(data.repairEliteEvery),
    randomSeed: data.randomSeed === null ? "" : String(data.randomSeed),
    maxSeconds: String(data.maxSeconds),
    maxShiftsPer7Days: String(data.maxShiftsPer7Days),
    maxConsecutiveNights: String(data.maxConsecutiveNights),
    maxConsecutiveWorkDays: String(data.maxConsecutiveWorkDays),
    maxTraineePerShift: String(data.maxTraineePerShift),
    minRestHours: String(data.minRestHours),
  };
}
