import { requireFamilyContext } from "@/lib/auth-context";
import { PortfolioClient } from "./portfolio-client";
import type { Account, Asset, AssetHolding, AssetTransaction } from "@/lib/types/database";

export default async function PortfoyPage() {
  const { supabase, profile } = await requireFamilyContext();

  const [{ data: holdings }, { data: assets }, { data: accounts }] = await Promise.all([
    supabase
      .from("asset_holdings")
      .select("*")
      .eq("family_id", profile.family_id)
      .gt("quantity", 0),
    supabase.from("assets").select("*").eq("is_active", true).order("name"),
    supabase
      .from("accounts")
      .select("*")
      .eq("family_id", profile.family_id)
      .eq("is_active", true),
  ]);

  const holdingIds = (holdings ?? []).map((h) => h.id);
  const { data: transactions } = holdingIds.length
    ? await supabase
        .from("asset_transactions")
        .select("*")
        .in("holding_id", holdingIds)
        .order("transaction_date", { ascending: false })
    : { data: [] };

  const assetIds = (assets ?? []).map((a) => a.id);
  const latestPrices: Record<string, number> = {};
  if (assetIds.length) {
    const { data: prices } = await supabase
      .from("asset_price_history")
      .select("asset_id, price, price_date")
      .in("asset_id", assetIds)
      .order("price_date", { ascending: false });
    for (const p of prices ?? []) {
      if (!(p.asset_id in latestPrices)) {
        latestPrices[p.asset_id] = Number(p.price);
      }
    }
  }

  return (
    <PortfolioClient
      assets={(assets as Asset[]) ?? []}
      accounts={(accounts as Account[]) ?? []}
      holdings={(holdings as AssetHolding[]) ?? []}
      transactions={(transactions as AssetTransaction[]) ?? []}
      latestPrices={latestPrices}
    />
  );
}
