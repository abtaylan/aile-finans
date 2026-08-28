/**
 * Şifre sıfırlama gibi e-posta bağlantılarında kullanılan mutlak site
 * adresi. Prod'da Vercel ortam değişkenlerine `NEXT_PUBLIC_SITE_URL`
 * olarak eklenmeli (bkz. env.example) — canlı adres: aile-finans-mu.vercel.app.
 * Yerelde .env.local'deki değer (varsayılan: localhost:3000) kullanılır.
 */
export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  return (configured || "http://localhost:3000").replace(/\/$/, "");
}
