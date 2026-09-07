// Bilinen Turkiye banka/kurum listesi - Hesap Ekle/Duzenle formunda combobox
// icin, ve hesap listesinde kucuk bir "logo" rozeti gostermek icin kullanilir.
// Gercek marka logolarini kopyalamiyoruz; her kurum icin kisa bir kisaltma +
// marka rengine yakin bir rozet renginden olusan basit bir isaret uretiyoruz.

export interface BankOption {
  name: string;
  abbr: string;
  color: string;
}

export const TURKISH_BANKS: BankOption[] = [
  { name: "Ziraat Bankası", abbr: "ZB", color: "#e53935" },
  { name: "Türkiye İş Bankası", abbr: "İB", color: "#0d3b74" },
  { name: "Garanti BBVA", abbr: "GB", color: "#00854a" },
  { name: "Akbank", abbr: "AK", color: "#e4032e" },
  { name: "Yapı Kredi", abbr: "YK", color: "#004b93" },
  { name: "QNB Finansbank", abbr: "QNB", color: "#5c2d91" },
  { name: "DenizBank", abbr: "DB", color: "#0072ce" },
  { name: "TEB", abbr: "TEB", color: "#00a19a" },
  { name: "Halkbank", abbr: "HB", color: "#004b8d" },
  { name: "VakıfBank", abbr: "VB", color: "#c99a00" },
  { name: "Kuveyt Türk", abbr: "KT", color: "#00a651" },
  { name: "Albaraka Türk", abbr: "AT", color: "#00693e" },
  { name: "Türkiye Finans", abbr: "TF", color: "#7ac142" },
  { name: "Ziraat Katılım", abbr: "ZK", color: "#8c1d40" },
  { name: "Vakıf Katılım", abbr: "VK", color: "#b5890a" },
  { name: "ING Bank", abbr: "ING", color: "#ff6200" },
  { name: "HSBC", abbr: "HSBC", color: "#db0011" },
  { name: "Fibabanka", abbr: "FB", color: "#652d90" },
  { name: "Odeabank", abbr: "OB", color: "#e07000" },
  { name: "Şekerbank", abbr: "ŞB", color: "#5b9b1f" },
  { name: "Alternatifbank", abbr: "ALT", color: "#00539f" },
  { name: "Anadolubank", abbr: "AB", color: "#7a1f1f" },
  { name: "Enpara.com", abbr: "EN", color: "#6a1b9a" },
  { name: "Papara", abbr: "PP", color: "#7a1fa2" },
];

const OTHER_PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#4a3aa7"];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function initialsFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Verilen banka/kurum adina gore rozet bilgisi dondurur. Bilinen bir banka
 * ise sabit kisaltma + marka rengi; degilse (kullanicinin "Diger" ile elle
 * girdigi bir kurum: Ev, Yurtdisi, Arkadasta emanet vb.) isimden turetilmis
 * baslangic harfleri + sabit bir paletten secilen tutarli bir renk.
 */
export function getBankBadge(bankName: string | null | undefined): BankOption | null {
  if (!bankName || !bankName.trim()) return null;
  const trimmed = bankName.trim();
  const known = TURKISH_BANKS.find(
    (b) => b.name.localeCompare(trimmed, "tr", { sensitivity: "base" }) === 0
  );
  if (known) return known;
  const color = OTHER_PALETTE[hashString(trimmed) % OTHER_PALETTE.length];
  return { name: trimmed, abbr: initialsFromName(trimmed), color };
}
