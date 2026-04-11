import { createClient } from "@/lib/supabase/server";
import UserManagement from "@/components/settings/UserManagement";

export default async function UsersPage() {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profiles } = await (supabase as any)
    .from("permission_profiles")
    .select("id, name")
    .order("name");

  return <UserManagement profiles={profiles ?? []} />;
}
