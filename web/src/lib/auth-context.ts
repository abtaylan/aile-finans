import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserProfile } from "@/lib/types/database";

export async function requireFamilyContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/giris");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id, family_id, email, full_name, role, locale")
    .eq("id", user.id)
    .maybeSingle<UserProfile>();

  if (!profile) {
    redirect("/onboarding");
  }

  return { supabase, user, profile };
}
