"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/auth-context";
import type { LoanType, PropertyType } from "@/lib/types/database";

export async function upsertPropertyAction(formData: FormData) {
  const { supabase, profile } = await requireFamilyContext();
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const propertyType = String(formData.get("propertyType") || "ev") as PropertyType;
  const estimatedValue = Number(formData.get("estimatedValue") || 0);
  const isTradeIntent = formData.get("isTradeIntent") === "on";

  if (!name || estimatedValue < 0) throw new Error("Geçersiz gayrimenkul bilgisi.");

  const payload = {
    family_id: profile.family_id,
    name,
    property_type: propertyType,
    estimated_value: estimatedValue,
    is_trade_intent: isTradeIntent,
  };

  if (id) {
    const { error } = await supabase.from("properties").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("properties").insert(payload);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/zekat");
}

export async function deletePropertyAction(formData: FormData) {
  const { supabase } = await requireFamilyContext();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const { error } = await supabase.from("properties").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/zekat");
}

export async function upsertLoanAction(formData: FormData) {
  const { supabase, profile } = await requireFamilyContext();
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const loanType = String(formData.get("loanType") || "ihtiyac_kredisi") as LoanType;
  const totalRemaining = Number(formData.get("totalRemaining") || 0);
  const monthlyInstallment = Number(formData.get("monthlyInstallment") || 0);
  const startDate = String(formData.get("startDate") || "");
  const endDate = String(formData.get("endDate") || "");

  if (!name || !startDate || !endDate) throw new Error("Geçersiz kredi bilgisi.");

  const payload = {
    family_id: profile.family_id,
    name,
    loan_type: loanType,
    principal_amount: totalRemaining,
    total_remaining: totalRemaining,
    monthly_installment: monthlyInstallment,
    start_date: startDate,
    end_date: endDate,
  };

  if (id) {
    const { error } = await supabase.from("loans").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("loans").insert(payload);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/zekat");
}

export async function deleteLoanAction(formData: FormData) {
  const { supabase } = await requireFamilyContext();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const { error } = await supabase.from("loans").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/zekat");
}
