"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDeviceTrusted, markDeviceTrusted, startOtpStep } from "@/lib/auth/two-factor";
import type { SupabaseClient } from "@supabase/supabase-js";

export type LoginState = {
  step: "password" | "otp";
  email: string;
  error: string | null;
  info: string | null;
};

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// Test/demo amaçlı sabit OTP. YALNIZCA bu belirli test e-postası için
// geçerlidir; gerçek kullanıcı hesapları hiçbir şekilde etkilenmez.
// ailefinans.app henüz gerçek bir domain olmadığı için Supabase bu
// adrese OTP e-postası gönderemiyor (invalid email hatası) — bu
// bypass, satın alınmış bir domain ile gerçek SMTP kurulana kadar
// geçici bir test kolaylığıdır.
const TEST_BYPASS_EMAIL = "test@ailefinans.app";
const TEST_BYPASS_CODE = "123456";

/**
* Giriş tamamlandıktan (şifre + gerekiyorsa OTP) sonra ortak yönlendirme:
* profili yoksa onboarding'e, varsa ana sayfaya.
*/
async function afterLoginRedirect(supabase: SupabaseClient): Promise<never> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

if (user) {
  const { data: profile } = await supabase
  .from("users")
  .select("id")
  .eq("id", user.id)
  .maybeSingle();

  if (!profile) {
    redirect("/onboarding");
  }
}

redirect("/");
}

/**
* Adım 1: e-posta + şifre.
* Cihaz daha önce OTP ile doğrulanıp güvenilir işaretlenmişse doğrudan
* içeri alınır. Değilse şifreyle kurulan oturum kapatılır ve OTP adımına
* geçilir (bkz. src/lib/auth/two-factor.ts).
*/
export async function signInAction(
  _prevState: LoginState,
  formData: FormData
  ): Promise<LoginState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

if (!isEmail(email) || !password) {
  return { step: "password", email, error: "Geçerli bir e-posta ve şifre gir.", info: null };
}

const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

if (error || !data.user) {
  return { step: "password", email, error: "E-posta veya şifre hatalı.", info: null };
}

if (await isDeviceTrusted(supabase, data.user.id)) {
  await afterLoginRedirect(supabase);
}

if (email === TEST_BYPASS_EMAIL) {
  await supabase.auth.signOut();
  return {
    step: "otp",
    email,
    error: null,
    info: "Test hesabı: sabit doğrulama kodunu gir.",
  };
}

const { error: otpError } = await startOtpStep(supabase, email);
  if (otpError) {
    return {
      step: "password",
      email,
      error: `Doğrulama kodu gönderilemedi: ${otpError.message}`,
      info: null,
    };
  }

return {
  step: "otp",
  email,
  error: null,
  info: "Yeni bir cihazdasın. E-postana gönderdiğimiz 6 haneli kodu gir.",
};
}

/**
* Adım 2: OTP kodu. Başarılıysa bu cihaz güvenilir işaretlenir, bir
* sonraki girişte (30 gün içinde) tekrar kod istenmez.
*/
export async function verifyLoginOtpAction(
  prevState: LoginState,
  formData: FormData
  ): Promise<LoginState> {
  const email = String(formData.get("email") || prevState.email || "").trim().toLowerCase();
  const code = String(formData.get("code") || "").trim();

if (!email) {
  return { step: "password", email: "", error: "Önce e-posta ve şifreni gir.", info: null };
}
  if (!code) {
    return { step: "otp", email, error: "Kodu gir.", info: null };
  }

const supabase = await createClient();

if (email === TEST_BYPASS_EMAIL && code === TEST_BYPASS_CODE) {
  const admin = createAdminClient();
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const hashedToken = linkData?.properties?.hashed_token;
  if (linkError || !hashedToken) {
    return { step: "otp", email, error: "Test girişi başarısız.", info: null };
  }

  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: hashedToken,
  });
  if (verifyError || !verifyData.user) {
    return { step: "otp", email, error: "Test girişi başarısız.", info: null };
  }

  await markDeviceTrusted(supabase, verifyData.user.id);
  await afterLoginRedirect(supabase);
}

const { data, error } = await supabase.auth.verifyOtp({
  email,
  token: code,
  type: "email",
});

if (error || !data.user) {
  return { step: "otp", email, error: "Kod hatalı veya süresi dolmuş.", info: null };
}

await markDeviceTrusted(supabase, data.user.id);
  await afterLoginRedirect(supabase);
  // afterLoginRedirect her zaman redirect() ile fırlatır, buraya hiç
// ulaşılmaz — ama TS (async fonksiyon + Promise<never> zinciri
// üzerinden) bunu tüm yollarda ulaşılamaz olarak tanımıyor, derleme
// "fonksiyonun return'ü eksik" diye hata veriyordu (Vercel build'inde
// görüldü). Bu satır yalnızca tip kontrolünü memnun ediyor.
return { step: "otp", email, error: null, info: null };
}

export async function resetLoginStepAction(): Promise<LoginState> {
  return { step: "password", email: "", error: null, info: null };
}
