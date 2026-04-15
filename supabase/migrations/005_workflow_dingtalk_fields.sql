alter table public.workflow_steps
  add column if not exists send_dingtalk boolean not null default false,
  add column if not exists assignee_dingtalk_userids text[] not null default '{}'::text[];

comment on column public.workflow_steps.send_dingtalk is
  'When true, sends a DingTalk work notification (工作通知) in parallel with email on this step';
comment on column public.workflow_steps.assignee_dingtalk_userids is
  'DingTalk userids (员工ID from admin console) to notify. Independent from assignee_emails.';
