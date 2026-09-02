"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/auth-context";
import { createCustomAsset } from "@/lib/custom-asset";

export async function buyAssetAction(formData: FormData) {
  const { supabase, profile } = await requireFamilyContext();

let assetId = String(formData.get("assetId") || "");
  const newAssetName = String(formData.get("newAssetName") || "").trim();
  const accountId = String(formData.get("accountId") || "");
  const quantity = Number(formData.get("quantity") || 0);
  const unitPrice = Number(formData.get("unitPrice") || 0);
  const transactionDate = String(formData.get("transactionDate") || "");
  const costMethod = String(formData.get("costMethod") || "weighted_average");

if (assetId === "__new__") {
  if (!newAssetName) throw new Error("Yeni varlik icin bir isim girmelisin.");
  assetId = await createCustomAsset(newAssetName);
}

if (!assetId || !accountId || quantity <= 0 || unitPrice <= 0 || !transactionDate) {
  throw new Error("Tum alanlari dogru doldurmalisin.");
}

let { data: holding } = await supabase
  .from("asset_holdings")
  .select("*")
  .eq("account_id", accountId)
  .eq("asset_id", assetId)
  .maybeSingle();

if (!holding) {
  const { data: created, error } = await supabase
  .from("asset_holdings")
  .insert({
    family_id: profile.family_id,
    account_id: accountId,
    asset_id: assetId,
    cost_method: costMethod,
    quantity: 0,
    average_unit_cost: 0,
    total_cost_basis: 0,
  })
  .select("*")
  .single();
  if (error) throw new Error(error.message);
  holding = created;
}

const newQuantity = Number(holding.quantity) + quantity;
  const newCostBasis = Number(holding.total_cost_basis) + quantity * unitPrice;
  const newAverageCost = newQuantity > 0 ? newCostBasis / newQuantity : 0;

const { error: updateError } = await supabase
  .from("asset_holdings")
  .update({
    quantity: newQuantity,
    total_cost_basis: newCostBasis,
    average_unit_cost: newAverageCost,
  })
  .eq("id", holding.id);
  if (updateError) throw new Error(updateError.message);

const { error: txError } = await supabase.from("asset_transactions").insert({
  holding_id: holding.id,
  account_id: accountId,
  asset_id: assetId,
  transaction_type: "buy",
  quantity,
  unit_price: unitPrice,
  remaining_quantity: quantity,
  transaction_date: transactionDate,
});
  if (txError) throw new Error(txError.message);

revalidatePath("/portfoy");
  revalidatePath("/");
}

export async function sellAssetAction(formData: FormData) {
  const { supabase } = await requireFamilyContext();

const holdingId = String(formData.get("holdingId") || "");
  const quantity = Number(formData.get("quantity") || 0);
  const unitPrice = Number(formData.get("unitPrice") || 0);
  const transactionDate = String(formData.get("transactionDate") || "");

const { data: holding } = await supabase
  .from("asset_holdings")
  .select("*")
  .eq("id", holdingId)
  .single();

if (!holding || quantity <= 0 || quantity > Number(holding.quantity)) {
  throw new Error("Gecersiz satis miktari.");
}

const newQuantity = Number(holding.quantity) - quantity;
  const releasedCost = Number(holding.average_unit_cost) * quantity;
  const newCostBasis = Number(holding.total_cost_basis) - releasedCost;

const { error: updateError } = await supabase
  .from("asset_holdings")
  .update({
    quantity: newQuantity,
    total_cost_basis: newQuantity > 0 ? newCostBasis : 0,
  })
  .eq("id", holdingId);
  if (updateError) throw new Error(updateError.message);

const { error: txError } = await supabase.from("asset_transactions").insert({
  holding_id: holdingId,
  account_id: holding.account_id,
  asset_id: holding.asset_id,
  transaction_type: "sell",
  quantity,
  unit_price: unitPrice,
  transaction_date: transactionDate,
  notes: `Gerceklesen K/Z: ${((unitPrice - Number(holding.average_unit_cost)) * quantity).toFixed(2)}`,
});
  if (txError) throw new Error(txError.message);

revalidatePath("/portfoy");
  revalidatePath("/");
}

export async function updatePriceAction(formData: FormData) {
  const { supabase } = await requireFamilyContext();
  const assetId = String(formData.get("assetId") || "");
  const price = Number(formData.get("price") || 0);
  if (!assetId || price <= 0) throw new Error("Gecersiz fiyat.");

const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase
  .from("asset_price_history")
  .upsert(
    { asset_id: assetId, price_date: today, price, source: "manual" },
    { onConflict: "asset_id,price_date" }
    );
  if (error) throw new Error(error.message);

revalidatePath("/portfoy");
}
