import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

// accounts.currency alaninda gercek ISO 4217 para birimlerinin yaninda
// (TRY/USD/EUR/GBP) gram bazli degerli maden "para birimleri" de tutulabilir
// (XAU = altin, XAG = gumus - ISO 4217'de kiymetli maden kodlari, ama biz
// ons yerine gram cinsinden kullaniyoruz). Intl.NumberFormat bu kodlari
// "para birimi" gibi bicimlendirmeye calisip yanlis anlama yol acabildigi
// icin bu iki kod icin ozel, gram etiketli bir gosterim kullaniyoruz.
const PRECIOUS_METAL_LABELS: Record<string, string> = {
  XAU: "gr Altın",
  XAG: "gr Gümüş",
};

export function isPreciousMetalCurrency(currency: string): boolean {
  return currency in PRECIOUS_METAL_LABELS;
}

/** Hesaplar listesinde bir hesabin tutarini para birimine gore bicimlendirir. */
export function formatAccountAmount(amount: number, currency: string) {
  if (isPreciousMetalCurrency(currency)) {
    const number = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 }).format(amount);
    return `${number} ${PRECIOUS_METAL_LABELS[currency]}`;
  }
  return formatCurrency(amount, currency);
}

/**
 * Kullanicinin Turkce sayi bicimiyle (binlik ayiraci nokta, ondalik ayiraci
 * virgul - orn. "100.000,50") yazdigi bir metni sayiya cevirir. Bos veya
 * gecersiz girdide 0 doner. `<input type="number">` kullanmiyoruz cunku o,
 * yerel ayardan bagimsiz olarak yalnizca "." ondalik ayiraci kabul ediyor ve
 * "100.000" gibi bir girdiyi "100" olarak yorumluyor.
 */
export function parseTLNumber(input: string | null | undefined): number {
  if (!input) return 0;
  const trimmed = input.trim();
  if (!trimmed) return 0;
  // Sadece rakam, nokta, virgul ve basta eksi isaretine izin ver.
  const cleaned = trimmed.replace(/[^0-9.,-]/g, "");
  if (!cleaned) return 0;
  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

/** Bir sayiyi duzenleme formunda gostermek icin Turkce bicimde yazar. */
export function formatNumberForInput(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "";
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 8 }).format(num);
}

/**
 * Bir hesabin bakiyesini TL karsiligi olarak dondurur - toplam varlik /
 * zekat gibi TUM hesaplarin toplandigi yerlerde current_balance'i DOGRUDAN
 * toplamamak icin kullanilmali: Vadesiz/Nakit hesaplar artik TRY disinda
 * bir para biriminde de tutulabiliyor (Gereksinim v1, madde 9-10), o yuzden
 * ham current_balance'i baska bir doviz/kiymetli maden hesabinin TRY
 * bakiyesiyle toplamak yanlis sonuc verir.
 * - TRY hesap: current_balance oldugu gibi.
 * - Doviz/kiymetli maden hesabi + kullanici TL karsiligini girdiyse: o deger.
 * - Doviz/kiymetli maden hesabi ama TL karsiligi girilmediyse: 0 (toplama
 *   dahil edilmez - yanlis bir TL miktari uydurmaktansa boylesi daha guvenli).
 */
export function accountValueInTry(account: {
  currency: string;
  current_balance: number;
  try_equivalent_amount: number | null;
}): number {
  if (account.currency === "TRY") return Number(account.current_balance);
  return account.try_equivalent_amount != null ? Number(account.try_equivalent_amount) : 0;
}
