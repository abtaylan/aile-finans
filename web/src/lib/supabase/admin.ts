import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role (admin) Supabase istemcisi.
 *
 * SADECE sunucu tarafında (Server Actions/Route Handlers) kullanılmalı.
 * `server-only` importu bu dosyanın yanlışlıkla client bundle'a
 * dahil edilmesini build-time'da engeller.
 *
 * Kullanım alanları:
 * - Aile içi yönetim (src/app/(app)/aile/actions.ts): rol atama ve üye
 *   çıkarma, yetki kontrolü YAPILDIKTAN SONRA RLS'i bilinçli olarak
 *   bypass ederek uygulanıyor (`guard_user_privileged_fields` trigger'ı
 *   role/family_id/is_active değişikliklerini yalnızca service_role'e
 *   izin veriyor — bkz. database/schema_v2_rls.sql).
 *
 * Yerelde çalıştırmak için `.env.local`'e Supabase Dashboard >
 * Project Settings > API sayfasındaki "service_role" gizli anahtarını
 * `SUPABASE_SERVICE_ROLE_KEY` olarak eklemek gerekir (bkz. env.example).
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
