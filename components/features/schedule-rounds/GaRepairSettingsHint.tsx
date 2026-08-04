export function GaRepairSettingsHint() {
  return (
    <div className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
      <p className="font-medium text-foreground">Repair interval</p>
      <p className="mt-1">
        Full Repair Every คือจำนวน generation ต่อการซ่อมตารางแบบเต็ม ส่วน Repair Elite Every
        คือจำนวน generation ต่อการซ่อมคำตอบ elite เพื่อคุมคุณภาพคำตอบระหว่างรัน GA
      </p>
    </div>
  );
}
