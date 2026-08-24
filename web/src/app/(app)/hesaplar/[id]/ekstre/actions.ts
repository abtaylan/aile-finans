"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/auth-context";
import type { TransactionType } from "@/lib/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof requireFamilyContext>>["supabase"];

function lastDayOfMonth(periodMonth: string) {
  // periodMonth: "YYYY-MM"
  const [year, month] = periodMonth.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0));
  return last.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------
// Ekstre (dönem) — başlık bilgisi: asgari ödeme, son ödeme tarihi
// ---------------------------------------------------------------------
export async function upsertStatementAction(formData: FormData) {
  const { supabase, profile } = await requireFamilyContext();

  const id = String(formData.get("id") || "").trim();
  const accountId = String(formData.get("accountId") || "").trim();
  const periodMonth = String(formData.get("periodMonth") || "").trim();
  const minimumPaymentRaw = String(formData.get("minimumPaymentAmount") || "").trim();
  const paymentDueDate = String(formData.get("paymentDueDate") || "").trim();
  const statementTotalRaw = String(formData.get("statementTotalAmount") || "").trim();

  if (!accountId || !periodMonth) {
    throw new Error("Hesap ve dönem seçimi zorunlu.");
  }

  const { data: account } = await supabase
    .from("accounts")
    .select("id, account_type")
    .eq("id", accountId)
    .eq("family_id", profile.family_id)
    .maybeSingle();
  if (!account || account.account_type !== "credit_card") {
    throw new Error("Ekstre yalnızca kredi kartı hesapları için girilebilir.");
  }

  const payload = {
    family_id: profile.family_id,
    account_id: accountId,
    uploaded_by_user_id: profile.id,
    source: "manual" as const,
    status: "completed" as const,
    period_start: `${periodMonth}-01`,
    period_end: lastDayOfMonth(periodMonth),
    minimum_payment_amount: minimumPaymentRaw ? Number(minimumPaymentRaw) : null,
    payment_due_date: paymentDueDate || null,
    statement_total_amount: statementTotalRaw ? Number(statementTotalRaw) : null,
  };

  if (id) {
    const { error } = await supabase
      .from("bank_statement_uploads")
      .update(payload)
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("bank_statement_uploads").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath(`/hesaplar/${accountId}/ekstre`);
  revalidatePath("/hesaplar");
  revalidatePath("/");
}

export async function deleteStatementAction(formData: FormData) {
  const { supabase } = await requireFamilyContext();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const { data: statement } = await supabase
    .from("bank_statement_uploads")
    .select("id, account_id")
    .eq("id", id)
    .maybeSingle();
  if (!statement) return;

  await reverseAndDeleteMatchedTransactions(supabase, id, statement.account_id);

  const { error } = await supabase.from("bank_statement_uploads").delete().eq("id", id);
  if (error) throw new Error(error.message);

  if (statement.account_id) revalidatePath(`/hesaplar/${statement.account_id}/ekstre`);
  revalidatePath("/hesaplar");
  revalidatePath("/butce");
  revalidatePath("/");
}

// ---------------------------------------------------------------------
// Ekstre kalemleri — tarih, açıklama, tutar, taksit
// ---------------------------------------------------------------------
export async function addStatementItemAction(formData: FormData) {
  const { supabase, profile } = await requireFamilyContext();

  const uploadId = String(formData.get("uploadId") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const transactionDate = String(formData.get("transactionDate") || "").trim();
  const amount = Number(formData.get("amount") || 0);
  const direction = String(formData.get("direction") || "expense") as TransactionType;
  const installmentLabel = String(formData.get("installmentLabel") || "").trim();

  if (!uploadId || !description || !transactionDate || amount <= 0) {
    throw new Error("Tarih, açıklama ve tutar zorunlu.");
  }
  if (direction !== "income" && direction !== "expense") {
    throw new Error("Geçersiz kalem türü.");
  }

  const { data: statement } = await supabase
    .from("bank_statement_uploads")
    .select("id, account_id")
    .eq("id", uploadId)
    .maybeSingle();
  if (!statement || !statement.account_id) {
    throw new Error("Ekstre bulunamadı.");
  }

  const { data: staging, error: stagingError } = await supabase
    .from("bank_statement_staging_transactions")
    .insert({
      upload_id: uploadId,
      raw_description: description,
      transaction_date: transactionDate,
      amount,
      direction,
      installment_label: installmentLabel || null,
      is_confirmed: true,
    })
    .select("id")
    .single();
  if (stagingError) throw new Error(stagingError.message);

  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .insert({
      family_id: profile.family_id,
      account_id: statement.account_id,
      category_id: null,
      created_by_user_id: profile.id,
      type: direction,
      amount,
      amount_base_currency: amount,
      description,
      transaction_date: transactionDate,
    })
    .select("id")
    .single();
  if (txError) throw new Error(txError.message);

  await supabase
    .from("bank_statement_staging_transactions")
    .update({ matched_transaction_id: transaction.id })
    .eq("id", staging.id);

  await adjustAccountBalance(supabase, statement.account_id, direction, amount);

  revalidatePath(`/hesaplar/${statement.account_id}/ekstre`);
  revalidatePath("/hesaplar");
  revalidatePath("/butce");
  revalidatePath("/");
}

export async function deleteStatementItemAction(formData: FormData) {
  const { supabase } = await requireFamilyContext();
  const id = String(formData.get("id") || "");
  if (!id) return;

  const { data: item } = await supabase
    .from("bank_statement_staging_transactions")
    .select("id, upload_id, matched_transaction_id, amount, direction")
    .eq("id", id)
    .maybeSingle();
  if (!item) return;

  const { data: statement } = await supabase
    .from("bank_statement_uploads")
    .select("account_id")
    .eq("id", item.upload_id)
    .maybeSingle();

  if (item.matched_transaction_id) {
    await supabase.from("transactions").delete().eq("id", item.matched_transaction_id);
    if (statement?.account_id) {
      // Ters işlem: gider iade edilir (+), gelir geri alınır (-).
      const reverseDirection = item.direction === "expense" ? "income" : "expense";
      await adjustAccountBalance(
        supabase,
        statement.account_id,
        reverseDirection as TransactionType,
        Number(item.amount)
      );
    }
  }

  const { error } = await supabase
    .from("bank_statement_staging_transactions")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (statement?.account_id) revalidatePath(`/hesaplar/${statement.account_id}/ekstre`);
  revalidatePath("/hesaplar");
  revalidatePath("/butce");
  revalidatePath("/");
}

// ---------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------
async function adjustAccountBalance(
  supabase: SupabaseServerClient,
  accountId: string,
  type: TransactionType,
  amount: number
) {
  const sign = type === "income" ? 1 : type === "expense" ? -1 : 0;
  if (sign === 0) return;
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

async function reverseAndDeleteMatchedTransactions(
  supabase: SupabaseServerClient,
  uploadId: string,
  accountId: string | null
) {
  const { data: items } = await supabase
    .from("bank_statement_staging_transactions")
    .select("matched_transaction_id, amount, direction")
    .eq("upload_id", uploadId)
    .not("matched_transaction_id", "is", null);

  if (!items || items.length === 0) return;

  if (accountId) {
    let delta = 0;
    for (const item of items) {
      const sign = item.direction === "income" ? 1 : item.direction === "expense" ? -1 : 0;
      delta -= sign * Number(item.amount); // ters çevir
    }
    if (delta !== 0) {
      const { data: account } = await supabase
        .from("accounts")
        .select("current_balance")
        .eq("id", accountId)
        .single();
      if (account) {
        await supabase
          .from("accounts")
          .update({ current_balance: Number(account.current_balance) + delta })
          .eq("id", accountId);
      }
    }
  }

  const txIds = items
    .map((i: { matched_transaction_id: string | null }) => i.matched_transaction_id)
    .filter((v: string | null): v is string => Boolean(v));
  if (txIds.length > 0) {
    await supabase.from("transactions").delete().in("id", txIds);
  }
}
