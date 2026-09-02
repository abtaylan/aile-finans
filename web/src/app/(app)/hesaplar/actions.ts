"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/auth-context";
import { createCustomAsset } from "@/lib/custom-asset";
import type { AccountType } from "@/lib/types/database";

const ACCOUNT_TYPES: AccountType[] = [
  "checking",
  "savings",
  "credit_card",
  "cash",
  "investment",
  "loan",
  ];

export async function upsertAccountAction(formData: FormData) {
  const { supabase, profile } = await requireFamilyContext();

const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const bankName = String(formData.get("bankName") || "").trim();
  const accountType = String(formData.get("accountType") || "checking") as AccountType;
  const currency = String(formData.get("currency") || "TRY").trim();
  const iban = String(formData.get("iban") || "").trim();
  const currentBalance = Number(formData.get("currentBalance") || 0);
  const creditLimitRaw = String(formData.get("creditLimit") || "").trim();
  const color = String(formData.get("color") || "#2a78d6").trim();

if (!name || !ACCOUNT_TYPES.includes(accountType)) {
  throw new Error("Gecersiz hesap bilgisi.");
}

const payload = {
  family_id: profile.family_id,
  owner_user_id: profile.id,
  name,
  bank_name: bankName || null,
  account_type: accountType,
  currency,
  iban: iban || null,
  current_balance: accountType === "investment" ? 0 : currentBalance,
  credit_limit: creditLimitRaw ? Number(creditLimitRaw) : null,
  color,
};

let accountId = id;
  if (id) {
    const { error } = await supabase.from("accounts").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data, error } = await supabase
    .from("accounts")
    .insert(payload)
    .select("id")
    .single();
    if (error) throw new Error(error.message);
    accountId = data.id;
  }

if (!id && accountType === "investment") {
  const openingQuantity = Number(formData.get("openingQuantity") || 0);
  const openingUnitPrice = Number(formData.get("openingUnitPrice") || 0);
  let assetId = String(formData.get("assetId") || "");
  const newAssetName = String(formData.get("newAssetName") || "").trim();

  if (openingQuantity > 0 && openingUnitPrice > 0) {
    if (!assetId && newAssetName) {
      assetId = await createCustomAsset(newAssetName);
    }
    if (assetId) {
      const totalCost = openingQuantity * openingUnitPrice;
      const { data: holding, error: holdingError } = await supabase
      .from("asset_holdings")
      .insert({
        family_id: profile.family_id,
        account_id: accountId,
        asset_id: assetId,
        cost_method: "weighted_average",
        quantity: openingQuantity,
        average_unit_cost: openingUnitPrice,
        total_cost_basis: totalCost,
      })
      .select("id")
      .single();
      if (holdingError) throw new Error(holdingError.message);

    const { error: txError } = await supabase.from("asset_transactions").insert({
      holding_id: holding.id,
      account_id: accountId,
      asset_id: assetId,
      transaction_type: "buy",
      quantity: openingQuantity,
      unit_price: openingUnitPrice,
      remaining_quantity: openingQuantity,
      transaction_date: new Date().toISOString().slice(0, 10),
      notes: "Hesap acilisinda girilen ilk pozisyon",
    });
      if (txError) throw new Error(txError.message);
    }
  }
}

revalidatePath("/hesaplar");
  revalidatePath("/portfoy");
  revalidatePath("/");
}

export async function deleteAccountAction(formData: FormData) {
  const { supabase } = await requireFamilyContext();
  const id = String(formData.get("id") || "");
  if (!id) return;

const { error } = await supabase.from("accounts").delete().eq("id", id);
  if (error) throw new Error(error.message);

revalidatePath("/hesaplar");
  revalidatePath("/");
}
