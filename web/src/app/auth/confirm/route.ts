import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * E-posta bağlantılarını (şu an yalnızca şifre sıfırlama, type=recovery)
 * bir Supabase oturumuna çeviren ortak uç nokta. Supabase Dashboard >
 * Authentication > Email Templates > "Reset Password" şablonundaki
 * bağlantı şu formatta olmalı:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
 * (Bu, dashboard'dan elle yapılması gereken tek adım — Claude'un buraya
 * erişimi yok.)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") || "/";

  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");
  redirectTo.searchParams.delete("next");

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  const errorRedirect = request.nextUrl.clone();
  errorRedirect.pathname = "/sifre-sifirla";
  errorRedirect.search = "";
  errorRedirect.searchParams.set("error", "link_suresi_dolmus");
  return NextResponse.redirect(errorRedirect);
}
