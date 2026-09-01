-- =====================================================================
-- AİLE FİNANS — v0.3.0 GÜNCELLEMELERİ
-- Bağış/sadaka takibi, zekât ödeme hareketleri, gümüş varlık türü,
-- Hicri havl başlangıç tarihi.
-- NOT: "ALTER TYPE ... ADD VALUE" komutu Postgres'te aynı transaction
-- içinde eklendiği anda KULLANILAMAZ. Bu dosyayı Supabase SQL Editor'de
-- IKI AYRI CALISTIRMA olarak uygulayin:
--   1) Once sadece "ALTER TYPE asset_type ..." satirini calistirin.
--   2) Sonra dosyanin geri kalanini calistirin.
-- Bu migration production'da 2026-09-02 tarihinde uygulanmistir.
-- =====================================================================

-- 0. asset_type enum'una 'silver' ekle (AYRI CALISTIRIN)
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'silver';

-- 1. DONATIONS (bagis / sadaka takibi)
CREATE TYPE donation_type AS ENUM ('bagis', 'sadaka', 'fitre', 'kurban', 'diger');

CREATE TABLE donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  donation_type donation_type NOT NULL DEFAULT 'sadaka',
  recipient VARCHAR(150) NOT NULL,
  description TEXT,
  amount NUMERIC(18,4) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  donation_date DATE NOT NULL,
  hijri_date_label VARCHAR(20),
  counts_toward_zakat BOOLEAN NOT NULL DEFAULT false,
  linked_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
CREATE INDEX idx_donations_family_date ON donations(family_id, donation_date DESC);
CREATE TRIGGER trg_donations_updated_at BEFORE UPDATE ON donations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 2. ZAKAT_PAYMENTS
CREATE TABLE zakat_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  zakat_calculation_id UUID REFERENCES zakat_calculations(id) ON DELETE SET NULL,
  donation_id UUID REFERENCES donations(id) ON DELETE SET NULL,
  payment_date DATE NOT NULL,
  amount NUMERIC(18,4) NOT NULL CHECK (amount > 0),
  currency CHAR(3) NOT NULL DEFAULT 'TRY',
  recipient VARCHAR(150),
  notes TEXT,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
CREATE INDEX idx_zakat_payments_family_date ON zakat_payments(family_id, payment_date DESC);

-- 3. RLS
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE zakat_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY donations_all ON donations FOR ALL USING (family_id = public.current_family_id()) WITH CHECK (family_id = public.current_family_id());
CREATE POLICY zakat_payments_all ON zakat_payments FOR ALL USING (family_id = public.current_family_id()) WITH CHECK (family_id = public.current_family_id());

-- 4. FAMILIES - Hicri havl baslangic tarihi
ALTER TABLE families ADD COLUMN IF NOT EXISTS zakat_hawl_start_date DATE;
