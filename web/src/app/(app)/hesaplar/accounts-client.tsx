"use client";

import Link from "next/link";
import { Trash2, Landmark, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatAccountAmount, formatCurrency, formatDate } from "@/lib/utils";
import { getBankBadge } from "@/lib/banks";
import { deleteAccountAction } from "./actions";
import { AccountDialog } from "./account-dialog";
import type { Account, Asset, BankStatementUpload } from "@/lib/types/database";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
checking: "Vadesiz Hesap",
savings: "Vadeli Hesap",
credit_card: "Kredi Kartı",
cash: "Nakit",
investment: "Yatırım Hesabı",
loan: "Kredi Hesabı",
};

const NO_BANK_KEY = "__none__";

function groupByBank(accounts: Account[]) {
const map = new Map<string, Account[]>();
for (const account of accounts) {
const key = account.bank_name?.trim() || NO_BANK_KEY;
if (!map.has(key)) map.set(key, []);
map.get(key)!.push(account);
}
const groups = [...map.entries()].map(([key, accs]) => ({
key,
label: key === NO_BANK_KEY ? "Banka/Kurum Belirtilmemiş" : key,
accounts: accs,
}));
groups.sort((a, b) => {
if (a.key === NO_BANK_KEY) return 1;
if (b.key === NO_BANK_KEY) return -1;
return a.label.localeCompare(b.label, "tr");
});
return groups;
}

function AmountCell({ account }: { account: Account }) {
if (account.account_type === "investment") {
return (
<p className="text-sm text-[var(--text-secondary)]">
Pozisyonlar için{" "}
<Link href="/portfoy" className="underline">
Portföy
</Link>{" "}
sayfasına bak.
</p>
);
}
return (
<div className="text-right">
<p className="text-base font-semibold text-[var(--text-primary)]">
{formatAccountAmount(account.current_balance, account.currency)}
</p>
{account.currency !== "TRY" && account.try_equivalent_amount != null && (
<p className="text-xs text-[var(--text-muted)]">
≈ {formatCurrency(account.try_equivalent_amount, "TRY")}
</p>
)}
{account.credit_limit != null && (
<p className="text-xs text-[var(--text-secondary)]">
Limit: {formatCurrency(account.credit_limit, account.currency)}
</p>
)}
</div>
);
}

export function AccountsClient({
accounts,
assets = [],
latestStatements = {},
}: {
accounts: Account[];
assets?: Asset[];
latestStatements?: Record<string, BankStatementUpload>;
}) {
const groups = groupByBank(accounts);

return (
<div className="flex flex-col gap-4">
<div className="flex items-center justify-between">
<div>
<h1 className="text-xl font-semibold text-[var(--text-primary)]">Hesaplar</h1>
<p className="text-sm text-[var(--text-secondary)]">
Banka hesaplarını, kredi kartlarını ve yatırım hesaplarını yönet.
</p>
</div>
<AccountDialog assets={assets} />
</div>

{accounts.length === 0 ? (
<Card className="flex flex-col items-center gap-3 p-10 text-center">
<Landmark className="h-8 w-8 text-[var(--text-muted)]" />
<p className="text-sm text-[var(--text-secondary)]">
Henüz hiç hesap eklenmedi. Başlamak için &quot;Hesap Ekle&quot; butonuna tıkla.
</p>
</Card>
) : (
<Card className="overflow-hidden p-0">
{groups.map((group) => {
const groupBadge = group.key !== NO_BANK_KEY ? getBankBadge(group.label) : null;
return (
<div key={group.key} className="flex flex-col">
<div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--surface-2)] px-4 py-2">
{groupBadge && (
<span
className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
style={{ backgroundColor: groupBadge.color }}
>
{groupBadge.abbr}
</span>
)}
<p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
{group.label}
</p>
<span className="text-xs text-[var(--text-muted)]">({group.accounts.length})</span>
</div>
{group.accounts.map((account) => {
const badge = getBankBadge(account.bank_name);
return (
<div
key={account.id}
className="flex flex-col gap-3 border-b border-[var(--border)] p-4 last:border-b-0"
>
<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
<div className="flex items-start gap-3 sm:w-64 sm:shrink-0">
<span
className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold text-white"
style={{ backgroundColor: badge?.color ?? account.color ?? "#2a78d6" }}
>
{badge ? badge.abbr : <Landmark className="h-4 w-4" />}
</span>
<div className="min-w-0">
<p className="truncate text-sm font-medium text-[var(--text-primary)]">
{account.name}
</p>
<p className="truncate text-xs text-[var(--text-secondary)]">
{account.bank_name ? `${account.bank_name} · ` : ""}
{ACCOUNT_TYPE_LABELS[account.account_type]}
</p>
</div>
</div>
<div className="min-w-0 flex-1 sm:px-3">
{account.notes && (
<p className="truncate text-xs text-[var(--text-secondary)]" title={account.notes}>
{account.notes}
</p>
)}
{account.iban && (
<p className="truncate text-xs text-[var(--text-muted)]">{account.iban}</p>
)}
</div>
<div className="flex items-center gap-4 sm:shrink-0">
<AmountCell account={account} />
<div className="hidden text-right sm:block">
<p className="text-[11px] text-[var(--text-muted)]">Güncelleme</p>
<p className="text-xs text-[var(--text-secondary)]">{formatDate(account.updated_at)}</p>
</div>
<div className="flex items-center gap-1">
<AccountDialog account={account} assets={assets} />
<form action={deleteAccountAction}>
<input type="hidden" name="id" value={account.id} />
<Button
type="submit"
variant="ghost"
size="icon"
aria-label="Sil"
className="text-[var(--critical)] hover:bg-[var(--critical-bg)]"
>
<Trash2 className="h-4 w-4" />
</Button>
</form>
</div>
</div>
</div>
{account.account_type === "credit_card" && (
<div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">
{latestStatements[account.id] ? (
<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--text-secondary)]">
{latestStatements[account.id].minimum_payment_amount != null && (
<span>
Asgari:{" "}
{formatCurrency(
latestStatements[account.id].minimum_payment_amount!,
account.currency
)}
</span>
)}
{latestStatements[account.id].payment_due_date && (
<span>
Son Ödeme: {formatDate(latestStatements[account.id].payment_due_date!)}
</span>
)}
</div>
) : (
<p className="text-xs text-[var(--text-muted)]">Henüz ekstre girilmedi.</p>
)}
<Button asChild variant="outline" size="sm" className="w-fit">
<Link href={`/hesaplar/${account.id}/ekstre`}>
<FileText className="h-4 w-4" />
Ekstreler
</Link>
</Button>
</div>
)}
</div>
);
})}
</div>
);
})}
</Card>
)}
</div>
);
}
