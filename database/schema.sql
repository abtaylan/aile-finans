-- =====================================================================
-- AİLE FİNANS VE VARLIK YÖNETİMİ - POSTGRESQL VERİTABANI ŞEMASI
-- =====================================================================
-- Sürüm: 0.1.0 (İlk taslak)
-- Motor : PostgreSQL 15+
-- Notlar:
--   * Tüm birincil anahtarlar UUID (gen_random_uuid()) — dağıtık/senkron
--     senaryolarda ve mobil offline-first genişlemede kolaylık sağlar.
--   * Parasal alanlar NUMERIC(18,4) — kur/miktar hesaplarında yuvarlama
--     hatalarını önlemek için. Zekat/vergi gibi hassas alanlarda da aynı
--     hassasiyet korunur.
--   * Her tabloda created_at/updated_at + updated_at trigger'ı var.
--   * Çoklu kiracı (multi-tenant) birimi "families" tablosudur — bir aile
--     birden çok kullanıcıya (eş, çocuk vb.) ve hesaba sahip olabilir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";      -- gen_random_uuid() için
CREATE EXTENSION IF NOT EXISTS "citext";        -- case-insensitive email

-- ---------------------------------------------------------------------
-- 0.1 ORTAK YARDIMCI FONKSİYON: updated_at otomatik güncelleme
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- 1. ENUM TİPLERİ
-- ---------------------------------------------------------------------
CREATE TYPE user_role            AS ENUM ('owner', 'admin', 'member', 'viewer');
CREATE TYPE account_type         AS ENUM ('checking', 'savings', 'credit_card', 'cash', 'investment', 'loan');
CREATE TYPE transaction_type     AS ENUM ('income', 'expense', 'transfer');
CREATE TYPE recurrence_frequency AS ENUM ('daily', 'weekly', 'monthly', 'yearly');
CREATE TYPE asset_type           AS ENUM ('gold', 'currency', 'tefas_fund', 'stock', 'crypto', 'other');
CREATE TYPE asset_tx_type        AS ENUM ('buy', 'sell', 'transfer_in', 'transfer_out', 'adjustment');
CREATE TYPE cost_method          AS ENUM ('fifo', 'weighted_average');
CREATE TYPE nisab_basis          AS ENUM ('gold', 'silver');
CREATE TYPE zakat_status         AS ENUM ('draft', 'finalized', 'paid');
CREATE TYPE zakat_source_type    AS ENUM ('cash', 'gold', 'silver', 'currency', 'tefas_fund', 'stock',
                                           'trade_goods', 'receivable', 'crypto', 'other_asset');
CREATE TYPE price_source         AS ENUM ('tcmb', 'tefas', 'manual', 'other_provider');

-- ---------------------------------------------------------------------
-- 2. FAMILIES  (kiracı / hane halkı birimi)
-- ---------------------------------------------------------------------
CREATE TABLE families (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    base_currency   CHAR(3) NOT NULL DEFAULT 'TRY',   -- ISO 4217
    timezone        VARCHAR(64) NOT NULL DEFAULT 'Europe/Istanbul',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_families_updated_at BEFORE UPDATE ON families
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 3. USERS
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    email           CITEXT NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(150) NOT NULL,
    role            user_role NOT NULL DEFAULT 'member',
    locale          VARCHAR(10) NOT NULL DEFAULT 'tr-TR',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_family_id ON users(family_id);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 4. ACCOUNTS  (banka hesabı, kredi kartı, nakit, yatırım cüzdanı...)
-- ---------------------------------------------------------------------
CREATE TABLE accounts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id           UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    name                VARCHAR(150) NOT NULL,
    bank_name           VARCHAR(150),
    account_type        account_type NOT NULL,
    currency            CHAR(3) NOT NULL DEFAULT 'TRY',
    iban                VARCHAR(34),
    -- current_balance: performans için tutulan denormalize önbellek.
    -- Gerçek kaynak (source of truth) her zaman transactions tablosudur;
    -- bu alan bir trigger/servis tarafından senkron tutulur.
    current_balance     NUMERIC(18,4) NOT NULL DEFAULT 0,
    credit_limit        NUMERIC(18,4),                 -- kredi kartı için
    is_active           BOOLEAN NOT NULL DEFAULT true,
    display_order       INTEGER NOT NULL DEFAULT 0,
    color               VARCHAR(7),                     -- UI için hex renk
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_accounts_family_id ON accounts(family_id);
CREATE INDEX idx_accounts_owner_user_id ON accounts(owner_user_id);
CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 5. CATEGORIES  (gelir/gider kategorileri, aile bazlı özelleştirilebilir)
-- ---------------------------------------------------------------------
CREATE TABLE categories (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id           UUID REFERENCES families(id) ON DELETE CASCADE,  -- NULL = sistem varsayılanı
    parent_category_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
    name                VARCHAR(100) NOT NULL,
    type                transaction_type NOT NULL,   -- income | expense (transfer kategorisiz)
    icon                VARCHAR(50),
    color               VARCHAR(7),
    is_system_default   BOOLEAN NOT NULL DEFAULT false,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_categories_type_not_transfer CHECK (type <> 'transfer')
);
CREATE INDEX idx_categories_family_id ON categories(family_id);
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 6. RECURRING_RULES  (tekrarlayan işlemler: maaş, abonelik, kira...)
-- ---------------------------------------------------------------------
CREATE TABLE recurring_rules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    account_id      UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category_id     UUID REFERENCES categories(id) ON DELETE SET NULL,
    type            transaction_type NOT NULL,
    amount          NUMERIC(18,4) NOT NULL,
    currency        CHAR(3) NOT NULL DEFAULT 'TRY',
    description     VARCHAR(255),
    frequency       recurrence_frequency NOT NULL,
    interval_count  INTEGER NOT NULL DEFAULT 1,       -- örn. her 2 haftada bir
    start_date      DATE NOT NULL,
    end_date        DATE,
    next_run_date   DATE NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recurring_rules_next_run ON recurring_rules(next_run_date) WHERE is_active;
CREATE TRIGGER trg_recurring_rules_updated_at BEFORE UPDATE ON recurring_rules
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 7. TRANSACTIONS  (bütçe / nakit akışı hareketleri)
-- ---------------------------------------------------------------------
CREATE TABLE transactions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id               UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    account_id              UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category_id             UUID REFERENCES categories(id) ON DELETE SET NULL,
    created_by_user_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    type                    transaction_type NOT NULL,
    amount                  NUMERIC(18,4) NOT NULL CHECK (amount > 0),
    currency                CHAR(3) NOT NULL DEFAULT 'TRY',
    exchange_rate_to_base   NUMERIC(18,6) NOT NULL DEFAULT 1,
    amount_base_currency    NUMERIC(18,4) NOT NULL,   -- amount * exchange_rate_to_base
    description             VARCHAR(255),
    transaction_date        DATE NOT NULL,
    -- transfer işlemlerinde aynı transferin karşı bacağına referans
    transfer_pair_id        UUID REFERENCES transactions(id) ON DELETE SET NULL,
    recurring_rule_id       UUID REFERENCES recurring_rules(id) ON DELETE SET NULL,
    attachment_url          TEXT,                      -- fiş/fatura görseli
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_transfer_has_pair CHECK (
        (type <> 'transfer') OR (type = 'transfer')  -- iş kuralı servis katmanında da doğrulanır
    )
);
CREATE INDEX idx_transactions_family_date ON transactions(family_id, transaction_date DESC);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 8. ASSETS  (altın türleri, döviz cinsleri, TEFAS fonları... master data)
-- ---------------------------------------------------------------------
CREATE TABLE assets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_type      asset_type NOT NULL,
    symbol          VARCHAR(30) NOT NULL,      -- örn. 'XAU', 'USD', 'AFT' (TEFAS fon kodu)
    name            VARCHAR(150) NOT NULL,
    unit            VARCHAR(20) NOT NULL,       -- 'gram', 'adet', 'pay'
    quote_currency  CHAR(3) NOT NULL DEFAULT 'TRY',
    -- TEFAS'a özgü opsiyonel meta veri:
    tefas_fund_category  VARCHAR(100),
    tefas_umbrella_type  VARCHAR(100),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (asset_type, symbol)
);
CREATE TRIGGER trg_assets_updated_at BEFORE UPDATE ON assets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 9. ASSET_PRICE_HISTORY  (TCMB/TEFAS worker'ının doldurduğu fiyat serisi)
-- ---------------------------------------------------------------------
CREATE TABLE asset_price_history (
    id              BIGSERIAL PRIMARY KEY,
    asset_id        UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    price_date      DATE NOT NULL,
    price           NUMERIC(18,6) NOT NULL,
    currency        CHAR(3) NOT NULL DEFAULT 'TRY',
    source          price_source NOT NULL,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (asset_id, price_date)
);
CREATE INDEX idx_asset_price_history_lookup ON asset_price_history(asset_id, price_date DESC);

-- ---------------------------------------------------------------------
-- 10. ASSET_HOLDINGS  (aile/hesap bazlı güncel varlık pozisyonu - önbellek)
-- ---------------------------------------------------------------------
CREATE TABLE asset_holdings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id           UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    asset_id            UUID NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    cost_method         cost_method NOT NULL DEFAULT 'weighted_average',
    quantity            NUMERIC(24,8) NOT NULL DEFAULT 0,
    average_unit_cost   NUMERIC(18,6) NOT NULL DEFAULT 0,   -- weighted_average yönteminde güncel
    total_cost_basis    NUMERIC(18,4) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id, asset_id)
);
CREATE INDEX idx_asset_holdings_family_id ON asset_holdings(family_id);
CREATE TRIGGER trg_asset_holdings_updated_at BEFORE UPDATE ON asset_holdings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 11. ASSET_TRANSACTIONS  (alım/satım hareketleri = FIFO lot defteri)
-- ---------------------------------------------------------------------
CREATE TABLE asset_transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    holding_id          UUID NOT NULL REFERENCES asset_holdings(id) ON DELETE CASCADE,
    account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    asset_id            UUID NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    transaction_type    asset_tx_type NOT NULL,
    quantity             NUMERIC(24,8) NOT NULL CHECK (quantity > 0),
    unit_price           NUMERIC(18,6) NOT NULL CHECK (unit_price >= 0),
    price_currency        CHAR(3) NOT NULL DEFAULT 'TRY',
    fee                   NUMERIC(18,4) NOT NULL DEFAULT 0,
    -- FIFO lot takibi: bir 'buy' kaydının satılmamış kalan miktarı.
    -- 'sell' kayıtlarında NULL bırakılır.
    remaining_quantity    NUMERIC(24,8),
    transaction_date      DATE NOT NULL,
    linked_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL, -- bütçe hareketiyle eşleme
    notes                  VARCHAR(255),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_remaining_qty_only_on_buy CHECK (
        (transaction_type IN ('buy','transfer_in') AND remaining_quantity IS NOT NULL)
        OR (transaction_type IN ('sell','transfer_out','adjustment'))
    )
);
CREATE INDEX idx_asset_tx_holding_fifo
    ON asset_transactions(holding_id, transaction_date, created_at)
    WHERE transaction_type IN ('buy','transfer_in');
CREATE INDEX idx_asset_tx_holding_id ON asset_transactions(holding_id);

-- ---------------------------------------------------------------------
-- 11.1 ASSET_TRANSACTION_LOT_MATCHES  (bir satışın hangi alım lotlarını
--      ne kadar tükettiğini izler — FIFO gerçekleşmiş kâr/zarar denetimi)
-- ---------------------------------------------------------------------
CREATE TABLE asset_transaction_lot_matches (
    id                  BIGSERIAL PRIMARY KEY,
    sell_tx_id          UUID NOT NULL REFERENCES asset_transactions(id) ON DELETE CASCADE,
    buy_tx_id           UUID NOT NULL REFERENCES asset_transactions(id) ON DELETE CASCADE,
    matched_quantity    NUMERIC(24,8) NOT NULL CHECK (matched_quantity > 0),
    buy_unit_cost       NUMERIC(18,6) NOT NULL,
    sell_unit_price     NUMERIC(18,6) NOT NULL,
    realized_pnl        NUMERIC(18,4) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lot_matches_sell_tx ON asset_transaction_lot_matches(sell_tx_id);
CREATE INDEX idx_lot_matches_buy_tx ON asset_transaction_lot_matches(buy_tx_id);

-- ---------------------------------------------------------------------
-- 12. PORTFOLIO_HISTORY  (günlük/periyodik portföy değeri anlık görüntüsü)
-- ---------------------------------------------------------------------
CREATE TABLE portfolio_history (
    id                  BIGSERIAL PRIMARY KEY,
    family_id           UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    snapshot_date        DATE NOT NULL,
    total_market_value    NUMERIC(18,4) NOT NULL,
    total_cost_basis       NUMERIC(18,4) NOT NULL,
    unrealized_pnl          NUMERIC(18,4) NOT NULL,
    realized_pnl_cumulative NUMERIC(18,4) NOT NULL DEFAULT 0,
    currency                CHAR(3) NOT NULL DEFAULT 'TRY',
    -- Varlık kırılımı (opsiyonel, hızlı grafik için JSONB önbellek)
    breakdown_by_asset_type JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (family_id, snapshot_date)
);
CREATE INDEX idx_portfolio_history_family_date ON portfolio_history(family_id, snapshot_date DESC);

-- ---------------------------------------------------------------------
-- 13. ZAKAT_CALCULATIONS  (zekat matrahı hesaplama başlığı)
-- ---------------------------------------------------------------------
CREATE TABLE zakat_calculations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id               UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    calculation_date         DATE NOT NULL,
    hijri_year_label          VARCHAR(20),             -- örn. "1447 H" (bilgi amaçlı)
    nisab_basis                nisab_basis NOT NULL DEFAULT 'gold',
    nisab_reference_grams       NUMERIC(10,4) NOT NULL, -- örn. 85.000 gr altın
    nisab_value_base_currency    NUMERIC(18,4) NOT NULL,
    include_jewelry_in_zakat      BOOLEAN NOT NULL DEFAULT true,  -- mezhebe göre yapılandırılabilir
    total_zakatable_assets          NUMERIC(18,4) NOT NULL,
    total_deductible_liabilities     NUMERIC(18,4) NOT NULL DEFAULT 0,
    net_zakat_base                    NUMERIC(18,4) NOT NULL,      -- assets - liabilities
    is_above_nisab                     BOOLEAN NOT NULL,
    zakat_rate                          NUMERIC(6,5) NOT NULL DEFAULT 0.02500,  -- 1/40
    zakat_due_amount                     NUMERIC(18,4) NOT NULL,
    currency                              CHAR(3) NOT NULL DEFAULT 'TRY',
    status                                 zakat_status NOT NULL DEFAULT 'draft',
    paid_amount                            NUMERIC(18,4) NOT NULL DEFAULT 0,
    paid_at                                 TIMESTAMPTZ,
    notes                                    TEXT,
    created_by_user_id                       UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at                                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_zakat_calculations_family_date ON zakat_calculations(family_id, calculation_date DESC);
CREATE TRIGGER trg_zakat_calculations_updated_at BEFORE UPDATE ON zakat_calculations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 14. ZAKAT_CALCULATION_ITEMS  (matraha giren/girmeyen kalemlerin dökümü
--     — denetlenebilirlik ve kullanıcıya şeffaf gösterim için)
-- ---------------------------------------------------------------------
CREATE TABLE zakat_calculation_items (
    id                      BIGSERIAL PRIMARY KEY,
    zakat_calculation_id     UUID NOT NULL REFERENCES zakat_calculations(id) ON DELETE CASCADE,
    source_type               zakat_source_type NOT NULL,
    -- Kaynağa gevşek referans (account veya asset_holding olabilir);
    -- polymorphic FK yerine servis katmanında doğrulanan iki nullable alan:
    source_account_id           UUID REFERENCES accounts(id) ON DELETE SET NULL,
    source_asset_holding_id      UUID REFERENCES asset_holdings(id) ON DELETE SET NULL,
    description                   VARCHAR(255) NOT NULL,
    quantity                       NUMERIC(24,8),
    unit_value                      NUMERIC(18,6),
    value_base_currency              NUMERIC(18,4) NOT NULL,
    is_included_in_base                BOOLEAN NOT NULL DEFAULT true,
    exclusion_reason                    VARCHAR(255),   -- örn. "vadesi gelmemiş borç", "kullanım eşyası"
    created_at                            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_zakat_items_calculation_id ON zakat_calculation_items(zakat_calculation_id);

-- ---------------------------------------------------------------------
-- 15. EXCHANGE_RATES  (TCMB döviz kurları önbelleği)
-- ---------------------------------------------------------------------
CREATE TABLE exchange_rates (
    id              BIGSERIAL PRIMARY KEY,
    currency_code   CHAR(3) NOT NULL,
    rate_date       DATE NOT NULL,
    buying_rate     NUMERIC(18,6) NOT NULL,
    selling_rate    NUMERIC(18,6) NOT NULL,
    base_currency   CHAR(3) NOT NULL DEFAULT 'TRY',
    source          price_source NOT NULL DEFAULT 'tcmb',
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (currency_code, rate_date, base_currency)
);
CREATE INDEX idx_exchange_rates_lookup ON exchange_rates(currency_code, rate_date DESC);

-- ---------------------------------------------------------------------
-- 16. BUDGETS  (kategori bazlı aylık bütçe planı — bütçe takibi için)
-- ---------------------------------------------------------------------
CREATE TABLE budgets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    category_id     UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    period_month    DATE NOT NULL,          -- ayın 1'i olarak saklanır (örn. 2026-08-01)
    planned_amount  NUMERIC(18,4) NOT NULL CHECK (planned_amount >= 0),
    currency        CHAR(3) NOT NULL DEFAULT 'TRY',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (family_id, category_id, period_month)
);
CREATE TRIGGER trg_budgets_updated_at BEFORE UPDATE ON budgets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 17. AUDIT_LOGS  (finansal veri için asgari denetim izi — opsiyonel ama önerilir)
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    family_id       UUID REFERENCES families(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    entity_table    VARCHAR(100) NOT NULL,
    entity_id       UUID NOT NULL,
    action          VARCHAR(20) NOT NULL,   -- INSERT | UPDATE | DELETE
    diff            JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_table, entity_id);
CREATE INDEX idx_audit_logs_family_id ON audit_logs(family_id, created_at DESC);

-- =====================================================================
-- SON: Örnek doğrulama sorguları (deploy sonrası smoke test için)
-- =====================================================================
-- SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
-- \d+ zakat_calculations
