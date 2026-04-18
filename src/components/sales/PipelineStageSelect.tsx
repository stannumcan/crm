"use client";

import { PIPELINE_STAGES } from "@/lib/sales-constants";

interface Props {
  value: string;
  onChange: (stage: string) => void;
  disabled?: boolean;
}

export function PipelineStageSelect({ value, onChange, disabled }: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="text-xs border rounded px-2 py-1 bg-background capitalize"
    >
      {PIPELINE_STAGES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
