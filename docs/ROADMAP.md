# Aile Finans ve Varlık Yönetimi — Yol Haritası

MVP sonrası kalan işlerin, önceliğe göre sıralanmış özeti. Sıralama Claude'un
değerlendirmesi; itiraz edilirse değiştirilir. Canlı: aile-finans-mu.vercel.app
(Web MVP yayında, test aşaması — 2026-08-24 itibarıyla).

Detaylı, görsel versiyon: https://claude.ai/code/artifact/41c85b40-4927-46ff-92b9-e6f1e556ea43

---

## Şimdi (sıradaki)

Test sırasında fark edilen somut boşluklar — günlük kullanımı engelleyen eksikler.
Sıradaki: #2 (aile içi yönetim).

### 1. Profil / Hesap Ayarları sayfası — ✅ tamamlandı (2026-08-24)
- Yeni rota: `/profil` — ad soyad, e-posta (salt okunur), dil/locale güncelleme
- Aile bilgisi: aile adı düzenleme, aile üyelerinin listesi (salt okunur — üye
  ekleme/çıkarma/rol atama #2'de)
- Oturum yönetimi: bu cihazdan çıkış + tüm cihazlardan çıkış (Supabase
  `signOut({ scope })`; ayrı bir "aktif cihazlar" tablosu yok, bu yeterli)
- Üst barda ad-soyad artık `/profil`'e bağlı bir link (`app-shell.tsx`)

### 2. Aile içi yönetim (üyeler, roller, kategoriler)
`users.role` (owner/admin/member/viewer) şemada tanımlı ama hiçbir yerde
kontrol edilmiyor. Platform süper-admin'den ayrı: bu, her ailenin kendi
self-servis ayarları.
- Aile üyesi davet etme / çıkarma, rol atama
- Kategori yönetimi (ekle/sil/yeniden adlandır)
- Rol bazlı yetki kontrolü (viewer düzenleyemesin vb.)
- Aile silme / dışa aktarma

### 3. Kredi kartı ekstresi girişi
`bank_statement_uploads` tablosu şemada var ama hiçbir UI kullanmıyor.
- 1. adım: manuel ekstre kalemi girişi (tarih, açıklama, tutar, taksit)
- 2. adım: ekstre dönemi özeti (asgari tutar, son ödeme tarihi) Hesaplar'da göster
- 3. adım (büyük iş): PDF/CSV ekstre yükleyip otomatik satır ayrıştırma

### 4. Elle açık/koyu tema anahtarı
Koyu tema CSS'i tamamen hazır ama tetikleyecek arayüz yok.
- Üst barda güneş/ay ikonlu anahtar
- Seçimi `data-theme` + localStorage ile kalıcı yap

---

## Prod'a çıkmadan önce zorunlu

Test aşamasında olduğu gibi kalabilir (kullanıcının talimatıyla) — gerçek
kullanıcılar öncesinde mutlaka bitmeli.

### 5. OTP test kısayolunu kapat, kalıcı kimlik doğrulamaya geç
`test@ailefinans.app` + `123456` admin-bypass'ı sadece test için.
- Şifre + OTP veya güçlü e-posta OTP + "güvenilir cihaz" — test sonunda karar
- `TEST_OTP_EMAIL`/`TEST_OTP_CODE` env değişkenlerini prod'dan kaldır
- Şifre unuttum / e-posta değiştirme akışları (şifre eklenirse)

### 6. Güvenlik sertleştirme (Supabase advisor uyarıları)
- `citext` uzantısını public şemadan ayrı şemaya taşı
- `current_family_id()` RPC'sinin `authenticated` rolünce çağrılabilirliğini gözden geçir
- Supabase Auth "sızmış şifre" korumasını aç (şifre eklenirse)

### 7. Gerçek e-posta altyapısı
Supabase'in yerleşik e-posta gönderimi saatte birkaç mesajla sınırlı.
- Özel SMTP sağlayıcı bağla (Resend / Postmark / SES)
- Gönderen alan adını doğrula (SPF/DKIM)

---

## Orta vade (özellik tamamlama)

Şemada karşılığı olup arayüzü hiç yapılmamış bölümler.

### 8. BES (Bireysel Emeklilik) hesapları
`bes_accounts`/`bes_contributions`/`bes_fund_prices` tabloları var, Portföy
sayfası hiç kullanmıyor.
- BES hesabı ekle/düzenle (kurum, fon dağılımı, devlet katkısı)
- Aylık katkı payı girişi ve birikim grafiği

### 9. Tekrarlayan işlemler
`recurring_rules` tablosu var, UI'ı yok.
- Bütçe sayfasına "tekrarlayan" seçeneği
- Vadesi gelen tekrarları otomatik işlem olarak oluşturma

### 10. Kredi ↔ hesap bağlama, zekât geçmişi, bütçe hedefleri
- `loans.linked_account_id` formda yok — krediyi hesaba bağla
- Zekât hesaplamaları `zakat_calculations`'a kaydedilmiyor — geçmiş yıl karşılaştırması yok
- `budgets` tablosu hiç kullanılmıyor — kategori bazlı aylık hedef/limit yok

---

## Uzun vade (büyük kapsam)

Orijinal mimaride planlanmış, bilinçli olarak Web MVP kapsamı dışında bırakılmış işler.

### 11. Fiyat otomasyonu ve portföy geçmişi
- TCMB döviz kurları günlük otomatik çekme
- TEFAS fon fiyatları günlük otomatik çekme
- Günlük `portfolio_history` anlık görüntüsü + net değer grafiği

### 12. FIFO maliyet motoru
Python'da tam FIFO motoru zaten yazılı (`backend/app/services/cost_basis_engine.py`).
- Motoru TypeScript'e taşı veya Supabase Edge Function olarak servis et
- Portföy sayfasına FIFO/ağırlıklı ortalama seçimi ekle

### 13. Zekât: otomatik havl (354 gün) takibi
- Varlık/hesap bazında "nisabın üzerine çıkış tarihi" takibi
- Kameri takvim hesaplaması (~354 gün) ile otomatik hatırlatma

### 14. Platform süper-admin paneli (çoklu kiracı)
Netleştirilen karar: ileride birden fazla aileyi/kiracıyı barındıracak, hepsini
tek yerden yönetebilecek ayrı bir yönetim katmanı — aile içi ayarlardan (#2)
tamamen farklı, kendi mimarisi gereken bağımsız bir bölüm.
- Ayrı süper-admin rolü/tablosu (herhangi bir `families.id`'ye bağlı olmayan)
- Ayrı giriş rotası (`/admin/giris`) ve daha sıkı kimlik doğrulama
- Kiracı (aile) listesi: arama, kayıt tarihi, aktiflik durumu, kullanım metrikleri
- Aile askıya alma / yeniden etkinleştirme / silme
- Destek amaçlı "olarak görüntüle" (impersonation) — sıkı loglama ile
- Platform geneli audit log görüntüleyici (`audit_logs` tablosu var, kullanılmıyor)
- İleride ücretlendirme planlanıyorsa abonelik/plan yönetimi için yer tutucu

> **Mimari ön koşul:** Mevcut RLS modeli "bir kullanıcı = bir ailenin üyesi"
> varsayımıyla kuruldu. Süper-admin'in tüm ailelerin verisini görebilmesi için
> ayrı bir yetkilendirme yolu gerekiyor (servis rolü ile sınırlı sunucu
> action'ları, RLS'i client'tan asla bypass etmeden). Bunu #5 (kimlik
> doğrulama sertleştirme) ile birlikte tasarlamak daha sağlıklı olur.

### 15. Backend servisi, özel domain, mobil uygulamalar
Orijinal planın geri kalanı — Web MVP kararıyla bilinçli ertelendi.
- FastAPI + Celery + Redis (Railway) — worker işleri Edge Functions'a mı taşınacak, karar bekliyor
- Özel alan adı satın alma (ödeme onayı gerektirir)
- iOS/Android uygulamaları (React Native / Expo)

---

*Hazırlayan: Claude · Kaynak: kod denetimi + test geri bildirimleri*
