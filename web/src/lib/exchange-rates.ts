import type { createClient } from "@/lib/supabase/server";

/**
 * Verilen doviz kodlari icin en guncel TCMB satis kurunu (TL karsiligi)
 * dondurur. `exchange_rates` tablosu bir worker/cron tarafindan
 * doldurulur (bkz. database/schema_v2_supabase.sql) - henuz veri
 * yoksa bos obje doner, cagiran taraf elle girilen/son maliyet
 * fiyatina duser (fallback).
 */
export async function getLatestSellingRates(
  supabase: Awaited<ReturnType<typeof createClient>>,
  currencyCodes: string[]
  ): Promise<Record<string, number>> {
  const uniqueCodes = [...new Set(currencyCodes)];
  if (uniqueCodes.length === 0) return {};

const { data } = await supabase
  .from("exchange_rates")
  .select("currency_code, selling_rate, rate_date")
  .in("currency_code", uniqueCodes)
  .eq("base_currency", "TRY")
  .order("rate_date", { ascending: false });

const rates: Record<string, number> = {};
  for (const row of data ?? []) {
    if (!(row.currency_code in rates)) {
      rates[row.currency_code] = Number(row.selling_rate);
    }
  }
  return rates;
}
