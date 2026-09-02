"use client";

import Link from "next/link";
import { Trash2, Landmark, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
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

export function AccountsClient({
accounts,
assets = [],
latestStatements = {},
}: {
accounts: Account[];
assets?: Asset[];
latestStatements?: Record<string, BankStatementUpload>;
}) {
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
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
{accounts.map((account) => (
<Card key={account.id} className="flex flex-col gap-3 p-5">
<div className="flex items-start justify-between">
<div className="flex items-center gap-2">
<span
className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
style={{ backgroundColor: account.color ?? "#2a78d6" }}
>
<Landmark className="h-4 w-4" />
</span>
<div>
<p className="text-sm font-medium text-[var(--text-primary)]">
{account.name}
</p>
<p className="text-xs text-[var(--text-secondary)]">
{account.bank_name || ACCOUNT_TYPE_LABELS[account.account_type]}
</p>
</div>
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
{account.account_type === "investment" ? (
<p className="text-sm text-[var(--text-secondary)]">
Pozisyonlar için{" "}
<Link href="/portfoy" className="underline">
Portföy
</Link>{" "}
sayfasına bak.
</p>
) : (
<p className="text-2xl font-semibold text-[var(--text-primary)]">
{formatCurrency(account.current_balance, account.currency)}
</p>
)}
{account.credit_limit != null && (
<p className="text-xs text-[var(--text-secondary)]">
Limit: {formatCurrency(account.credit_limit, account.currency)}
</p>
)}
{account.iban && (
<p className="text-xs text-[var(--text-muted)]">{account.iban}</p>
)}
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
<Button asChild variant="outline" size="sm" className="w-full">
<Link href={`/hesaplar/${account.id}/ekstre`}>
<FileText className="h-4 w-4" />
Ekstreler
</Link>
</Button>
</div>
)}
</Card>
))}
</div>
)}
</div>
);
}
