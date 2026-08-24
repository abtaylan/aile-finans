import { requireFamilyContext } from "@/lib/auth-context";
import { AccountsClient } from "./accounts-client";
import type { Account } from "@/lib/types/database";

export default async function HesaplarPage() {
  const { supabase, profile } = await requireFamilyContext();

  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("family_id", profile.family_id)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });

  return <AccountsClient accounts={(accounts as Account[]) ?? []} />;
}
