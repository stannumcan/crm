alter table public.user_profiles
  add column if not exists notification_prefs jsonb not null default '{"email": true, "dingtalk": true}'::jsonb;

comment on column public.user_profiles.notification_prefs is
  'Per-user notification channel toggles: { email: bool, dingtalk: bool }. Controls whether workflow emails/DMs get sent to this user.';
