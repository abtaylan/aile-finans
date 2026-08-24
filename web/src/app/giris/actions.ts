"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type OtpState = {
  step: "email" | "code";
  email: string;
  error: string | null;
  info: string | null;
};

const TEST_OTP_EMAIL = (process.env.TEST_OTP_EMAIL || "test@ailefinans.app").toLowerCase();
const TEST_OTP_CODE = process.env.TEST_OTP_CODE || "123456";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Adım 1: E-posta gir, kod gönder.
 * Test hesabı için gerçek e-posta gönderimi atlanır (limitleri boşuna
 * tüketmemek için) — doğrudan kod giriş adımına geçilir.
 */
export async function sendOtpAction(
  _prevState: OtpState,
  formData: FormData
): Promise<OtpState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!isEmail(email)) {
    return { step: "email", email: "", error: "Geçerli bir e-posta adresi gir.", info: null };
  }

  if (email === TEST_OTP_EMAIL) {
    return {
      step: "code",
      email,
      error: null,
      info: "Test hesabı: sana gönderilen kod yerine test kodunu kullanabilirsin.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    return { step: "email", email: "", error: `Kod gönderilemedi: ${error.message}`, info: null };
  }

  return {
    step: "code",
    email,
    error: null,
    info: "E-postana 6 haneli bir kod gönderdik.",
  };
}

/**
 * Adım 2: Kodu doğrula.
 * Test hesabı + test kodu eşleşirse, gerçek e-posta gönderimine
 * gerek kalmadan admin API ile geçerli bir Supabase oturumu kurulur.
 * Diğer tüm hesaplar normal `verifyOtp` akışından geçer.
 */
export async function verifyOtpAction(
  prevState: OtpState,
  formData: FormData
): Promise<OtpState> {
  const email = String(formData.get("email") || prevState.email || "").trim().toLowerCase();
  const code = String(formData.get("code") || "").trim();

  if (!email) {
    return { step: "email", email: "", error: "Önce e-posta adresini gir.", info: null };
  }
  if (!code) {
    return { step: "code", email, error: "Kodu gir.", info: null };
  }

  const supabase = await createClient();

  if (email === TEST_OTP_EMAIL && code === TEST_OTP_CODE) {
    let hashedToken: string | undefined;
    try {
      const admin = createAdminClient();
      const { data, error } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      if (error || !data?.properties?.hashed_token) {
        return {
          step: "code",
          email,
          error: `Test girişi başarısız: ${error?.message ?? "token oluşturulamadı"}`,
          info: null,
        };
      }
      hashedToken = data.properties.hashed_token;
    } catch (e) {
      return {
        step: "code",
        email,
        error: `Test girişi yapılandırılmamış: ${e instanceof Error ? e.message : "bilinmeyen hata"}`,
        info: null,
      };
    }

    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: hashedToken,
      type: "magiclink",
    });

    if (verifyError) {
      return { step: "code", email, error: `Test girişi başarısız: ${verifyError.message}`, info: null };
    }
  } else {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (error) {
      return { step: "code", email, error: "Kod hatalı veya süresi dolmuş.", info: null };
    }
  }

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

export async function resetOtpStepAction(): Promise<OtpState> {
  return { step: "email", email: "", error: null, info: null };
}
