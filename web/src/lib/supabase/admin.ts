import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role (admin) Supabase istemcisi.
 *
 * SADECE sunucu tarafında (Server Actions/Route Handlers) kullanılmalı.
 * `server-only` importu bu dosyanın yanlışlıkla client bundle'a
 * dahil edilmesini build-time'da engeller.
 *
 * Şu an tek kullanım amacı: test hesabı için OTP kod gönderimini
 * atlayıp (`123456` girildiğinde) admin API ile gerçek bir Supabase
 * oturumu oluşturmak. Gerçek kullanıcılar bu istemciyi hiç tetiklemez.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY tanımlı değil — admin istemcisi oluşturulamaz."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
