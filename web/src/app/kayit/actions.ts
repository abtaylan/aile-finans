"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signUpAction(
  _prevState: { error: string | null; info: string | null },
  formData: FormData
): Promise<{ error: string | null; info: string | null }> {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const fullName = String(formData.get("fullName") || "").trim();

  if (!email || !password || !fullName) {
    return { error: "Tüm alanları doldurman gerekiyor.", info: null };
  }
  if (password.length < 8) {
    return { error: "Şifre en az 8 karakter olmalı.", info: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    return { error: `Kayıt başarısız: ${error.message}`, info: null };
  }

  if (data.session) {
    // E-posta doğrulaması kapalı / otomatik onaylı — direkt onboarding'e geç.
    redirect("/onboarding");
  }

  return {
    error: null,
    info: "Kayıt alındı! E-postana gönderilen bağlantıyla hesabını onayladıktan sonra giriş yapabilirsin.",
  };
}
