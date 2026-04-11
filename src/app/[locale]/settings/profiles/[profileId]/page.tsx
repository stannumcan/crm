import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ProfileEditor from "@/components/settings/ProfileEditor";

export default async function ProfileEditorPage({
  params,
}: {
  params: Promise<{ locale: string; profileId: string }>;
}) {
  const { locale, profileId } = await params;
  const supabase = await createClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile, error } = await (supabase as any)
    .from("permission_profiles")
    .select("*")
    .eq("id", profileId)
    .single();

  if (error || !profile) notFound();

  return <ProfileEditor profile={profile} locale={locale} />;
}
