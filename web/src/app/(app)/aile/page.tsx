import { requireFamilyContext } from "@/lib/auth-context";
import { AileClient } from "./aile-client";
import type { Category, Family, FamilyInvite, FamilyMember } from "@/lib/types/database";

export default async function AilePage() {
  const { supabase, profile } = await requireFamilyContext();
  const isAdmin = profile.role === "owner" || profile.role === "admin";

  const [{ data: family }, { data: members }, { data: invites }, { data: categories }] =
    await Promise.all([
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
      // Bekleyen davetler yalnızca owner/admin için RLS'te görünür;
      // member/viewer için bu sorgu boş döner (hata vermez).
      supabase
        .from("family_invites")
        .select("id, family_id, email, role, token, status, created_at, expires_at")
        .eq("family_id", profile.family_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .returns<FamilyInvite[]>(),
      supabase
        .from("categories")
        .select("id, family_id, parent_category_id, name, type, icon, color, is_system_default")
        .eq("family_id", profile.family_id)
        .order("type", { ascending: true })
        .order("name", { ascending: true })
        .returns<Category[]>(),
    ]);

  return (
    <AileClient
      profile={profile}
      family={family ?? null}
      members={members ?? []}
      invites={invites ?? []}
      categories={categories ?? []}
      isAdmin={isAdmin}
    />
  );
}
