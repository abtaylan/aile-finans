import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

function slugify(input: string): string {
  return input
  .toUpperCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^A-Z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .slice(0, 40);
}

/**
 * Portfoyde hazir bir karsiligi olmayan varliklar icin ("Diger" secenegi)
 * paylasimli `assets` tablosuna yeni bir kayit acar. Bu tablo RLS ile
 * normal kullanici yazisina kapali (bkz. database/schema_v2_rls.sql:
 * "yalnizca service_role yazabilir"), bu yuzden admin istemcisi kullanilir
 * - yalnizca sunucu tarafinda (Server Action) cagrilmali.
 */
export async function createCustomAsset(name: string, unit = "adet"): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Varlik adi bos olamaz.");

const admin = createAdminClient();
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  const symbol = `OTHER_${slugify(trimmed)}_${suffix}`;

const { data, error } = await admin
  .from("assets")
  .insert({
    asset_type: "other",
    symbol,
    name: trimmed,
    unit,
    quote_currency: "TRY",
  })
  .select("id")
  .single();

if (error) throw new Error(error.message);
  return data.id as string;
}
