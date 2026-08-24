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
  role: "owner" | "admin" | "member" | "viewer";
  locale: string;
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
