"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/auth-context";
import type { TransactionType } from "@/lib/types/database";

export async function upsertTransactionAction(formData: FormData) {
  const { supabase, profile } = await requireFamilyContext();

  const id = String(formData.get("id") || "").trim();
  const accountId = String(formData.get("accountId") || "").trim();
  const categoryId = String(formData.get("categoryId") || "").trim();
  const type = String(formData.get("type") || "expense") as TransactionType;
  const amount = Number(formData.get("amount") || 0);
  const description = String(formData.get("description") || "").trim();
  const transactionDate = String(formData.get("transactionDate") || "");

  if (!accountId || !categoryId || amount <= 0 || !transactionDate) {
    throw new Error("Tüm zorunlu alanları doldurmalısın.");
  }

  const payload = {
    family_id: profile.family_id,
    account_id: accountId,
    category_id: categoryId,
    created_by_user_id: profile.id,
    type,
    amount,
    amount_base_currency: amount,
    description: description || null,
    transaction_date: transactionDate,
  };

  if (id) {
    const { error } = await supabase.from("transactions").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("transactions").insert(payload);
    if (error) throw new Error(error.message);
  }

  // current_balance önbelleğini güncelle: gelir hesaba eklenir, gider düşülür.
  const sign = type === "income" ? 1 : type === "expense" ? -1 : 0;
  if (sign !== 0 && !id) {
    const { data: account } = await supabase
      .from("accounts")
      .select("current_balance")
      .eq("id", accountId)
      .single();
    if (account) {
      await supabase
        .from("accounts")
        .update({ current_balance: Number(account.current_balance) + sign * amount })
        .eq("id", accountId);
    }
  }

  revalidatePath("/butce");
  revalidatePath("/");
  revalidatePath("/hesaplar");
}

export async function deleteTransactionAction(formData: FormData) {
  const { supabase } = await requireFamilyContext();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/butce");
  revalidatePath("/");
  revalidatePath("/hesaplar");
}
