"use server";

import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/site-url";

export type ForgotPasswordState = { error: string | null; info: string | null };

const GENERIC_INFO = "Bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.";

export async function requestPasswordResetAction(
  _prevState: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!email) {
    return { error: "E-posta adresini gir.", info: null };
  }

  const supabase = await createClient();
  const redirectTo = `${getSiteUrl()}/auth/confirm?next=${encodeURIComponent(
    "/sifre-sifirla/yeni"
  )}`;

  await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  // Hesap var mı yok mu bilgisini sızdırmamak için hata olsa da olmasa
  // da aynı genel mesaj döndürülür.
  return { error: null, info: GENERIC_INFO };
}
