import { notFound } from "next/navigation";
import { requireFamilyContext } from "@/lib/auth-context";
import { EkstreClient } from "./ekstre-client";
import type { Account, StatementWithItems } from "@/lib/types/database";

export default async function EkstrePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile } = await requireFamilyContext();

  const { data: account } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .eq("family_id", profile.family_id)
    .maybeSingle<Account>();

  if (!account || account.account_type !== "credit_card") {
    notFound();
  }

  const { data: statements } = await supabase
    .from("bank_statement_uploads")
    .select("*, items:bank_statement_staging_transactions(*)")
    .eq("account_id", id)
    .order("period_end", { ascending: false })
    .order("created_at", { ascending: false });

  return (
    <EkstreClient account={account} statements={(statements as StatementWithItems[]) ?? []} />
  );
}
