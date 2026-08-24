-- =====================================================================
-- AİLE FİNANS — ROW LEVEL SECURITY POLİTİKALARI
-- =====================================================================
-- Model: her aile (family) yalnızca kendi verisini görür/değiştirir.
-- public.current_family_id() fonksiyonu (schema_v2_supabase.sql içinde
-- tanımlı) auth.uid() -> users.family_id eşlemesini SECURITY DEFINER ile
-- yapar, böylece RLS politikaları users tablosuna sonsuz döngüye girmeden
-- referans verebilir.
--
-- Referans (assets, exchange_rates, asset_price_history, bes_fund_prices)
-- tabloları tüm ailelere ortak piyasa verisidir: herkes okuyabilir, sadece
-- service_role (worker/cron) yazabilir.
-- =====================================================================

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_transaction_lot_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE bes_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bes_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bes_fund_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statement_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statement_staging_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE zakat_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE zakat_calculation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE zakat_calculation_liability_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- FAMILIES: yalnızca kendi ailen
-- ---------------------------------------------------------------------
CREATE POLICY families_select ON families FOR SELECT
    USING (id = public.current_family_id());
CREATE POLICY families_update ON families FOR UPDATE
    USING (id = public.current_family_id());
-- INSERT: kimlik doğrulanmış herhangi bir kullanıcı yeni bir aile
-- oluşturabilir (onboarding akışı) -- sonrasında kendi users satırını
-- bu family_id ile ekler.
CREATE POLICY families_insert ON families FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------
-- USERS: aynı aileden herkesi görebilir, sadece kendini güncelleyebilir
-- ---------------------------------------------------------------------
CREATE POLICY users_select ON users FOR SELECT
    USING (family_id = public.current_family_id() OR id = auth.uid());
CREATE POLICY users_insert_self ON users FOR INSERT
    WITH CHECK (id = auth.uid());
CREATE POLICY users_update_self ON users FOR UPDATE
    USING (id = auth.uid());

-- ---------------------------------------------------------------------
-- Aile bazlı (family_id sütunu doğrudan var) standart tablolar
-- ---------------------------------------------------------------------
CREATE POLICY accounts_all ON accounts FOR ALL
    USING (family_id = public.current_family_id())
    WITH CHECK (family_id = public.current_family_id());

CREATE POLICY categories_select ON categories FOR SELECT
    USING (family_id IS NULL OR family_id = public.current_family_id());
CREATE POLICY categories_write ON categories FOR INSERT
    WITH CHECK (family_id = public.current_family_id());
CREATE POLICY categories_update ON categories FOR UPDATE
    USING (family_id = public.current_family_id());
CREATE POLICY categories_delete ON categories FOR DELETE
    USING (family_id = public.current_family_id());

CREATE POLICY recurring_rules_all ON recurring_rules FOR ALL
    USING (family_id = public.current_family_id())
    WITH CHECK (family_id = public.current_family_id());

CREATE POLICY transactions_all ON transactions FOR ALL
    USING (family_id = public.current_family_id())
    WITH CHECK (family_id = public.current_family_id());

CREATE POLICY asset_holdings_all ON asset_holdings FOR ALL
    USING (family_id = public.current_family_id())
    WITH CHECK (family_id = public.current_family_id());

CREATE POLICY portfolio_history_all ON portfolio_history FOR ALL
    USING (family_id = public.current_family_id())
    WITH CHECK (family_id = public.current_family_id());

CREATE POLICY properties_all ON properties FOR ALL
    USING (family_id = public.current_family_id())
    WITH CHECK (family_id = public.current_family_id());

CREATE POLICY loans_all ON loans FOR ALL
    USING (family_id = public.current_family_id())
    WITH CHECK (family_id = public.current_family_id());

CREATE POLICY bes_accounts_all ON bes_accounts FOR ALL
    USING (family_id = public.current_family_id())
    WITH CHECK (family_id = public.current_family_id());

CREATE POLICY bank_statement_uploads_all ON bank_statement_uploads FOR ALL
    USING (family_id = public.current_family_id())
    WITH CHECK (family_id = public.current_family_id());

CREATE POLICY zakat_calculations_all ON zakat_calculations FOR ALL
    USING (family_id = public.current_family_id())
    WITH CHECK (family_id = public.current_family_id());

CREATE POLICY budgets_all ON budgets FOR ALL
    USING (family_id = public.current_family_id())
    WITH CHECK (family_id = public.current_family_id());

CREATE POLICY audit_logs_select ON audit_logs FOR SELECT
    USING (family_id = public.current_family_id());

-- ---------------------------------------------------------------------
-- Üst tablo üzerinden aile izolasyonu (dolaylı family_id)
-- ---------------------------------------------------------------------
CREATE POLICY asset_transactions_all ON asset_transactions FOR ALL
    USING (holding_id IN (SELECT id FROM asset_holdings WHERE family_id = public.current_family_id()))
    WITH CHECK (holding_id IN (SELECT id FROM asset_holdings WHERE family_id = public.current_family_id()));

CREATE POLICY lot_matches_all ON asset_transaction_lot_matches FOR ALL
    USING (sell_tx_id IN (
        SELECT at.id FROM asset_transactions at
        JOIN asset_holdings ah ON ah.id = at.holding_id
        WHERE ah.family_id = public.current_family_id()
    ));

CREATE POLICY bes_contributions_all ON bes_contributions FOR ALL
    USING (bes_account_id IN (SELECT id FROM bes_accounts WHERE family_id = public.current_family_id()))
    WITH CHECK (bes_account_id IN (SELECT id FROM bes_accounts WHERE family_id = public.current_family_id()));

CREATE POLICY statement_staging_all ON bank_statement_staging_transactions FOR ALL
    USING (upload_id IN (SELECT id FROM bank_statement_uploads WHERE family_id = public.current_family_id()))
    WITH CHECK (upload_id IN (SELECT id FROM bank_statement_uploads WHERE family_id = public.current_family_id()));

CREATE POLICY zakat_items_all ON zakat_calculation_items FOR ALL
    USING (zakat_calculation_id IN (SELECT id FROM zakat_calculations WHERE family_id = public.current_family_id()))
    WITH CHECK (zakat_calculation_id IN (SELECT id FROM zakat_calculations WHERE family_id = public.current_family_id()));

CREATE POLICY zakat_liability_items_all ON zakat_calculation_liability_items FOR ALL
    USING (zakat_calculation_id IN (SELECT id FROM zakat_calculations WHERE family_id = public.current_family_id()))
    WITH CHECK (zakat_calculation_id IN (SELECT id FROM zakat_calculations WHERE family_id = public.current_family_id()));

-- ---------------------------------------------------------------------
-- Ortak piyasa referans verisi: herkes okur, sadece service_role yazar
-- ---------------------------------------------------------------------
CREATE POLICY assets_read_all ON assets FOR SELECT USING (true);
CREATE POLICY asset_price_history_read_all ON asset_price_history FOR SELECT USING (true);
CREATE POLICY bes_fund_prices_read_all ON bes_fund_prices FOR SELECT USING (true);
CREATE POLICY exchange_rates_read_all ON exchange_rates FOR SELECT USING (true);
-- Not: bu dört tabloya INSERT/UPDATE/DELETE için hiç politika tanımlanmadı;
-- RLS varsayılanı "yasak"tır, dolayısıyla sadece service_role key (RLS'yi
-- bypass eder) ile çalışan worker/cron bu verileri yazabilir.
