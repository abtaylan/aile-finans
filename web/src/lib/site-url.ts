/**
 * Şifre sıfırlama gibi e-posta bağlantılarında kullanılan mutlak site
 * adresi. Yalnızca sunucu tarafında (Server Actions) okunuyor — tarayıcıya
 * hiç gönderilmiyor, o yüzden bilinçli olarak `NEXT_PUBLIC_` öneki YOK
 * (Vercel'in "public prefix, browser'a sızar" uyarısı doğru tespit etti).
 * Prod'da Vercel ortam değişkenlerine `SITE_URL` olarak eklenmeli (bkz.
 * env.example) — canlı adres: aile-finans-mu.vercel.app. Yerelde
 * .env.local'deki değer (varsayılan: localhost:3000) kullanılır.
 */
export function getSiteUrl() {
  const configured = process.env.SITE_URL;
  return (configured || "http://localhost:3000").replace(/\/$/, "");
}
