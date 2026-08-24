import { requireFamilyContext } from "@/lib/auth-context";
import { BudgetClient } from "./budget-client";
import type { Account, Category, Transaction } from "@/lib/types/database";

export default async function ButcePage() {
  const { supabase, profile } = await requireFamilyContext();

  const [{ data: accounts }, { data: categories }, { data: transactions }] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("family_id", profile.family_id)
      .eq("is_active", true)
      .order("display_order"),
    supabase
      .from("categories")
      .select("*")
      .or(`family_id.eq.${profile.family_id},family_id.is.null`)
      .neq("type", "transfer"),
    supabase
      .from("transactions")
      .select("*")
      .eq("family_id", profile.family_id)
      .order("transaction_date", { ascending: false })
      .limit(200),
  ]);

  return (
    <BudgetClient
      accounts={(accounts as Account[]) ?? []}
      categories={(categories as Category[]) ?? []}
      transactions={(transactions as Transaction[]) ?? []}
    />
  );
}
