"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createFamilyAction(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const familyName = String(formData.get("familyName") || "").trim();
  const fullName = String(formData.get("fullName") || "").trim();

  if (!familyName || !fullName) {
    return { error: "Aile adı ve ad soyad gerekli." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Oturum bulunamadı, lütfen tekrar giriş yap." };
  }

  const { data: family, error: familyError } = await supabase
    .from("families")
    .insert({ name: familyName })
    .select("id")
    .single();

  if (familyError || !family) {
    return { error: `Aile oluşturulamadı: ${familyError?.message ?? "bilinmeyen hata"}` };
  }

  const { error: profileError } = await supabase.from("users").insert({
    id: user.id,
    family_id: family.id,
    email: user.email,
    full_name: fullName,
    role: "owner",
  });

  if (profileError) {
    return { error: `Profil oluşturulamadı: ${profileError.message}` };
  }

  const defaultCategories = [
    { name: "Maaş", type: "income", color: "#1baf7a" },
    { name: "Kira Geliri", type: "income", color: "#008300" },
    { name: "Diğer Gelir", type: "income", color: "#4a3aa7" },
    { name: "Market / Gıda", type: "expense", color: "#eb6834" },
    { name: "Kira / Konut", type: "expense", color: "#eda100" },
    { name: "Ulaşım", type: "expense", color: "#e87ba4" },
    { name: "Faturalar", type: "expense", color: "#e34948" },
    { name: "Sağlık", type: "expense", color: "#2a78d6" },
    { name: "Eğlence", type: "expense", color: "#4a3aa7" },
    { name: "Diğer Gider", type: "expense", color: "#898781" },
  ];
  await supabase
    .from("categories")
    .insert(defaultCategories.map((c) => ({ ...c, family_id: family.id })));

  redirect("/");
}
