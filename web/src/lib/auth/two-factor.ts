import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Şifre + e-posta OTP ikinci faktör akışı için ortak yardımcılar.
 * Bkz. ROADMAP.md #5, database/ trusted_devices tablosu (migration:
 * trusted_devices_for_otp_2fa).
 *
 * Akış özeti:
 * 1) `signInWithPassword` / `signUp` ile şifre doğrulanır (bu adım her
 *    zaman geçerli bir Supabase oturumu kurar).
 * 2) `isDeviceTrusted` bu cihazın daha önce OTP ile doğrulanıp
 *    doğrulanmadığını kontrol eder. Doğrulanmışsa oturum olduğu gibi
 *    kalır.
 * 3) Doğrulanmamışsa `startOtpStep` az önce kurulan oturumu KAPATIR
 *    (ikinci faktör tamamlanana kadar hesaba erişim verilmez) ve
 *    e-postaya yeni bir OTP kodu gönderir.
 * 4) Kod doğrulandığında (`verifyOtp`) `markDeviceTrusted` bu cihaza
 *    httpOnly bir cookie yazar ve hash'ini trusted_devices'a kaydeder.
 */

export const DEVICE_COOKIE_NAME = "af_device";
export const TRUSTED_DEVICE_DAYS = 30;

function deviceCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function hashDeviceToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Adım 2 (OTP) doğrulaması başarılı olduğunda çağrılır: bu cihazı
 * TRUSTED_DEVICE_DAYS gün boyunca güvenilir işaretler.
 */
export async function markDeviceTrusted(supabase: SupabaseClient, userId: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashDeviceToken(token);
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000);

  const { error } = await supabase.from("trusted_devices").insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    // Cihaz güveni kaydedilemezse akışı bloklamaya değmez — kullanıcı
    // girişini tamamlar, bir sonraki seferde tekrar OTP görür.
    console.error("trusted_devices insert başarısız:", error.message);
    return;
  }

  const cookieStore = await cookies();
  cookieStore.set(
    DEVICE_COOKIE_NAME,
    token,
    deviceCookieOptions(TRUSTED_DEVICE_DAYS * 24 * 60 * 60)
  );
}

/**
 * Bu cihaz, verilen kullanıcı için daha önce OTP ile doğrulanmış ve
 * süresi dolmamış mı? Doğrulanmışsa "sliding window": expires_at'i
 * (ve cookie'nin ömrünü) şimdiden itibaren yeniden 30 güne ileri alır.
 */
export async function isDeviceTrusted(supabase: SupabaseClient, userId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(DEVICE_COOKIE_NAME)?.value;
  if (!token) return false;

  const tokenHash = hashDeviceToken(token);
  const { data } = await supabase
    .from("trusted_devices")
    .select("id, expires_at")
    .eq("user_id", userId)
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!data || new Date(data.expires_at).getTime() < Date.now()) {
    return false;
  }

  const newExpiresAt = new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000);
  await supabase
    .from("trusted_devices")
    .update({
      last_seen_at: new Date().toISOString(),
      expires_at: newExpiresAt.toISOString(),
    })
    .eq("id", data.id);

  cookieStore.set(
    DEVICE_COOKIE_NAME,
    token,
    deviceCookieOptions(TRUSTED_DEVICE_DAYS * 24 * 60 * 60)
  );

  return true;
}

/**
 * Şifre doğru ama cihaz güvenilir değilse çağrılır: az önce şifreyle
 * kurulan oturumu kapatır ve e-postaya yeni bir OTP kodu gönderir.
 * `shouldCreateUser: false` — bu adım yalnızca zaten var olan bir hesap
 * için ikinci faktördür, yeni kullanıcı oluşturmaz.
 */
export async function startOtpStep(supabase: SupabaseClient, email: string) {
  await supabase.auth.signOut();
  return supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
}

/**
 * Cihaz güven cookie'sini temizler (sunucu tarafı state'i, ör.
 * trusted_devices satırı, ayrıca silinmelidir — bkz. profil çıkış
 * action'ları).
 */
export async function clearDeviceCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(DEVICE_COOKIE_NAME);
}

export async function getDeviceTokenHash(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(DEVICE_COOKIE_NAME)?.value;
  return token ? hashDeviceToken(token) : null;
}
