// Kuveyt Algoritmasi ile Miladi <-> Hicri tarih donusumu.
// Dis paket bagimliligi yok; ~1 gune kadar sapma olabilir (tablo bazli
// yaklasik takvim), resmi Diyanet/Umm-ul Kura takvimiyle nadiren 1 gun
// farkedebilir. Zekat gibi kritik dini kararlarda kesin tarih icin
// Diyanet'in yayinladigi hicri takvimle teyit onerilir.

const HIJRI_MONTHS = [
  "Muharrem",
  "Safer",
  "Rebiulevvel",
  "Rebiulahir",
  "Cemaziyelevvel",
  "Cemaziyelahir",
  "Recep",
  "Saban",
  "Ramazan",
  "Sevval",
  "Zilkade",
  "Zilhicce",
  ] as const;

export interface HijriDate {
  year: number;
  month: number;
  day: number;
}

export interface GregorianDate {
  year: number;
  month: number;
  day: number;
}

function gregorianToJdn(g: GregorianDate): number {
  const a = Math.floor((14 - g.month) / 12);
  const y = g.year + 4800 - a;
  const m = g.month + 12 * a - 3;
  return (
    g.day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
    );
}

function jdnToGregorian(jdnInput: number): GregorianDate {
  const J = Math.floor(jdnInput + 0.5);
  const f = J + 1401 + (Math.floor((4 * J + 274277) / 146097) * 3) / 4 - 38;
  const fFloor = Math.floor(f);
  const e = 4 * fFloor + 3;
  const g = Math.floor((e % 1461) / 4);
  const h = 5 * g + 2;
  const day = Math.floor((h % 153) / 5) + 1;
  const month = ((Math.floor(h / 153) + 2) % 12) + 1;
  const year = Math.floor(e / 1461) - 4716 + Math.floor((14 - month) / 12);
  return { year, month, day };
}

function jdnToHijri(jdnInput: number): HijriDate {
  let jd = Math.floor(jdnInput) - 1948440 + 10632;
  const n = Math.floor((jd - 1) / 10631);
  jd = jd - 10631 * n + 354;
  const j =
    Math.floor((10985 - jd) / 5316) * Math.floor((50 * jd) / 17719) +
    Math.floor(jd / 5670) * Math.floor((43 * jd) / 15238);
  jd =
    jd -
    Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
    Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
    29;
  const month = Math.floor((24 * jd) / 709);
  const day = jd - Math.floor((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

function hijriToJdn(h: HijriDate): number {
  return (
    Math.floor((11 * h.year + 3) / 30) +
    354 * h.year +
    30 * h.month -
    Math.floor((h.month - 1) / 2) +
    h.day +
    1948440 -
    385
    );
}

function parseIsoDate(iso: string): GregorianDate {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y, month: m, day: d };
}

export function gregorianToHijri(isoDate: string): HijriDate {
  return jdnToHijri(gregorianToJdn(parseIsoDate(isoDate)));
}

export function formatHijri(h: HijriDate): string {
  return `${h.day} ${HIJRI_MONTHS[h.month - 1]} ${h.year}`;
}

export function hijriDateLabel(isoDate: string): string {
  return formatHijri(gregorianToHijri(isoDate));
}

export function isHawlComplete(hawlStartIso: string, asOfIso: string): boolean {
  return hawlCompletionDate(hawlStartIso) <= asOfIso;
}

export function hawlCompletionDate(hawlStartIso: string): string {
  const startHijri = gregorianToHijri(hawlStartIso);
  const completionJdn = hijriToJdn({ ...startHijri, year: startHijri.year + 1 });
  const g = jdnToGregorian(completionJdn);
  return `${g.year.toString().padStart(4, "0")}-${g.month.toString().padStart(2, "0")}-${g.day
                                                                                         .toString()
                                                                                         .padStart(2, "0")}`;
}

export function daysUntilHawlCompletion(hawlStartIso: string, asOfIso: string): number {
  const completion = new Date(hawlCompletionDate(hawlStartIso));
  const asOf = new Date(asOfIso);
  return Math.round((completion.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24));
}
