import { requireFamilyContext } from "@/lib/auth-context";
import { ZekatClient } from "./zekat-client";
import type { Account, Asset, AssetHolding, Loan, Property, ZakatPayment } from "@/lib/types/database";

const FALLBACK_GOLD_PRICE = 4200;

export default async function ZekatPage() {
const { supabase, profile } = await requireFamilyContext();

const [
{ data: accounts },
{ data: holdings },
{ data: assets },
{ data: properties },
{ data: loans },
{ data: family },
{ data: payments },
] = await Promise.all([
supabase.from("accounts").select("*").eq("family_id", profile.family_id).eq("is_active", true),
supabase.from("asset_holdings").select("*").eq("family_id", profile.family_id).gt("quantity", 0),
supabase.from("assets").select("*"),
supabase.from("properties").select("*").eq("family_id", profile.family_id),
supabase.from("loans").select("*").eq("family_id", profile.family_id).eq("is_active", true),
supabase.from("families").select("zakat_hawl_start_date").eq("id", profile.family_id).single(),
supabase
.from("zakat_payments")
.select("*")
.eq("family_id", profile.family_id)
.order("payment_date", { ascending: false }),
]);

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

const goldAsset = (assets ?? []).find((a) => a.symbol === "GRAM_ALTIN");
const goldPricePerGram = goldAsset ? latestPrices[goldAsset.id] ?? FALLBACK_GOLD_PRICE : FALLBACK_GOLD_PRICE;

return (
<ZekatClient
accounts={(accounts as Account[]) ?? []}
holdings={(holdings as AssetHolding[]) ?? []}
assets={(assets as Asset[]) ?? []}
latestPrices={latestPrices}
properties={(properties as Property[]) ?? []}
loans={(loans as Loan[]) ?? []}
goldPricePerGram={goldPricePerGram}
hawlStartDate={(family?.zakat_hawl_start_date as string | null) ?? null}
payments={(payments as ZakatPayment[]) ?? []}
/>
);
}
