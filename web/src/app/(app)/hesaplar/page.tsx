import { requireFamilyContext } from "@/lib/auth-context";
import { AccountsClient } from "./accounts-client";
import type { Account, Asset, BankStatementUpload } from "@/lib/types/database";

export default async function HesaplarPage() {
const { supabase, profile } = await requireFamilyContext();

const [{ data: accounts }, { data: assets }] = await Promise.all([
supabase
.from("accounts")
.select("*")
.eq("family_id", profile.family_id)
.eq("is_active", true)
.order("display_order", { ascending: true })
.order("created_at", { ascending: true }),
supabase.from("assets").select("*").eq("is_active", true).order("name"),
]);

const typedAccounts = (accounts as Account[]) ?? [];
const creditCardIds = typedAccounts
.filter((a) => a.account_type === "credit_card")
.map((a) => a.id);

const latestStatements: Record<string, BankStatementUpload> = {};
if (creditCardIds.length > 0) {
const { data: statements } = await supabase
.from("bank_statement_uploads")
.select("*")
.in("account_id", creditCardIds)
.order("period_end", { ascending: false });
for (const statement of (statements as BankStatementUpload[]) ?? []) {
if (statement.account_id && !latestStatements[statement.account_id]) {
latestStatements[statement.account_id] = statement;
}
}
}

return (
<AccountsClient
accounts={typedAccounts}
assets={(assets as Asset[]) ?? []}
latestStatements={latestStatements}
/>
);
}
