-- user_profiles: store the user's DingTalk userid centrally so it can be
-- referenced from any notification surface instead of being copied into
-- each workflow_step.
alter table public.user_profiles
  add column if not exists dingtalk_userid text;

comment on column public.user_profiles.dingtalk_userid is
  'DingTalk userid (员工ID from admin console). Used by workflow notifications when this user is in assignee_user_ids.';

-- workflow_steps: add a typed reference to users, separate from the legacy
-- free-text assignee_emails / assignee_dingtalk_userids arrays which remain
-- for external contacts that do NOT have a CRM account.
alter table public.workflow_steps
  add column if not exists assignee_user_ids uuid[] not null default '{}'::uuid[];

comment on column public.workflow_steps.assignee_user_ids is
  'user_profiles.user_id references. Each selected user is notified via their own email + dingtalk_userid + notification_prefs.';
