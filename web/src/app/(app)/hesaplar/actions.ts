"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/auth-context";
import { createCustomAsset } from "@/lib/custom-asset";
import { parseTLNumber } from "@/lib/utils";
import type { AccountType } from "@/lib/types/database";

const ACCOUNT_TYPES: AccountType[] = [
  "checking",
  "savings",
  "credit_card",
  "cash",
  "investment",
  "loan",
  ];

// Vadesiz Hesap (checking) ve Nakit (cash) icin, TL disinda secilebilen
// para birimi / kiymetli maden kodlari (Gereksinim v1, madde 9-10).
// XAU/XAG gram bazli altin/gumus icin kullaniliyor (bkz. lib/utils.ts).
const SELECTABLE_CURRENCIES = ["TRY", "USD", "EUR", "GBP", "XAU", "XAG"];
const MULTI_CURRENCY_TYPES: AccountType[] = ["checking", "cash"];

export async function upsertAccountAction(formData: FormData) {
  const { supabase, profile } = await requireFamilyContext();

const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const bankName = String(formData.get("bankName") || "").trim();
  const accountType = String(formData.get("accountType") || "checking") as AccountType;
  const iban = String(formData.get("iban") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const currentBalance = parseTLNumber(String(formData.get("currentBalance") || ""));
  const color = String(formData.get("color") || "#2a78d6").trim();

if (!name || !ACCOUNT_TYPES.includes(accountType)) {
  throw new Error("Gecersiz hesap bilgisi.");
}

// Para birimi: yalnizca Vadesiz Hesap / Nakit turlerinde secilebilir
// (Gereksinim v1, madde 9-10) - digerleri her zaman TRY.
let currency = "TRY";
if (MULTI_CURRENCY_TYPES.includes(accountType)) {
  const requested = String(formData.get("currency") || "TRY").trim().toUpperCase();
  currency = SELECTABLE_CURRENCIES.includes(requested) ? requested : "TRY";
}

// Kredi limiti yalnizca Kredi Karti hesaplarinda anlamli (Gereksinim v1,
// madde 5) - diger turlerde her zaman null olarak tutulur.
const creditLimitRaw = String(formData.get("creditLimit") || "").trim();
const creditLimit =
  accountType === "credit_card" && creditLimitRaw ? parseTLNumber(creditLimitRaw) : null;

// TL karsiligi yalnizca doviz/kiymetli maden bakiyesi olan hesaplarda
// anlamli (Gereksinim v1, madde 9-10) - kullanicinin bankasinin kendi
// kuruyla elle girdigi opsiyonel bir alan.
const tryEquivalentRaw = String(formData.get("tryEquivalentAmount") || "").trim();
const tryEquivalentAmount =
  MULTI_CURRENCY_TYPES.includes(accountType) && currency !== "TRY" && tryEquivalentRaw
    ? parseTLNumber(tryEquivalentRaw)
    : null;

const payload = {
  family_id: profile.family_id,
  owner_user_id: profile.id,
  name,
  bank_name: bankName || null,
  account_type: accountType,
  currency,
  iban: iban || null,
  notes: notes || null,
  current_balance: accountType === "investment" ? 0 : currentBalance,
  credit_limit: creditLimit,
  try_equivalent_amount: tryEquivalentAmount,
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
  const openingQuantity = parseTLNumber(String(formData.get("openingQuantity") || ""));
  const openingUnitPrice = parseTLNumber(String(formData.get("openingUnitPrice") || ""));
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
