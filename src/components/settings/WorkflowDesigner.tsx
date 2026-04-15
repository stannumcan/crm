"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import {
  Loader2, Mail, MailX, Pencil, Plus, X, ArrowDown, Check,
  FileText, Factory, Calculator, Truck, Send, ThumbsUp, MessageSquare, User,
} from "lucide-react";

interface WorkflowStep {
  id: string;
  step_key: string;
  label: string;
  description: string | null;
  step_order: number;
  assignee_emails: string[];
  send_email: boolean;
  task_description: string | null;
  subject_template: string | null;
  send_dingtalk: boolean;
  assignee_dingtalk_userids: string[];
  assignee_user_ids: string[];
}

interface DirectoryUser {
  user_id: string;
  display_name: string | null;
  email: string | null;
  dingtalk_userid: string | null;
}

const STEP_COLORS: Record<string, string> = {
  draft:           "oklch(0.62 0.15 25)",   // orange-red
  pending_factory: "oklch(0.60 0.18 50)",   // amber
  pending_wilfred: "oklch(0.55 0.15 300)",  // purple
  pending_natsuki: "oklch(0.55 0.15 260)",  // blue-purple
  sent:            "oklch(0.55 0.15 230)",   // blue
  approved:        "oklch(0.55 0.18 145)",   // green
};

const STEP_ICONS: Record<string, React.ElementType> = {
  draft:           FileText,
  pending_factory: Factory,
  pending_wilfred: Calculator,
  pending_natsuki: Truck,
  sent:            Send,
  approved:        ThumbsUp,
};

export default function WorkflowDesigner() {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Edit modal
  const [editStep, setEditStep] = useState<WorkflowStep | null>(null);
  const [editEmails, setEditEmails] = useState<string[]>([]);
  const [editNewEmail, setEditNewEmail] = useState("");
  const [editSendEmail, setEditSendEmail] = useState(true);
  const [editTask, setEditTask] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editSendDingtalk, setEditSendDingtalk] = useState(false);
  const [editDingtalkIds, setEditDingtalkIds] = useState<string[]>([]);
  const [editNewDingtalkId, setEditNewDingtalkId] = useState("");
  const [editAssignedUserIds, setEditAssignedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");

  // User directory (loaded once)
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);

  const fetchSteps = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/workflow");
    const data = await res.json();
    setSteps(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  const fetchDirectory = useCallback(async () => {
    const res = await fetch("/api/admin/users/directory");
    if (res.ok) {
      const data = await res.json();
      setDirectory(Array.isArray(data) ? data : []);
    }
  }, []);

  useEffect(() => { fetchSteps(); }, [fetchSteps]);
  useEffect(() => { fetchDirectory(); }, [fetchDirectory]);

  const openEdit = (step: WorkflowStep) => {
    setEditStep(step);
    setEditEmails([...step.assignee_emails]);
    setEditSendEmail(step.send_email);
    setEditTask(step.task_description ?? "");
    setEditSubject(step.subject_template ?? "");
    setEditNewEmail("");
    setEditSendDingtalk(step.send_dingtalk ?? false);
    setEditDingtalkIds([...(step.assignee_dingtalk_userids ?? [])]);
    setEditNewDingtalkId("");
    setEditAssignedUserIds([...(step.assignee_user_ids ?? [])]);
    setUserSearch("");
  };

  const addAssignedUser = (userId: string) => {
    if (!editAssignedUserIds.includes(userId)) {
      setEditAssignedUserIds([...editAssignedUserIds, userId]);
    }
    setUserSearch("");
  };

  const removeAssignedUser = (userId: string) => {
    setEditAssignedUserIds(editAssignedUserIds.filter((id) => id !== userId));
  };

  const addEmail = () => {
    const email = editNewEmail.trim().toLowerCase();
    if (!email || !email.includes("@") || editEmails.includes(email)) return;
    setEditEmails([...editEmails, email]);
    setEditNewEmail("");
  };

  const removeEmail = (email: string) => {
    setEditEmails(editEmails.filter((e) => e !== email));
  };

  const addDingtalkId = () => {
    const id = editNewDingtalkId.trim();
    if (!id || editDingtalkIds.includes(id)) return;
    setEditDingtalkIds([...editDingtalkIds, id]);
    setEditNewDingtalkId("");
  };

  const removeDingtalkId = (id: string) => {
    setEditDingtalkIds(editDingtalkIds.filter((x) => x !== id));
  };

  const handleSave = async () => {
    if (!editStep) return;
    setSaving(editStep.id);
    await fetch("/api/admin/workflow", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editStep.id,
        assignee_emails: editEmails,
        send_email: editSendEmail,
        task_description: editTask.trim() || null,
        subject_template: editSubject.trim() || null,
        send_dingtalk: editSendDingtalk,
        assignee_dingtalk_userids: editDingtalkIds,
        assignee_user_ids: editAssignedUserIds,
      }),
    });
    setEditStep(null);
    setSaving(null);
    fetchSteps();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">Quotation Workflow</h2>
        <p className="text-sm text-muted-foreground">
          Configure who gets notified at each step. When a quote moves to the next stage, an email is sent automatically.
        </p>
      </div>

      {/* Flow chart */}
      <div className="relative">
        {steps.map((step, idx) => {
          const color = STEP_COLORS[step.step_key] ?? "oklch(0.5 0 0)";
          const Icon = STEP_ICONS[step.step_key] ?? FileText;
          const isLast = idx === steps.length - 1;
          const assignedUsers = (step.assignee_user_ids ?? [])
            .map((uid) => directory.find((d) => d.user_id === uid))
            .filter((u): u is DirectoryUser => !!u);
          const hasRecipients = step.assignee_emails.length > 0 || assignedUsers.length > 0;

          return (
            <div key={step.id}>
              {/* Step card */}
              <div
                className="relative rounded-xl border overflow-hidden transition-all hover:shadow-md"
                style={{ borderColor: color + "40" }}
              >
                {/* Colored header bar */}
                <div
                  className="flex items-center gap-2.5 px-4 py-2.5"
                  style={{ background: color, color: "white" }}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-semibold flex-1">{step.label}</span>
                  <span className="text-xs opacity-75 font-mono">{String(step.step_order).padStart(2, "0")}</span>
                </div>

                {/* Body */}
                <div className="px-4 py-3 bg-card">
                  {/* Description */}
                  {step.description && (
                    <p className="text-xs text-muted-foreground mb-2">{step.description}</p>
                  )}

                  {/* Task */}
                  {step.task_description && (
                    <div className="rounded-md bg-muted/50 px-3 py-2 mb-2 text-xs text-foreground">
                      {step.task_description}
                    </div>
                  )}

                  {/* Assignees */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      {hasRecipients ? (
                        <div className="flex flex-wrap gap-1.5">
                          {assignedUsers.map((u) => (
                            <Badge
                              key={u.user_id}
                              variant="outline"
                              className="text-xs gap-1"
                              style={{ borderColor: color + "50", color: color }}
                              title={u.email ?? undefined}
                            >
                              <User className="h-3 w-3" />
                              {u.display_name || u.email}
                            </Badge>
                          ))}
                          {step.assignee_emails.map((email) => (
                            <Badge
                              key={email}
                              variant="outline"
                              className="text-xs gap-1 opacity-80"
                              style={{ borderColor: color + "50", color: color }}
                              title="External recipient (no CRM account)"
                            >
                              <Mail className="h-3 w-3" />
                              {email}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                          <MailX className="h-3 w-3" /> No recipients configured
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {step.send_email ? (
                        <Badge variant="outline" className="text-xs text-green-700 border-green-200 bg-green-50 gap-1">
                          <Mail className="h-3 w-3" /> On
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                          <MailX className="h-3 w-3" /> Off
                        </Badge>
                      )}
                      {step.send_dingtalk && step.assignee_dingtalk_userids?.length > 0 && (
                        <Badge
                          variant="outline"
                          className="text-xs gap-1 border-blue-200 bg-blue-50 text-blue-700"
                          title={`DingTalk: ${step.assignee_dingtalk_userids.length} user(s)`}
                        >
                          <MessageSquare className="h-3 w-3" /> DT
                        </Badge>
                      )}
                      <Button
                        variant="ghost" size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => openEdit(step)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Connector arrow */}
              {!isLast && (
                <div className="flex flex-col items-center py-2">
                  <div className="w-px h-6 bg-border" />
                  <ArrowDown className="h-4 w-4 text-muted-foreground -mt-1" />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit modal */}
      <Modal open={!!editStep} onClose={() => setEditStep(null)} title={`Configure: ${editStep?.label ?? ""}`}>
        <div className="space-y-5">
          {/* Assigned users — picks from user directory; resolves email + dingtalk from their profile */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Assigned Users</Label>
            <p className="text-xs text-muted-foreground">
              Pick CRM users by name. Their email and DingTalk userid come from their profile automatically —
              update Settings → Users once, applies everywhere.
            </p>
            <div className="relative">
              <Input
                placeholder="Search users by name or email..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="h-8 text-sm"
              />
              {userSearch.trim().length > 0 && (() => {
                const q = userSearch.trim().toLowerCase();
                const matches = directory
                  .filter((u) => !editAssignedUserIds.includes(u.user_id))
                  .filter((u) =>
                    (u.display_name?.toLowerCase() ?? "").includes(q) ||
                    (u.email?.toLowerCase() ?? "").includes(q),
                  )
                  .slice(0, 8);
                if (matches.length === 0) {
                  return (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-card shadow-lg p-2 text-xs text-muted-foreground">
                      No matches. Check Settings → Users to add them.
                    </div>
                  );
                }
                return (
                  <div className="absolute z-10 mt-1 w-full rounded-md border bg-card shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                    {matches.map((u) => (
                      <button
                        key={u.user_id}
                        type="button"
                        onClick={() => addAssignedUser(u.user_id)}
                        className="w-full px-3 py-2 text-left hover:bg-muted/60 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm truncate">{u.display_name || u.email || "Unnamed"}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {u.email ?? "—"}
                            {u.dingtalk_userid ? <span className="ml-1 font-mono">· DT: {u.dingtalk_userid}</span> : null}
                          </p>
                        </div>
                        <Plus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
            {editAssignedUserIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {editAssignedUserIds.map((uid) => {
                  const u = directory.find((d) => d.user_id === uid);
                  const label = u?.display_name || u?.email || uid.slice(0, 8);
                  const missingEmail = u && !u.email;
                  const missingDingtalk = u && editSendDingtalk && !u.dingtalk_userid;
                  return (
                    <Badge
                      key={uid}
                      variant="secondary"
                      className="gap-1 text-xs pr-1"
                      title={missingDingtalk ? "No DingTalk userid on profile — DingTalk notif will skip this user" : undefined}
                    >
                      <User className="h-3 w-3" />
                      {label}
                      {(missingEmail || missingDingtalk) && (
                        <span className="text-amber-600">!</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeAssignedUser(uid)}
                        className="hover:text-red-600 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {/* Email toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Send Email Notification</Label>
              <p className="text-xs text-muted-foreground">Fires when this step&apos;s work is completed</p>
            </div>
            <button
              type="button"
              onClick={() => setEditSendEmail(!editSendEmail)}
              className="relative w-10 h-5 rounded-full transition-colors"
              style={{ background: editSendEmail ? "var(--primary)" : "oklch(0.85 0 0)" }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
                style={{ left: editSendEmail ? "calc(100% - 18px)" : "2px" }}
              />
            </button>
          </div>

          {/* External email recipients (non-user) */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Additional External Emails</Label>
            <p className="text-xs text-muted-foreground">For factory reps, customers, or others without a CRM account.</p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="Add email address..."
                value={editNewEmail}
                onChange={(e) => setEditNewEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addEmail(); } }}
                className="flex-1 h-8 text-sm"
              />
              <Button size="sm" variant="outline" onClick={addEmail} className="shrink-0 h-8">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {editEmails.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {editEmails.map((email) => (
                  <Badge key={email} variant="secondary" className="gap-1.5 text-xs pr-1">
                    <Mail className="h-3 w-3" />
                    {email}
                    <button onClick={() => removeEmail(email)} className="hover:text-red-600 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Subject line */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Email Subject Line</Label>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <span className="font-medium">Placeholders:</span>{" "}
                <code>{"{company}"}</code>, <code>{"{project}"}</code>, <code>{"{wo}"}</code>,{" "}
                <code>{"{mold}"}</code>, <code>{"{step}"}</code>
              </p>
              <p>
                <span className="font-medium">Reference numbers:</span>{" "}
                <code>{"{ref}"}</code> = chain ID (e.g. JP260001-ML0599-A),{" "}
                <code>{"{ref_fc}"}</code> factory sheet,{" "}
                <code>{"{ref_cc}"}</code> /CC,{" "}
                <code>{"{ref_dc}"}</code> /DC,{" "}
                <code>{"{ref_cq}"}</code> /CQ
              </p>
            </div>
            <Input
              value={editSubject}
              onChange={(e) => setEditSubject(e.target.value)}
              placeholder="e.g. Pricing Request - {ref_fc} - {company} - {project}"
            />
          </div>

          {/* Task description */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Task Instructions</Label>
            <p className="text-xs text-muted-foreground">Shown in the email and on the step card</p>
            <textarea
              value={editTask}
              onChange={(e) => setEditTask(e.target.value)}
              placeholder="e.g. Please review factory costs and approve..."
              className="w-full rounded-md border px-3 py-2 text-sm min-h-[80px] resize-y"
              style={{ borderColor: "var(--border)", background: "var(--background)" }}
            />
          </div>

          {/* DingTalk section */}
          <div className="space-y-3 rounded-lg border p-3" style={{ borderColor: "oklch(0.88 0.04 230)", background: "oklch(0.98 0.01 230)" }}>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                  DingTalk Work Notification (工作通知)
                </Label>
                <p className="text-xs text-muted-foreground">Direct DM to specific DingTalk users when this step fires</p>
              </div>
              <button
                type="button"
                onClick={() => setEditSendDingtalk(!editSendDingtalk)}
                className="relative w-10 h-5 rounded-full transition-colors shrink-0"
                style={{ background: editSendDingtalk ? "var(--primary)" : "oklch(0.85 0 0)" }}
              >
                <div
                  className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
                  style={{ left: editSendDingtalk ? "calc(100% - 18px)" : "2px" }}
                />
              </button>
            </div>
            {editSendDingtalk && (
              <div className="space-y-2">
                <Label className="text-xs font-medium">Additional External DingTalk userIds</Label>
                <p className="text-[11px] text-muted-foreground">
                  Assigned users (above) auto-receive DingTalk notifications if their profile has a DingTalk userid set.
                  Add external DingTalk IDs here only for people without a CRM account.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add DingTalk userid..."
                    value={editNewDingtalkId}
                    onChange={(e) => setEditNewDingtalkId(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDingtalkId(); } }}
                    className="flex-1 h-8 text-sm font-mono"
                  />
                  <Button size="sm" variant="outline" onClick={addDingtalkId} className="shrink-0 h-8">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {editDingtalkIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {editDingtalkIds.map((id) => (
                      <Badge key={id} variant="secondary" className="gap-1 text-xs pr-1 font-mono">
                        {id}
                        <button onClick={() => removeDingtalkId(id)} className="hover:text-red-600 transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <Button variant="outline" onClick={() => setEditStep(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving === editStep?.id}>
              {saving === editStep?.id ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-1.5" />Saving...</>
              ) : (
                <><Check className="h-4 w-4 mr-1.5" />Save</>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
