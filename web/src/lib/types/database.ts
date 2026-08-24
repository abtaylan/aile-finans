// Supabase şema tiplerinin elle yazılmış (hafifletilmiş) TypeScript karşılığı.
// İleride `supabase gen types typescript` ile otomatik üretilenle değiştirilebilir.

export type AccountType =
  | "checking"
  | "savings"
  | "credit_card"
  | "cash"
  | "investment"
  | "loan";

export type TransactionType = "income" | "expense" | "transfer";
export type AssetType = "gold" | "currency" | "tefas_fund" | "stock" | "crypto" | "other";
export type CostMethod = "fifo" | "weighted_average";
export type AssetTxType = "buy" | "sell" | "transfer_in" | "transfer_out" | "adjustment";
export type PropertyType = "ev" | "yazlik" | "kiralik" | "ticari" | "arsa" | "diger";
export type LoanType =
  | "konut_kredisi"
  | "tasit_kredisi"
  | "ihtiyac_kredisi"
  | "kredi_karti_borcu"
  | "kisisel_borc"
  | "diger";
export type NisabBasis = "gold" | "silver";

// Aile içi rol hiyerarşisi. Yalnızca owner/admin yönetimsel işlem yapabilir
// (üye davet/çıkarma, rol atama, kategori yönetimi, aile ayarları) — bkz.
// database/schema_v2_rls.sql ve migration `family_role_management_and_invites`.
export type MemberRole = "owner" | "admin" | "member" | "viewer";

// Davet akışında owner rolü asla verilmez (bkz. chk_family_invites_role).
export type InvitableRole = Exclude<MemberRole, "owner">;

export interface Family {
  id: string;
  name: string;
  base_currency: string;
  timezone: string;
}

export interface UserProfile {
  id: string;
  family_id: string;
  email: string;
  full_name: string;
  role: MemberRole;
  locale: string;
}

export interface FamilyMember {
  id: string;
  full_name: string;
  email: string;
  role: MemberRole;
}

export interface FamilyInvite {
  id: string;
  family_id: string;
  email: string;
  role: InvitableRole;
  token: string;
  status: "pending" | "accepted";
  created_at: string;
  expires_at: string;
}

export interface Account {
  id: string;
  family_id: string;
  owner_user_id: string | null;
  name: string;
  bank_name: string | null;
  account_type: AccountType;
  currency: string;
  iban: string | null;
  current_balance: number;
  credit_limit: number | null;
  is_active: boolean;
  display_order: number;
  color: string | null;
  icon: string | null;
}

export interface Category {
  id: string;
  family_id: string | null;
  parent_category_id: string | null;
  name: string;
  type: "income" | "expense";
  icon: string | null;
  color: string | null;
  is_system_default: boolean;
}

export interface Transaction {
  id: string;
  family_id: string;
  account_id: string;
  category_id: string | null;
  type: TransactionType;
  amount: number;
  currency: string;
  amount_base_currency: number;
  description: string | null;
  transaction_date: string;
}

export interface Asset {
  id: string;
  asset_type: AssetType;
  symbol: string;
  name: string;
  unit: string;
  quote_currency: string;
}

export interface AssetHolding {
  id: string;
  family_id: string;
  account_id: string;
  asset_id: string;
  cost_method: CostMethod;
  quantity: number;
  average_unit_cost: number;
  total_cost_basis: number;
}

export interface AssetTransaction {
  id: string;
  holding_id: string;
  account_id: string;
  asset_id: string;
  transaction_type: AssetTxType;
  quantity: number;
  unit_price: number;
  price_currency: string;
  fee: number;
  remaining_quantity: number | null;
  transaction_date: string;
  notes: string | null;
}

export interface Property {
  id: string;
  family_id: string;
  name: string;
  property_type: PropertyType;
  estimated_value: number;
  currency: string;
  address: string | null;
  is_trade_intent: boolean;
  acquisition_date: string | null;
  notes: string | null;
}

export interface Loan {
  id: string;
  family_id: string;
  linked_account_id: string | null;
  name: string;
  loan_type: LoanType;
  lender_name: string | null;
  principal_amount: number;
  total_remaining: number;
  monthly_installment: number;
  interest_rate: number | null;
  start_date: string;
  end_date: string;
  remaining_installments: number | null;
  currency: string;
  is_active: boolean;
  notes: string | null;
}

export interface BesAccount {
  id: string;
  family_id: string;
  owner_user_id: string | null;
  provider_name: string;
  policy_number: string | null;
  is_active: boolean;
}

export interface BesContribution {
  id: string;
  bes_account_id: string;
  contribution_date: string;
  fund_name: string;
  fund_code: string | null;
  personal_amount: number;
  state_contribution_amount: number;
  unit_price: number | null;
  units_bought: number | null;
  currency: string;
}

export interface Budget {
  id: string;
  family_id: string;
  category_id: string;
  period_month: string;
  planned_amount: number;
  currency: string;
}

// Kredi kartı ekstresi (roadmap #3). `source: "manual"` elle girilen
// ekstreleri, `source: "upload"` ise ileride eklenecek PDF/CSV yükleme
// akışını (adım 3, henüz yok) işaretler.
export type StatementUploadStatus = "pending" | "processing" | "completed" | "failed";
export type StatementSource = "upload" | "manual";

export interface BankStatementUpload {
  id: string;
  family_id: string;
  account_id: string | null;
  uploaded_by_user_id: string | null;
  file_name: string | null;
  storage_path: string | null;
  file_type: string | null;
  source: StatementSource;
  period_start: string | null;
  period_end: string | null;
  minimum_payment_amount: number | null;
  payment_due_date: string | null;
  statement_total_amount: number | null;
  status: StatementUploadStatus;
  extracted_transaction_count: number;
  error_message: string | null;
}

// Ekstre kalemi. Taksitli alışverişlerde `amount` o ay ekstreye yansıyan
// tutardır (gerçek ekstredeki gibi) — `installment_label` yalnızca "3/6"
// gibi bilgilendirme etiketidir, ileride otomatik ay bölme yapılmıyor.
export interface BankStatementStagingTransaction {
  id: number;
  upload_id: string;
  raw_description: string;
  transaction_date: string;
  amount: number;
  direction: "income" | "expense";
  installment_label: string | null;
  suggested_category_id: string | null;
  is_confirmed: boolean;
  matched_transaction_id: string | null;
}

export interface StatementWithItems extends BankStatementUpload {
  items: BankStatementStagingTransaction[];
}
