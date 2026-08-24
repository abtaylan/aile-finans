-- =====================================================================
-- AİLE FİNANS VE VARLIK YÖNETİMİ — SUPABASE POSTGRESQL ŞEMASI
-- =====================================================================
-- Sürüm: 0.2.0 (Supabase Auth entegrasyonu + genişletilmiş özellikler)
-- Bu dosya, orijinal database/schema.sql'in üzerine şu değişiklikleri
-- ekler ve TEK SEFERDE, temiz bir Supabase projesine uygulanmak üzere
-- yazılmıştır (idempotent değildir, sadece boş bir projede çalıştırılır):
--   * users tablosu artık auth.users'a bağlı (Supabase Auth) — kendi
--     password_hash alanını barındırmıyor.
--   * properties (gayrimenkul), loans (kredi/taksit), bes_accounts +
--     bes_contributions (BES), bank_statement_uploads + staging
--     transactions (ekstre yükleme) tabloları eklendi.
--   * zakat_calculation_items artık gayrimenkul/BES kaynaklarına da
--     referans verebiliyor; zakat_calculation_liability_items eklendi
--     (borç/taksit kalemlerinin şeffaf dökümü için).
--   * Her tabloda Row Level Security (RLS) aktif — aile bazlı izolasyon.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

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
                                           'trade_goods', 'receivable', 'crypto', 'real_estate',
                                           'bes_fund', 'other_asset');
CREATE TYPE price_source         AS ENUM ('tcmb', 'tefas', 'manual', 'other_provider');
CREATE TYPE property_type        AS ENUM ('ev', 'yazlik', 'kiralik', 'ticari', 'arsa', 'diger');
CREATE TYPE loan_type             AS ENUM ('konut_kredisi', 'tasit_kredisi', 'ihtiyac_kredisi',
                                           'kredi_karti_borcu', 'kisisel_borc', 'diger');
CREATE TYPE statement_upload_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- ---------------------------------------------------------------------
-- 2. FAMILIES
-- ---------------------------------------------------------------------
CREATE TABLE families (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(150) NOT NULL,
    base_currency   CHAR(3) NOT NULL DEFAULT 'TRY',
    timezone        VARCHAR(64) NOT NULL DEFAULT 'Europe/Istanbul',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_families_updated_at BEFORE UPDATE ON families
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 3. USERS  (Supabase Auth ile birebir eşlenen profil tablosu)
-- ---------------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    email           CITEXT NOT NULL UNIQUE,
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

-- current_family_id(): RLS politikalarında tekrar tekrar kullanılan yardımcı.
CREATE OR REPLACE FUNCTION public.current_family_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT family_id FROM public.users WHERE id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 4. ACCOUNTS
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
    current_balance     NUMERIC(18,4) NOT NULL DEFAULT 0,
    credit_limit        NUMERIC(18,4),
    is_active           BOOLEAN NOT NULL DEFAULT true,
    display_order       INTEGER NOT NULL DEFAULT 0,
    color               VARCHAR(7),
    icon                VARCHAR(10),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_accounts_family_id ON accounts(family_id);
CREATE INDEX idx_accounts_owner_user_id ON accounts(owner_user_id);
CREATE TRIGGER trg_accounts_updated_at BEFORE UPDATE ON accounts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 5. CATEGORIES
-- ---------------------------------------------------------------------
CREATE TABLE categories (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id           UUID REFERENCES families(id) ON DELETE CASCADE,
    parent_category_id  UUID REFERENCES categories(id) ON DELETE SET NULL,
    name                VARCHAR(100) NOT NULL,
    type                transaction_type NOT NULL,
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
-- 6. RECURRING_RULES
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
    interval_count  INTEGER NOT NULL DEFAULT 1,
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
-- 7. TRANSACTIONS
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
    amount_base_currency    NUMERIC(18,4) NOT NULL,
    description             VARCHAR(255),
    transaction_date        DATE NOT NULL,
    transfer_pair_id        UUID REFERENCES transactions(id) ON DELETE SET NULL,
    recurring_rule_id       UUID REFERENCES recurring_rules(id) ON DELETE SET NULL,
    attachment_url          TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transactions_family_date ON transactions(family_id, transaction_date DESC);
CREATE INDEX idx_transactions_account_id ON transactions(account_id);
CREATE INDEX idx_transactions_category_id ON transactions(category_id);
CREATE TRIGGER trg_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 8. ASSETS
-- ---------------------------------------------------------------------
CREATE TABLE assets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_type      asset_type NOT NULL,
    symbol          VARCHAR(30) NOT NULL,
    name            VARCHAR(150) NOT NULL,
    unit            VARCHAR(20) NOT NULL,
    quote_currency  CHAR(3) NOT NULL DEFAULT 'TRY',
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
-- 9. ASSET_PRICE_HISTORY
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
-- 10. ASSET_HOLDINGS
-- ---------------------------------------------------------------------
CREATE TABLE asset_holdings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id           UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    asset_id            UUID NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    cost_method         cost_method NOT NULL DEFAULT 'weighted_average',
    quantity            NUMERIC(24,8) NOT NULL DEFAULT 0,
    average_unit_cost   NUMERIC(18,6) NOT NULL DEFAULT 0,
    total_cost_basis    NUMERIC(18,4) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (account_id, asset_id)
);
CREATE INDEX idx_asset_holdings_family_id ON asset_holdings(family_id);
CREATE TRIGGER trg_asset_holdings_updated_at BEFORE UPDATE ON asset_holdings
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 11. ASSET_TRANSACTIONS
-- ---------------------------------------------------------------------
CREATE TABLE asset_transactions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    holding_id          UUID NOT NULL REFERENCES asset_holdings(id) ON DELETE CASCADE,
    account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    asset_id            UUID NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    transaction_type    asset_tx_type NOT NULL,
    quantity              NUMERIC(24,8) NOT NULL CHECK (quantity > 0),
    unit_price             NUMERIC(18,6) NOT NULL CHECK (unit_price >= 0),
    price_currency          CHAR(3) NOT NULL DEFAULT 'TRY',
    fee                     NUMERIC(18,4) NOT NULL DEFAULT 0,
    remaining_quantity      NUMERIC(24,8),
    transaction_date        DATE NOT NULL,
    linked_transaction_id   UUID REFERENCES transactions(id) ON DELETE SET NULL,
    notes                    VARCHAR(255),
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
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
-- 11.1 ASSET_TRANSACTION_LOT_MATCHES
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
-- 12. PORTFOLIO_HISTORY
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
    breakdown_by_asset_type JSONB,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (family_id, snapshot_date)
);
CREATE INDEX idx_portfolio_history_family_date ON portfolio_history(family_id, snapshot_date DESC);

-- ---------------------------------------------------------------------
-- 13. PROPERTIES  (gayrimenkul: ev, yazlık, kiralık, ticari...)
-- ---------------------------------------------------------------------
CREATE TABLE properties (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id           UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    name                VARCHAR(150) NOT NULL,
    property_type       property_type NOT NULL,
    estimated_value     NUMERIC(18,4) NOT NULL DEFAULT 0,
    currency            CHAR(3) NOT NULL DEFAULT 'TRY',
    address              VARCHAR(255),
    -- Fıkhen: gayrimenkul, TİCARET/SATIŞ NİYETİYLE tutulmadıkça zekata
    -- tabi değildir (kira geliri ayrı, tahsil edildiğinde nakit olarak
    -- zekata girer). Bu bayrak yalnızca satış niyetiyle tutulanları işaretler.
    is_trade_intent      BOOLEAN NOT NULL DEFAULT false,
    acquisition_date       DATE,
    notes                    TEXT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_properties_family_id ON properties(family_id);
CREATE TRIGGER trg_properties_updated_at BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 14. LOANS  (kredi / borç / taksit takibi)
-- ---------------------------------------------------------------------
CREATE TABLE loans (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id               UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    linked_account_id       UUID REFERENCES accounts(id) ON DELETE SET NULL,
    name                    VARCHAR(150) NOT NULL,
    loan_type               loan_type NOT NULL,
    lender_name              VARCHAR(150),
    principal_amount          NUMERIC(18,4) NOT NULL,
    total_remaining            NUMERIC(18,4) NOT NULL,
    monthly_installment          NUMERIC(18,4) NOT NULL,
    interest_rate                  NUMERIC(7,4),
    start_date                      DATE NOT NULL,
    end_date                          DATE NOT NULL,
    remaining_installments              INTEGER,
    currency                              CHAR(3) NOT NULL DEFAULT 'TRY',
    is_active                              BOOLEAN NOT NULL DEFAULT true,
    notes                                    TEXT,
    created_at                                TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_loans_family_id ON loans(family_id);
CREATE TRIGGER trg_loans_updated_at BEFORE UPDATE ON loans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 15. BES_ACCOUNTS / BES_CONTRIBUTIONS  (Bireysel Emeklilik Sistemi)
-- ---------------------------------------------------------------------
CREATE TABLE bes_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    owner_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    provider_name   VARCHAR(150) NOT NULL,
    policy_number   VARCHAR(100),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bes_accounts_family_id ON bes_accounts(family_id);
CREATE TRIGGER trg_bes_accounts_updated_at BEFORE UPDATE ON bes_accounts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE bes_contributions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bes_account_id              UUID NOT NULL REFERENCES bes_accounts(id) ON DELETE CASCADE,
    contribution_date           DATE NOT NULL,
    fund_name                   VARCHAR(150) NOT NULL,
    fund_code                   VARCHAR(30),
    personal_amount             NUMERIC(18,4) NOT NULL CHECK (personal_amount >= 0),
    -- Devletin katkı payı: kanunen bireysel katkının %30'u (üst sınıra tabi).
    state_contribution_amount   NUMERIC(18,4) NOT NULL DEFAULT 0,
    unit_price                  NUMERIC(18,6),
    units_bought                 NUMERIC(24,8),
    currency                      CHAR(3) NOT NULL DEFAULT 'TRY',
    created_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bes_contributions_account_id ON bes_contributions(bes_account_id);

-- Fon güncel birim fiyatı serisi -- kâr/zarar hesaplaması için.
CREATE TABLE bes_fund_prices (
    id              BIGSERIAL PRIMARY KEY,
    fund_code       VARCHAR(30) NOT NULL,
    price_date      DATE NOT NULL,
    unit_price      NUMERIC(18,6) NOT NULL,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (fund_code, price_date)
);
CREATE INDEX idx_bes_fund_prices_lookup ON bes_fund_prices(fund_code, price_date DESC);

-- ---------------------------------------------------------------------
-- 16. BANK_STATEMENT_UPLOADS  (aylık ekstre PDF/CSV yükleme + ayrıştırma)
-- ---------------------------------------------------------------------
CREATE TABLE bank_statement_uploads (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id                       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    account_id                      UUID REFERENCES accounts(id) ON DELETE SET NULL,
    uploaded_by_user_id             UUID REFERENCES users(id) ON DELETE SET NULL,
    file_name                       VARCHAR(255) NOT NULL,
    storage_path                    TEXT NOT NULL,
    file_type                       VARCHAR(10) NOT NULL,
    period_start                    DATE,
    period_end                      DATE,
    status                          statement_upload_status NOT NULL DEFAULT 'pending',
    extracted_transaction_count     INTEGER NOT NULL DEFAULT 0,
    error_message                   TEXT,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_statement_uploads_family_id ON bank_statement_uploads(family_id);
CREATE TRIGGER trg_statement_uploads_updated_at BEFORE UPDATE ON bank_statement_uploads
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Ayrıştırma sonucu çıkan aday satırlar (kullanıcı onayı sonrası
-- gerçek transactions tablosuna yazılır -- otomatik değil, denetimli).
CREATE TABLE bank_statement_staging_transactions (
    id                      BIGSERIAL PRIMARY KEY,
    upload_id               UUID NOT NULL REFERENCES bank_statement_uploads(id) ON DELETE CASCADE,
    raw_description          TEXT NOT NULL,
    transaction_date          DATE NOT NULL,
    amount                      NUMERIC(18,4) NOT NULL,
    direction                     transaction_type NOT NULL,
    suggested_category_id           UUID REFERENCES categories(id) ON DELETE SET NULL,
    is_confirmed                      BOOLEAN NOT NULL DEFAULT false,
    matched_transaction_id              UUID REFERENCES transactions(id) ON DELETE SET NULL,
    created_at                             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_statement_staging_upload_id ON bank_statement_staging_transactions(upload_id);

-- ---------------------------------------------------------------------
-- 17. ZAKAT_CALCULATIONS
-- ---------------------------------------------------------------------
CREATE TABLE zakat_calculations (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id               UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    calculation_date         DATE NOT NULL,
    hijri_year_label          VARCHAR(20),
    nisab_basis                nisab_basis NOT NULL DEFAULT 'gold',
    nisab_reference_grams       NUMERIC(10,4) NOT NULL,
    nisab_value_base_currency    NUMERIC(18,4) NOT NULL,
    include_jewelry_in_zakat      BOOLEAN NOT NULL DEFAULT true,
    total_zakatable_assets          NUMERIC(18,4) NOT NULL,
    total_deductible_liabilities     NUMERIC(18,4) NOT NULL DEFAULT 0,
    net_zakat_base                    NUMERIC(18,4) NOT NULL,
    is_above_nisab                     BOOLEAN NOT NULL,
    zakat_rate                          NUMERIC(6,5) NOT NULL DEFAULT 0.02500,
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
-- 18. ZAKAT_CALCULATION_ITEMS
-- ---------------------------------------------------------------------
CREATE TABLE zakat_calculation_items (
    id                          BIGSERIAL PRIMARY KEY,
    zakat_calculation_id        UUID NOT NULL REFERENCES zakat_calculations(id) ON DELETE CASCADE,
    source_type                 zakat_source_type NOT NULL,
    source_account_id           UUID REFERENCES accounts(id) ON DELETE SET NULL,
    source_asset_holding_id     UUID REFERENCES asset_holdings(id) ON DELETE SET NULL,
    source_property_id          UUID REFERENCES properties(id) ON DELETE SET NULL,
    source_bes_account_id       UUID REFERENCES bes_accounts(id) ON DELETE SET NULL,
    description                 VARCHAR(255) NOT NULL,
    quantity                    NUMERIC(24,8),
    unit_value                  NUMERIC(18,6),
    value_base_currency         NUMERIC(18,4) NOT NULL,
    is_included_in_base         BOOLEAN NOT NULL DEFAULT true,
    exclusion_reason             VARCHAR(255),
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_zakat_items_calculation_id ON zakat_calculation_items(zakat_calculation_id);

-- Borç/taksit kalemlerinin şeffaf dökümü (yalnızca vadesi gelen taksit
-- matrahtan düşülebilir -- toplam kalan bakiye değil).
CREATE TABLE zakat_calculation_liability_items (
    id                      BIGSERIAL PRIMARY KEY,
    zakat_calculation_id    UUID NOT NULL REFERENCES zakat_calculations(id) ON DELETE CASCADE,
    source_loan_id           UUID REFERENCES loans(id) ON DELETE SET NULL,
    description                VARCHAR(255) NOT NULL,
    deductible_amount            NUMERIC(18,4) NOT NULL,
    created_at                     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_zakat_liability_items_calculation_id ON zakat_calculation_liability_items(zakat_calculation_id);

-- ---------------------------------------------------------------------
-- 19. EXCHANGE_RATES
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
-- 20. BUDGETS
-- ---------------------------------------------------------------------
CREATE TABLE budgets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id       UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    category_id     UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    period_month    DATE NOT NULL,
    planned_amount  NUMERIC(18,4) NOT NULL CHECK (planned_amount >= 0),
    currency        CHAR(3) NOT NULL DEFAULT 'TRY',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (family_id, category_id, period_month)
);
CREATE TRIGGER trg_budgets_updated_at BEFORE UPDATE ON budgets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- 21. AUDIT_LOGS
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
    id              BIGSERIAL PRIMARY KEY,
    family_id       UUID REFERENCES families(id) ON DELETE CASCADE,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    entity_table    VARCHAR(100) NOT NULL,
    entity_id       UUID NOT NULL,
    action          VARCHAR(20) NOT NULL,
    diff            JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_table, entity_id);
CREATE INDEX idx_audit_logs_family_id ON audit_logs(family_id, created_at DESC);
