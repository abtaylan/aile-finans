"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/auth-context";

const LOCALES = ["tr-TR", "en-US"];

export async function updateProfileAction(formData: FormData) {
  const { supabase, profile } = await requireFamilyContext();

  const fullName = String(formData.get("fullName") || "").trim();
  const locale = String(formData.get("locale") || "tr-TR").trim();

  if (!fullName) {
    throw new Error("Ad soyad boş olamaz.");
  }
  if (!LOCALES.includes(locale)) {
    throw new Error("Geçersiz dil seçimi.");
  }

  const { error } = await supabase
    .from("users")
    .update({ full_name: fullName, locale })
    .eq("id", profile.id);

  if (error) throw new Error(error.message);

  revalidatePath("/profil");
  revalidatePath("/", "layout");
}

export async function updateFamilyAction(formData: FormData) {
  const { supabase, profile } = await requireFamilyContext();

  if (profile.role !== "owner" && profile.role !== "admin") {
    throw new Error("Aile adını yalnızca sahip veya yöneticiler değiştirebilir.");
  }

  const name = String(formData.get("familyName") || "").trim();

  if (!name) {
    throw new Error("Aile adı boş olamaz.");
  }

  const { error } = await supabase
    .from("families")
    .update({ name })
    .eq("id", profile.family_id);

  if (error) throw new Error(error.message);

  revalidatePath("/profil");
}
