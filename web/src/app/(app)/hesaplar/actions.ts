"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/auth-context";
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
    throw new Error("Geçersiz hesap bilgisi.");
  }

  const payload = {
    family_id: profile.family_id,
    owner_user_id: profile.id,
    name,
    bank_name: bankName || null,
    account_type: accountType,
    currency,
    iban: iban || null,
    current_balance: currentBalance,
    credit_limit: creditLimitRaw ? Number(creditLimitRaw) : null,
    color,
  };

  if (id) {
    const { error } = await supabase.from("accounts").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("accounts").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/hesaplar");
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
