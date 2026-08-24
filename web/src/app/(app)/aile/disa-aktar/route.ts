import { NextResponse } from "next/server";
import { requireFamilyContext } from "@/lib/auth-context";

// Aile verilerini JSON olarak dışa aktarır. (app) grubunun layout.tsx'i
// route handler'ları sarmadığı için yetki kontrolü burada ayrıca yapılır.
export async function GET() {
  const { supabase, profile } = await requireFamilyContext();

  if (profile.role !== "owner" && profile.role !== "admin") {
    return NextResponse.json({ error: "Bu işlem için yetkin yok." }, { status: 403 });
  }

  const familyId = profile.family_id;

  const [
    family,
    members,
    accounts,
    categories,
    recurringRules,
    transactions,
    properties,
    loans,
    besAccounts,
    besContributions,
    bankStatementUploads,
    zakatCalculations,
    zakatItems,
    budgets,
    assetHoldings,
    assetTransactions,
  ] = await Promise.all([
    supabase.from("families").select("*").eq("id", familyId).maybeSingle(),
    supabase
      .from("users")
      .select("id, full_name, email, role, locale, created_at")
      .eq("family_id", familyId),
    supabase.from("accounts").select("*").eq("family_id", familyId),
    supabase.from("categories").select("*").eq("family_id", familyId),
    supabase.from("recurring_rules").select("*").eq("family_id", familyId),
    supabase.from("transactions").select("*").eq("family_id", familyId),
    supabase.from("properties").select("*").eq("family_id", familyId),
    supabase.from("loans").select("*").eq("family_id", familyId),
    supabase.from("bes_accounts").select("*").eq("family_id", familyId),
    supabase
      .from("bes_contributions")
      .select("*, bes_accounts!inner(family_id)")
      .eq("bes_accounts.family_id", familyId),
    supabase.from("bank_statement_uploads").select("*").eq("family_id", familyId),
    supabase.from("zakat_calculations").select("*").eq("family_id", familyId),
    supabase
      .from("zakat_calculation_items")
      .select("*, zakat_calculations!inner(family_id)")
      .eq("zakat_calculations.family_id", familyId),
    supabase.from("budgets").select("*").eq("family_id", familyId),
    supabase.from("asset_holdings").select("*").eq("family_id", familyId),
    supabase
      .from("asset_transactions")
      .select("*, asset_holdings!inner(family_id)")
      .eq("asset_holdings.family_id", familyId),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    family: family.data,
    members: members.data,
    accounts: accounts.data,
    categories: categories.data,
    recurring_rules: recurringRules.data,
    transactions: transactions.data,
    properties: properties.data,
    loans: loans.data,
    bes_accounts: besAccounts.data,
    bes_contributions: besContributions.data,
    bank_statement_uploads: bankStatementUploads.data,
    zakat_calculations: zakatCalculations.data,
    zakat_calculation_items: zakatItems.data,
    budgets: budgets.data,
    asset_holdings: assetHoldings.data,
    asset_transactions: assetTransactions.data,
  };

  const fileName = `aile-finans-disa-aktarim-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
