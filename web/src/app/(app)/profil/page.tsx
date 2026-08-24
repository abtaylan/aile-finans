import { requireFamilyContext } from "@/lib/auth-context";
import { ProfileClient } from "./profile-client";
import type { Family, UserProfile } from "@/lib/types/database";

export type FamilyMember = Pick<UserProfile, "id" | "full_name" | "email" | "role">;

export default async function ProfilPage() {
  const { supabase, profile } = await requireFamilyContext();

  const [{ data: family }, { data: members }] = await Promise.all([
    supabase
      .from("families")
      .select("id, name, base_currency, timezone")
      .eq("id", profile.family_id)
      .maybeSingle<Family>(),
    supabase
      .from("users")
      .select("id, full_name, email, role")
      .eq("family_id", profile.family_id)
      .order("created_at", { ascending: true })
      .returns<FamilyMember[]>(),
  ]);

  return (
    <ProfileClient
      profile={profile}
      family={family ?? null}
      members={members ?? []}
    />
  );
}
