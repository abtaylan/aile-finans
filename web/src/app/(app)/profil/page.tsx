import { requireFamilyContext } from "@/lib/auth-context";
import { ProfileClient } from "./profile-client";
import type { Family } from "@/lib/types/database";

export default async function ProfilPage() {
  const { supabase, profile } = await requireFamilyContext();

  const [{ data: family }, { count: memberCount }] = await Promise.all([
    supabase
      .from("families")
      .select("id, name, base_currency, timezone")
      .eq("id", profile.family_id)
      .maybeSingle<Family>(),
    supabase
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("family_id", profile.family_id),
  ]);

  return (
    <ProfileClient profile={profile} family={family ?? null} memberCount={memberCount ?? 1} />
  );
}
