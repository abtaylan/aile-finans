"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/auth-context";
import type { LoanType } from "@/lib/types/database";

export async function upsertDebtAction(formData: FormData) {
  const { supabase, profile } = await requireFamilyContext();
  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const loanType = String(formData.get("loanType") || "ihtiyac_kredisi") as LoanType;
  const lenderName = String(formData.get("lenderName") || "").trim();
  const principalAmount = Number(formData.get("principalAmount") || 0);
  const totalRemaining = Number(formData.get("totalRemaining") || 0);
  const monthlyInstallment = Number(formData.get("monthlyInstallment") || 0);
  const startDate = String(formData.get("startDate") || "");
  const endDate = String(formData.get("endDate") || "");
  const notes = String(formData.get("notes") || "").trim();
  const isActive = formData.get("isActive") === "on";

if (!name || !startDate || !endDate || totalRemaining < 0) {
  throw new Error("Gecersiz borc bilgisi.");
}

const payload = {
  family_id: profile.family_id,
  name,
  loan_type: loanType,
  lender_name: lenderName || null,
  principal_amount: principalAmount || totalRemaining,
  total_remaining: totalRemaining,
  monthly_installment: monthlyInstallment,
  start_date: startDate,
  end_date: endDate,
  notes: notes || null,
  is_active: isActive,
};

if (id) {
  const { error } = await supabase.from("loans").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
} else {
  const { error } = await supabase.from("loans").insert(payload);
  if (error) throw new Error(error.message);
}
  revalidatePath("/borclar");
  revalidatePath("/zekat");
}

export async function deleteDebtAction(formData: FormData) {
  const { supabase } = await requireFamilyContext();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const { error } = await supabase.from("loans").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/borclar");
  revalidatePath("/zekat");
}
