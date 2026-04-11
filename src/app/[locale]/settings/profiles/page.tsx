import { createClient } from "@/lib/supabase/server";
import ProfileList from "@/components/settings/ProfileList";

export default async function ProfilesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles } = await (supabase as any)
    .from("permission_profiles")
    .select("*")
    .order("created_at");

  // Count users per profile
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: userCounts } = await (supabase as any)
    .from("user_profiles")
    .select("profile_id");

  const countMap: Record<string, number> = {};
  for (const u of userCounts ?? []) {
    if (u.profile_id) countMap[u.profile_id] = (countMap[u.profile_id] ?? 0) + 1;
  }

  return <ProfileList profiles={profiles ?? []} userCounts={countMap} locale={locale} />;
}
