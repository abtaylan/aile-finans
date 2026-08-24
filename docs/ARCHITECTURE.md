# Aile Finans ve Varlık Yönetimi — Mimari Doküman v0.1

## 1. Genel Bakış

Sistem dört ana bileşenden oluşur: **API sunucusu** (FastAPI), **web istemcisi**
(Next.js), **background worker** (TCMB/TEFAS veri toplama + zamanlanmış işler)
ve **veri katmanı** (PostgreSQL + Redis). Worker ve API aynı kod tabanını
(monorepo, `backend/`) paylaşır; sadece giriş noktaları farklıdır.

```
                         ┌────────────────────┐
                         │   Next.js Web App   │
                         │ (Tailwind+shadcn/ui) │
                         └──────────┬──────────┘
                                    │ HTTPS / REST (+SSE gerekirse)
                                    ▼
                         ┌────────────────────┐
                         │   FastAPI (API)     │
                         │  Uvicorn/Gunicorn    │
                         └──────────┬──────────┘
                     ┌──────────────┼───────────────┐
                     ▼              ▼               ▼
              ┌───────────┐  ┌────────────┐  ┌─────────────┐
              │PostgreSQL │  │   Redis    │  │  Worker(s)   │
              │ (kaynak   │  │ (cache +   │  │ Celery/APS   │
              │  gerçek)  │  │  job queue)│  │ TCMB/TEFAS   │
              └───────────┘  └────────────┘  └──────┬───────┘
                                                      │
                                          ┌───────────┴───────────┐
                                          ▼                       ▼
                                    TCMB EVDS API           TEFAS (fon fiyatları)
```

## 2. Backend Katman Yapısı (FastAPI)

Klasik **katmanlı mimari** (layered/clean architecture) uygulanır: yönlendirici
(router) → servis (iş mantığı) → repository (veri erişimi) → domain modelleri.
Bu ayrım, zekat motoru ve maliyet motoru gibi karmaşık iş kurallarının test
edilebilir ve API'den bağımsız kalmasını sağlar.

```
backend/
├── app/
│   ├── main.py                     # FastAPI uygulama girişi, middleware, router include
│   ├── core/
│   │   ├── config.py                # Pydantic Settings (env değişkenleri)
│   │   ├── security.py              # JWT, şifre hashleme (passlib/argon2)
│   │   ├── database.py              # SQLAlchemy engine/session, Base
│   │   └── redis_client.py          # Redis bağlantı havuzu
│   │
│   ├── models/                      # SQLAlchemy ORM modelleri (şemanın Python karşılığı)
│   │   ├── family.py, user.py, account.py, transaction.py
│   │   ├── asset.py, asset_holding.py, asset_transaction.py
│   │   ├── portfolio_history.py
│   │   └── zakat.py
│   │
│   ├── schemas/                     # Pydantic (giriş/çıkış) DTO'ları
│   │   ├── transaction.py, account.py
│   │   ├── portfolio.py
│   │   └── zakat.py
│   │
│   ├── repositories/                # Sadece SQL/ORM sorguları — iş kuralı YOK
│   │   ├── account_repository.py
│   │   ├── transaction_repository.py
│   │   ├── asset_repository.py
│   │   └── zakat_repository.py
│   │
│   ├── services/                    # İş mantığı — domain kuralları burada yaşar
│   │   ├── budget_service.py         # gelir/gider, kategori bazlı özetler
│   │   ├── account_aggregation_service.py  # çoklu banka hesabını tek ekranda toplama
│   │   ├── cost_basis_engine.py      # FIFO / Ağırlıklı Ortalama kâr-zarar motoru
│   │   ├── portfolio_valuation_service.py  # 1A/3A/1Y periyot performans hesapları
│   │   └── zakat_engine.py           # Fıkhi kurallara göre zekat matrahı hesaplama
│   │
│   ├── api/
│   │   └── v1/
│   │       ├── deps.py               # get_current_user, get_db gibi ortak dependency'ler
│   │       ├── auth.py
│   │       ├── accounts.py
│   │       ├── transactions.py
│   │       ├── portfolio.py
│   │       └── zakat.py              # POST /api/v1/zakat/calculate
│   │
│   ├── workers/
│   │   ├── celery_app.py             # Celery app + Redis broker/backend konfigürasyonu
│   │   ├── scheduler.py              # Celery beat / cron tanımları
│   │   └── tasks/
│   │       ├── fetch_tcmb_rates.py    # TCMB EVDS'den günlük döviz/altın kurları
│   │       ├── fetch_tefas_prices.py  # TEFAS fon fiyatları (BindHistoryInfo)
│   │       ├── snapshot_portfolio.py  # Günlük portfolio_history satırı üretir
│   │       └── recompute_holdings.py  # asset_holdings önbelleğini tazeler
│   │
│   └── utils/
│       ├── money.py                   # Decimal tabanlı para/miktar yardımcıları
│       └── date_ranges.py             # 1A/3A/1Y periyot sınır hesaplama
│
├── alembic/                          # DB migration'ları (schema.sql buradan üretilir/senkron tutulur)
├── tests/
│   ├── unit/                          # cost_basis_engine, zakat_engine birim testleri
│   └── integration/                   # API endpoint testleri (testcontainers-postgres)
├── pyproject.toml
└── Dockerfile
```

**Katman kuralları:**
- `api/` katmanı hiçbir zaman doğrudan ORM sorgusu yazmaz; sadece `services/`
  çağırır, HTTP'ye özgü concern'leri (auth, status code, pagination) yönetir.
- `services/` katmanı iş kurallarını içerir, framework'ten bağımsızdır (FastAPI
  import etmez) — bu sayede worker task'ları da aynı servisleri çağırabilir.
- `repositories/` katmanı sadece CRUD + sorgu; iş kuralı barındırmaz.
- Para/miktar hesaplarında `float` **kesinlikle kullanılmaz**; `Decimal`
  zorunludur (bkz. `utils/money.py`).

## 3. Background Worker Mimarisi (TCMB / TEFAS)

- **Araç:** Celery + Redis (broker & result backend). Alternatif olarak daha
  hafif bir kurulum isteniyorsa `APScheduler` tek-worker senaryosunda yeterli
  olabilir; çoklu worker/yatay ölçekleme planlanıyorsa Celery tercih edilir.
- **Zamanlama (Celery beat):**
  - `fetch_tcmb_rates` → her gün TSİ 15:45 (TCMB kurları günlük yayınlar)
  - `fetch_tefas_prices` → her gün TSİ 21:00 (TEFAS fon fiyatları gün sonu güncellenir)
  - `snapshot_portfolio` → her gün TSİ 23:50 (o günün fiyatlarıyla portföy anlık görüntüsü)
  - `recompute_holdings` → asset_transactions eklendiğinde event-driven (senkron da olabilir)
- **Dayanıklılık:** Her worker task idempotent tasarlanır (aynı gün için tekrar
  çalışırsa `UNIQUE(asset_id, price_date)` constraint'i sayesinde upsert yapar,
  hata fırlatmaz). Başarısız task'lar exponential backoff ile 3 kez denenir.
- **TCMB entegrasyonu:** TCMB EVDS (Elektronik Veri Dağıtım Sistemi) API'si
  veya günlük XML kur listesi (`tcmb.gov.tr/kurlar/today.xml`) kullanılabilir;
  API anahtarı `core/config.py` üzerinden env'den okunur.
- **TEFAS entegrasyonu:** Resmi açık API olmadığından TEFAS'ın
  `BindHistoryInfo` uç noktası (POST, form-data) veya günlük export edilen veri
  kaynağı kullanılır; bu servis dış siteye bağımlı olduğundan `workers/tasks/`
  içinde izole tutulur ve hata durumunda API'yi etkilemez (circuit breaker).

## 4. Redis Kullanım Alanları

1. Celery broker/result backend.
2. Sık okunan, nadiren değişen veriler için cache: güncel döviz/altın fiyatı,
   TEFAS fon NAV değeri (TTL: birkaç saat).
3. Hesaplama maliyetli endpoint'ler için kısa süreli cache: portföy performans
   özeti (1A/3A/1Y), zekat nisab değeri (günlük TTL).
4. Rate limiting (auth endpoint'leri) ve oturum/refresh-token blacklist'i.

## 5. Frontend Katman Yapısı (Next.js — App Router)

```
frontend/
├── app/
│   ├── (auth)/login/, register/
│   ├── (dashboard)/
│   │   ├── layout.tsx                 # Sidebar: Hesaplar, Bütçe, Portföy, Zekat
│   │   ├── accounts/                   # Çoklu banka hesabı tek ekran görünümü
│   │   ├── budget/                     # Gelir/gider takibi, kategori kırılımı
│   │   ├── portfolio/                  # Altın/döviz/TEFAS kâr-zarar (Recharts)
│   │   └── zakat/                      # Zekat sihirbazı ve geçmiş hesaplamalar
│   └── api/ (yalnızca BFF gerekiyorsa; genel kural: doğrudan FastAPI'ye istek)
│
├── components/
│   ├── ui/                             # shadcn/ui bileşenleri
│   ├── charts/                          # Recharts sarmalayıcıları (PnL, dağılım pasta grafiği)
│   └── forms/                           # react-hook-form + zod şemaları
│
├── lib/
│   ├── api-client.ts                    # tip-güvenli fetch sarmalayıcı (openapi-typescript)
│   ├── query-client.ts                  # TanStack Query yapılandırması
│   └── currency.ts                      # gösterim amaçlı para formatlama
│
└── hooks/
    ├── useAccounts.ts, useTransactions.ts
    └── usePortfolioPerformance.ts, useZakatCalculation.ts
```

- Veri çekme: **TanStack Query** ile sunucu state yönetimi, form doğrulama:
  **zod** + `react-hook-form`.
- Backend OpenAPI şemasından `openapi-typescript` ile tip üretimi, elle
  senkronizasyon hatalarını önler.

## 6. Veri Akışı Örneği — Zekat Hesaplama

1. Kullanıcı `/zakat` ekranında "Zekatımı Hesapla" butonuna basar.
2. Next.js → `POST /api/v1/zakat/calculate` (FastAPI).
3. `api/v1/zakat.py` router'ı, kimlik doğrulamadan sonra isteği
   `services/zakat_engine.py`'a devreder.
4. `zakat_engine`:
   - `account_repository` ve `asset_repository` üzerinden ailenin tüm nakit,
     altın, döviz, TEFAS fonu pozisyonlarını çeker.
   - Güncel piyasa değerlerini `asset_price_history` / Redis cache'inden alır.
   - Nisab değerini (`nisab_basis` parametresine göre altın/gümüş) günceller.
   - Borçları (kısa vadeli, vadesi gelmiş) matrahtan düşer.
   - Sonucu `zakat_calculations` + `zakat_calculation_items` olarak DB'ye
     yazar (denetlenebilirlik için her kalem ayrı satır).
5. API, hesaplama sonucunu + kalem dökümünü JSON olarak döner.
6. Frontend sonucu kartlar + tablo halinde gösterir, "Finalize Et" ile
   `status` alanını `finalized` yapabilir.

## 7. Veri Akışı Örneği — Portföy Kâr/Zarar (1A/3A/1Y)

1. Kullanıcı bir varlık türü (altın/döviz/TEFAS fonu) seçer ve periyot filtresi
   uygular.
2. `GET /api/v1/portfolio/performance?asset_type=tefas_fund&period=3m`
3. `portfolio_valuation_service`:
   - `cost_basis_engine`'den güncel `total_cost_basis` ve gerçekleşmemiş
     kâr/zararı alır (FIFO veya ağırlıklı ortalama, holding'in `cost_method`
     alanına göre).
   - `portfolio_history` tablosundan periyot başlangıcındaki (t-1A/t-3A/t-1Y)
     en yakın anlık görüntüyü çeker.
   - Periyot getirisini `(güncel_değer - dönem_başı_değer) / dönem_başı_değer`
     olarak hesaplar.
4. Sonuç Recharts ile çizgi/alan grafiği olarak sunulur.

## 8. Dağıtım (Deployment) Notu

- Docker Compose ile lokal geliştirme: `api`, `worker`, `beat`, `postgres`,
  `redis`, `web` servisleri.
- Prod: API ve worker ayrı container/pod olarak ölçeklenir (worker I/O-bound,
  API CPU/latency-hassas); Alembic migration'ları CI/CD pipeline'ında
  `alembic upgrade head` ile otomatik uygulanır.
