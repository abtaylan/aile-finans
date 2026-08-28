"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { startOtpStep } from "@/lib/auth/two-factor";

export async function signUpAction(
  _prevState: { error: string | null; info: string | null },
  formData: FormData
): Promise<{ error: string | null; info: string | null }> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
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

  if (!data.session) {
    // E-posta doğrulaması dashboard'dan açılırsa Supabase burada session
    // döndürmez, kullanıcı önce onay linkine tıklamalı.
    return {
      error: null,
      info: "Kayıt alındı! E-postana gönderilen bağlantıyla hesabını onayladıktan sonra giriş yapabilirsin.",
    };
  }

  // E-posta doğrulaması kapalı / otomatik onaylı: şifreyle hemen bir
  // oturum açılıyor. Ama bu e-postanın gerçekten sahibi olduğunu henüz
  // kimse kanıtlamadı — o yüzden şifre girişindeki "yeni cihaz" akışıyla
  // aynı şekilde davranıyoruz: oturumu kapat, OTP kodu gönder, /giris'teki
  // kod adımına yönlendir. Kod doğrulanınca bu cihaz güvenilir işaretlenir
  // (bkz. src/lib/auth/two-factor.ts, src/app/giris/actions.ts).
  const { error: otpError } = await startOtpStep(supabase, email);
  if (otpError) {
    return {
      error: null,
      info: `Hesabın oluşturuldu ama doğrulama kodu gönderilemedi (${otpError.message}). /giris sayfasından tekrar dene.`,
    };
  }

  redirect(`/giris?email=${encodeURIComponent(email)}&step=otp`);
}
