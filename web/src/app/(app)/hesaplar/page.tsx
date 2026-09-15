import Link from "next/link";
import { requireFamilyContext } from "@/lib/auth-context";
import { AccountsClient } from "./accounts-client";
import { closeYearAction } from "./actions";
import { formatCurrency } from "@/lib/utils";
import type { Account, Asset, BankStatementUpload, AccountYearClosing } from "@/lib/types/database";

export default async function HesaplarPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { supabase, profile } = await requireFamilyContext();
  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const selectedYear = params.year ? Number(params.year) : currentYear;

const yearOptions: number[] = [];
  for (let y = currentYear; y >= currentYear - 5; y--) yearOptions.push(y);

const { data: closingRows } = await supabase
  .from("account_year_closings")
  .select("*, accounts(name, bank_name)")
  .eq("family_id", profile.family_id)
  .eq("year", selectedYear);
  const closings = (closingRows as (AccountYearClosing & { accounts: { name: string; bank_name: string | null } | null })[]) ?? [];
  const isClosedPastYear = selectedYear !== currentYear && closings.length > 0;

const yearSwitcher = (
  <div className="flex items-center gap-2">
  <span className="text-sm font-medium text-[var(--text-secondary)]">Yıl:</span>
    {yearOptions.map((y) => (
    <Link
      key={y}
      href={y === currentYear ? "/hesaplar" : `/hesaplar?year=${y}`}
      className={y === selectedYear ? "rounded-md border border-[var(--brand)] bg-[var(--brand)] px-3 py-1.5 text-sm text-white" : "rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-secondary)]"}
      >
      {y}
    </Link>
    ))}
  </div>
  );
  
  if (isClosedPastYear) {
    const total = closings.reduce((sum, c) => sum + Number(c.balance_try), 0);
    return (
      <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
      <div>
      <h1 className="text-xl font-semibold text-[var(--text-primary)]">Hesaplar — {selectedYear}</h1>
      <p className="text-sm text-[var(--text-secondary)]">Bu yıl kapatılmış, kayıtlar donduruldu.</p>
      </div>
        {yearSwitcher}
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
      <table className="w-full text-sm">
      <thead className="bg-[var(--surface-2)]">
      <tr>
      <th className="px-4 py-2 text-left">Hesap</th>
      <th className="px-4 py-2 text-right">Bakiye</th>
      <th className="px-4 py-2 text-right">TL Karşılığı</th>
      </tr>
      </thead>
      <tbody>
        {closings.map((c) => (
        <tr key={c.id} className="border-t border-[var(--border)]">
        <td className="px-4 py-2">
          {c.accounts?.bank_name ? `${c.accounts.bank_name} · ` : ""}
          {c.accounts?.name ?? "—"}
        </td>
        <td className="px-4 py-2 text-right">
          {c.balance} {c.currency?.trim()}
        </td>
        <td className="px-4 py-2 text-right">{formatCurrency(c.balance_try, "TRY")}</td>
        </tr>
        ))}
      </tbody>
      </table>
      <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
      <p className="text-sm font-semibold">Toplam</p>
      <p className="text-base font-bold">{formatCurrency(total, "TRY")}</p>
      </div>
      </div>
      </div>
      );
  }
  
  const [{ data: accounts }, { data: assets }] = await Promise.all([
    supabase
    .from("accounts")
    .select("*")
    .eq("family_id", profile.family_id)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true }),
    supabase.from("assets").select("*").eq("is_active", true).order("name"),
    ]);
  
  let typedAccounts = (accounts as Account[]) ?? [];
  
  const encryptionKey = process.env.FIELD_ENCRYPTION_KEY;
  if (encryptionKey) {
    typedAccounts = await Promise.all(
      typedAccounts.map(async (account) => {
        if (!account.iban) return account;
        const { data: decrypted } = await supabase.rpc("decrypt_field", {
          enc: account.iban,
          key: encryptionKey,
        });
        return { ...account, iban: (decrypted as string | null) ?? null };
      })
      );
  }
  
  const creditCardIds = typedAccounts
    .filter((a) => a.account_type === "credit_card")
    .map((a) => a.id);
  
  const latestStatements: Record<string, BankStatementUpload> = {};
  if (creditCardIds.length > 0) {
    const { data: statements } = await supabase
      .from("bank_statement_uploads")
      .select("*")
      .in("account_id", creditCardIds)
      .order("period_end", { ascending: false });
    for (const statement of (statements as BankStatementUpload[]) ?? []) {
      if (statement.account_id && !latestStatements[statement.account_id]) {
        latestStatements[statement.account_id] = statement;
      }
    }
  }
  
  const alreadyClosedThisYear = closings.length > 0;
  
  return (
    <div className="flex flex-col gap-4">
    <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
      {yearSwitcher}
    <form action={closeYearAction}>
    <input type="hidden" name="year" value={currentYear} />
    <button type="submit" className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-3)]">
      {alreadyClosedThisYear ? `${currentYear} Kaydını Güncelle` : `${currentYear} Yılını Kapat`}
    </button>
    </form>
    </div>
    <AccountsClient accounts={typedAccounts} assets={(assets as Asset[]) ?? []} latestStatements={latestStatements} />
    </div>
    );
}
