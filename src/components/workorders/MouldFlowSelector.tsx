"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";

const FLOW_OPTIONS: { value: string; label: string }[] = [
  { value: "existing", label: "Existing Mould" },
  { value: "new", label: "New Mould" },
  { value: "modification", label: "Modification" },
];

export default function MouldFlowSelector({
  workorderId,
  currentFlow,
}: {
  workorderId: string;
  currentFlow: string;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const handleChange = async (value: string | null) => {
    if (!value) return;
    setSaving(true);
    try {
      // Update the mould_flow on the work order
      await fetch(`/api/workorders/${workorderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mould_flow: value }),
      });

      // Delete existing milestones so they re-seed with the new flow on next load
      await fetch(`/api/workorders/${workorderId}/milestones/reseed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow: value }),
      });

      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      <Select value={currentFlow} onValueChange={handleChange} disabled={saving}>
        <SelectTrigger className="h-7 text-xs w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FLOW_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
