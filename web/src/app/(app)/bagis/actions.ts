"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/auth-context";
import type { DonationType } from "@/lib/types/database";

export async function upsertDonationAction(formData: FormData) {
  const { supabase, profile } = await requireFamilyContext();
  const id = String(formData.get("id") || "").trim();
  const recipient = String(formData.get("recipient") || "").trim();
  const donationType = String(formData.get("donationType") || "sadaka") as DonationType;
  const amount = Number(formData.get("amount") || 0);
  const donationDate = String(formData.get("donationDate") || "");
  const description = String(formData.get("description") || "").trim();
  const countsTowardZakat = formData.get("countsTowardZakat") === "on";

if (!recipient || !donationDate || amount <= 0) {
  throw new Error("Gecersiz bagis/sadaka bilgisi.");
}

const payload = {
  family_id: profile.family_id,
  donation_type: donationType,
  recipient,
  description: description || null,
  amount,
  donation_date: donationDate,
  counts_toward_zakat: countsTowardZakat,
  created_by_user_id: profile.id,
};

if (id) {
  const { error } = await supabase.from("donations").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
} else {
  const { error } = await supabase.from("donations").insert(payload);
  if (error) throw new Error(error.message);
}
  revalidatePath("/bagis");
  revalidatePath("/zekat");
}

export async function deleteDonationAction(formData: FormData) {
  const { supabase } = await requireFamilyContext();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const { error } = await supabase.from("donations").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/bagis");
  revalidatePath("/zekat");
}
