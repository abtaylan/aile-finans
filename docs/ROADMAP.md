# Aile Finans ve Varlık Yönetimi — Yol Haritası

MVP sonrası kalan işlerin, önceliğe göre sıralanmış özeti. Sıralama Claude'un
değerlendirmesi; itiraz edilirse değiştirilir. Canlı: aile-finans-mu.vercel.app
(Web MVP yayında, test aşaması — 2026-08-24 itibarıyla).

Detaylı, görsel versiyon: https://claude.ai/code/artifact/41c85b40-4927-46ff-92b9-e6f1e556ea43

## Ortam

Yeni bir sohbette klasör bağlantısı sıfırdan başladığı ve bu bilgiler bu
dosyada geçmediği için buraya not edildi — yeni sohbete ayrıca elle
yazmaya gerek yok:

- Repo yolu: `C:\Users\ytt\OneDrive\Masaüstü\PROJELER\Aile Finans Yönetimi\aile-finans`
  (klasör bağlantısını yeni sohbette onaylaman gerekir — masaüstü uygulaması sorar)
- Canlı: aile-finans-mu.vercel.app
- Test hesabı: `test@ailefinans.app` / `123456`
- Supabase projesi (`aile-finans`, ref `ejcjwlubpwvppxmypvxq`) MCP üzerinden
  otomatik bulunuyor, ayrıca belirtmeye gerek yok.
- **Git**: Claude'un cihazda shell erişimi yok — sadece dosya okuyup/yazabiliyor
  (device bridge ile) ve Supabase migration'ı MCP ile uygulayabiliyor. Kod
  değişikliği yapılan HER oturumun sonunda, kullanıcı istemeden bile, çalıştırılacak
  `git add / commit / push` komutları eksiksiz verilmeli (kopyala-yapıştır
  hazır, repo yolunu içeren `cd` dahil) — bu adım daha önce birkaç kez
  atlandı, bir daha atlanmasın.

---

## Şimdi (sıradaki)

Test sırasında fark edilen somut boşluklar — günlük kullanımı engelleyen eksikler.
"Şimdi" bölümündeki tüm işler tamamlandı. Sıradaki: #5 (OTP test kısayolunu
kapat, kalıcı kimlik doğrulamaya geç — "Prod'a çıkmadan önce zorunlu" bölümü).

### 1. Profil / Hesap Ayarları sayfası — ✅ tamamlandı (2026-08-24)
- Yeni rota: `/profil` — ad soyad, e-posta (salt okunur), dil/locale güncelleme
- Aile bilgisi: aile adı düzenleme (artık owner/admin ile sınırlı, bkz. #2),
  üye sayısı özeti + `/aile` sayfasına link
- Oturum yönetimi: bu cihazdan çıkış + tüm cihazlardan çıkış (Supabase
  `signOut({ scope })`; ayrı bir "aktif cihazlar" tablosu yok, bu yeterli)
- Üst barda ad-soyad artık `/profil`'e bağlı bir link (`app-shell.tsx`)

### 2. Aile içi yönetim (üyeler, roller, kategoriler) — ✅ tamamlandı (2026-08-24)
Yeni rota: `/aile`. `users.role` artık gerçekten kontrol ediliyor.
- **Üye davet etme**: owner/admin e-posta + rol (admin/member/viewer) girip
  davet oluşturur (`family_invites` tablosu). Gerçek SMTP altyapısı henüz
  yok (#7) — otomatik e-posta GÖNDERİLMİYOR; davet linki (`/davet/[token]`)
  panoya kopyalanıp elle paylaşılıyor. Kişi o e-postayla giriş yaptığında
  (OTP ile hesap otomatik açılır) onboarding'de bekleyen davet otomatik
  kabul edilir (`accept_my_pending_invite()` RPC, e-posta eşleşmesiyle).
- **Üye çıkarma**: `admin.auth.admin.deleteUser()` ile auth hesabı silinir
  (public.users satırı CASCADE ile gider, diğer tablolardaki referanslar
  SET NULL ile korunur). Son owner çıkarılamaz; admin, owner/admin'i
  çıkaramaz.
- **Rol atama**: owner her rolü değiştirebilir; admin sadece member/viewer
  arasında değiştirebilir. `users.role/family_id/is_active` alanları artık
  bir DB trigger'ıyla korunuyor (`guard_user_privileged_fields`) — normal
  istemci bu alanları asla doğrudan UPDATE edemez, yalnızca service-role
  (yetki kontrolünden SONRA, sunucu action'larında) değiştirebilir.
- **Kategori yönetimi**: ekle/yeniden adlandır/sil, owner/admin ile sınırlı
  (RLS + action seviyesinde çift kontrol).
- **Rol bazlı yetki kontrolü**: kategori CRUD ve aile ayarları (isim
  değişikliği) RLS'te owner/admin'e kilitlendi. Not: bu kısıtlama şu an
  yalnızca üye/rol/kategori/aile-ayarları kapsamında — hesaplar,
  işlemler, bütçe, portföy gibi diğer modüllerde viewer/member ayrımı
  henüz yok (kapsamlı bir "salt okunur viewer" politikası ayrı bir iş
  olarak ele alınmalı, aşağıya *16* olarak eklendi).
- **Aile silme / dışa aktarma**: owner, ailenin adını yazarak onaylayıp
  kalıcı silebilir (CASCADE ile tüm veriler gider, diğer üyelerin
  auth hesapları etkilenmez — bir sonraki girişte onboarding'e düşerler).
  owner/admin `/aile/disa-aktar`'dan tüm aile verisini JSON olarak indirebilir.

### 3. Kredi kartı ekstresi girişi — 1. ve 2. adım ✅ tamamlandı (2026-08-24)
`bank_statement_uploads` tablosu şemada vardı ama hiçbir UI kullanmıyordu.
Manuel giriş için aynı tablo (+ `bank_statement_staging_transactions`)
genişletildi — adım 3 (aşağıda) geldiğinde ayrıştırma sonucu çıkan satırlar
da aynı "onay → gerçek transactions kaydı" akışından geçecek.
- Yeni rota: `/hesaplar/[id]/ekstre` — yalnızca `credit_card` tipi hesaplarda
  görünür (Hesaplar'daki hesap kartında "Ekstreler" butonu).
- **Ekstre dönemi**: ay, asgari ödeme tutarı, son ödeme tarihi, (opsiyonel)
  toplam ekstre tutarı — `bank_statement_uploads`'a yeni sütunlar eklendi
  (`source`, `minimum_payment_amount`, `payment_due_date`,
  `statement_total_amount`; `file_name`/`storage_path`/`file_type` artık
  yalnızca `source='upload'` için zorunlu — CHECK constraint ile).
- **Ekstre kalemi girişi**: tarih, açıklama, tutar, taksit etiketi (ör.
  "3/6" — otomatik ay bölme yapılmıyor, ekstredeki gibi o ayki tutar
  girilir). `bank_statement_staging_transactions`'a `installment_label`
  sütunu eklendi. Her kalem eklendiğinde otomatik olarak gerçek bir
  `transactions` kaydı oluşturuluyor ve hesabın `current_balance`'ı
  güncelleniyor (Bütçe'deki gider/gelir mantığıyla aynı işaret kuralı);
  ekstre veya kalem silindiğinde bağlı transaction da silinip bakiye
  tersine çevriliyor.
- **Hesaplar'da özet** (2. adım): kredi kartı hesap kartında en güncel
  ekstrenin asgari ödeme tutarı + son ödeme tarihi gösteriliyor.
- 3. adım (PDF/CSV otomatik ayrıştırma, büyük iş) bilinçli olarak
  ertelendi — aşağıya *17* olarak eklendi.

### 4. Elle açık/koyu tema anahtarı — ✅ tamamlandı (2026-08-24)
Koyu tema CSS'i zaten hazırdı, tetikleyecek arayüz eklendi.
- Üst barda güneş/ay ikonlu anahtar (`ThemeToggle`, `src/components/theme-toggle.tsx`),
  `app-shell.tsx` üst çubuğunda profil linkinin solunda.
- Seçim `<html data-theme>` attribute'u + `localStorage` (`theme` anahtarı,
  `"light"`/`"dark"`) ile kalıcı. `globals.css`'teki mevcut üç katmanlı kural
  (açık varsayılan, `prefers-color-scheme: dark` sistem tercihi, açık
  `data-theme` override'ı) hiç değiştirilmedi — anahtar sadece bu attribute'u
  set ediyor.
- İlk boyamadan önce flash olmaması için `layout.tsx`'in `<head>`'ine inline
  script eklendi (kayıtlı tercihi localStorage'dan okuyup `data-theme`'i
  React hydrate olmadan önce set ediyor — Next'in "preventing flash before
  hydration" rehberindeki örüntü). `<html>`'e `suppressHydrationWarning`
  eklendi çünkü script DOM'u React'ten önce değiştirebiliyor.
- Güneş/ay ikonu geçişi tamamen CSS ile (`.theme-toggle-sun`/`.theme-toggle-moon`,
  `globals.css`) — React state'e bağlı değil, bu yüzden hydration uyuşmazlığı
  riski yok; tıklama sadece `data-theme` attribute'unu ve localStorage'ı
  güncelliyor, CSS geri kalanını hallediyor.
- Kayıtlı tercih yoksa (ilk ziyaret) attribute set edilmiyor — sistem/tarayıcı
  tercihi (`prefers-color-scheme`) geçerli oluyor, tıpkı öncesinde olduğu gibi.

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
- `current_family_id()` (ve #2 ile eklenen `current_user_role()`,
  `get_invite_preview()`, `accept_my_pending_invite()`) RPC'lerinin
  `authenticated`/`anon` rolünce çağrılabilirliğini gözden geçir —
  şu an hepsi bilinçli olarak `current_family_id()` ile aynı örüntüde
  (fonksiyon içi kontrolle güvenli, ama advisor'da WARN görünüyorlar)
- Supabase Auth "sızmış şifre" korumasını aç (şifre eklenirse)

### 7. Gerçek e-posta altyapısı
Supabase'in yerleşik e-posta gönderimi saatte birkaç mesajla sınırlı.
Bu yüzden #2'deki aile daveti şu an e-posta GÖNDERMİYOR, link kopyala/
paylaş şeklinde çalışıyor — bu altyapı kurulunca otomatik davet e-postası
gönderimi eklenebilir.
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

### 16. Genel "salt okunur viewer" politikası
#2 kapsamında viewer/member ayrımı yalnızca üye/rol/kategori/aile-ayarları
için uygulandı. Hesaplar, işlemler, bütçe, portföy, zekât gibi diğer
modüllerde henüz herkes (viewer dahil) yazabiliyor. Bunu tek bir tutarlı
politika olarak (RLS + UI) tüm modüllere yaymak ayrı, dikkatli bir iş —
her modülün action'ları ayrı ayrı gözden geçirilmeli.

### 17. Kredi kartı ekstresi: PDF/CSV otomatik ayrıştırma
#3'ün ertelenen 3. adımı. Manuel giriş (1+2, tamamlandı) zaten aynı
tabloları kullanıyor — bu iş yalnızca `bank_statement_uploads` (source=
'upload') + `bank_statement_staging_transactions`'ı bir ayrıştırma
motoruyla doldurup kullanıcıya onay ekranı sunmak.
- Dosya yükleme (Supabase Storage'a) + `file_type`'a göre PDF/CSV ayrıştırma
- Aday satırları `bank_statement_staging_transactions`'a yaz, kategori
  öner (`suggested_category_id`)
- Onay ekranı: kullanıcı satır satır onaylar/düzenler/reddeder —
  onaylananlar manuel akıştaki `addStatementItemAction` ile aynı şekilde
  gerçek `transactions` kaydına dönüşür

---

*Hazırlayan: Claude · Kaynak: kod denetimi + test geri bildirimleri*
