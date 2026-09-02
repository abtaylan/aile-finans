"use client";

import { useMemo } from "react";
import { CreditCard, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { deleteDebtAction } from "./actions";
import { DebtDialog } from "./debt-dialog";
import type { Loan } from "@/lib/types/database";

const TYPE_LABELS: Record<string, string> = {
konut_kredisi: "Konut Kredisi",
tasit_kredisi: "Taşıt Kredisi",
ihtiyac_kredisi: "İhtiyaç Kredisi",
kredi_karti_borcu: "Kredi Kartı Borcu",
kisisel_borc: "Kişisel Borç",
diger: "Diğer",
};

export function DebtsClient({ debts }: { debts: Loan[] }) {
const activeDebts = useMemo(() => debts.filter((d) => d.is_active), [debts]);
const totalRemaining = activeDebts.reduce((sum, d) => sum + Number(d.total_remaining), 0);
const totalMonthly = activeDebts.reduce((sum, d) => sum + Number(d.monthly_installment), 0);

return (
<div className="flex flex-col gap-4">
<div className="flex items-center justify-between">
<div>
<h1 className="text-xl font-semibold text-[var(--text-primary)]">Borçlar</h1>
<p className="text-sm text-[var(--text-secondary)]">
Krediler ve diğer borçların toplu görünümü.
</p>
</div>
<DebtDialog />
</div>

<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
<Card className="p-4">
<p className="text-sm text-[var(--text-secondary)]">Toplam Kalan Borç</p>
<p className="text-2xl font-semibold text-[var(--text-primary)]">
{formatCurrency(totalRemaining)}
</p>
</Card>
<Card className="p-4">
<p className="text-sm text-[var(--text-secondary)]">Aylık Toplam Taksit</p>
<p className="text-2xl font-semibold text-[var(--text-primary)]">
{formatCurrency(totalMonthly)}
</p>
</Card>
</div>

<Card>
<CardHeader>
<CardTitle className="!text-base !font-semibold text-[var(--text-primary)]">
Kredi / Borç Listesi
</CardTitle>
</CardHeader>
<CardContent className="pt-0">
{debts.length === 0 ? (
<p className="py-6 text-center text-sm text-[var(--text-secondary)]">
Henüz kredi/borç eklenmedi.
</p>
) : (
<div className="flex flex-col divide-y divide-[var(--border)]">
{debts.map((d) => (
<div key={d.id} className="flex items-center justify-between gap-2 py-3">
<div className="flex items-center gap-3">
<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)]">
<CreditCard className="h-4 w-4" />
</span>
<div>
<p className="text-sm font-medium text-[var(--text-primary)]">
{d.name}
{!d.is_active && (
<span className="ml-2 text-xs font-normal text-[var(--text-muted)]">
(kapandı)
</span>
)}
</p>
<p className="text-xs text-[var(--text-secondary)]">
{TYPE_LABELS[d.loan_type]}
{d.lender_name ? ` · ${d.lender_name}` : ""} · Bitiş{" "}
{formatDate(d.end_date)}
</p>
</div>
</div>
<div className="flex items-center gap-2">
<div className="text-right">
<p className="text-sm font-medium text-[var(--text-primary)]">
{formatCurrency(d.total_remaining)}
</p>
<p className="text-xs text-[var(--text-muted)]">
{formatCurrency(d.monthly_installment)}/ay
</p>
</div>
<DebtDialog debt={d} />
<form action={deleteDebtAction}>
<input type="hidden" name="id" value={d.id} />
<Button
type="submit"
variant="ghost"
size="icon"
className="text-[var(--critical)] hover:bg-[var(--critical-bg)]"
>
<Trash2 className="h-4 w-4" />
</Button>
</form>
</div>
</div>
))}
</div>
)}
</CardContent>
</Card>
</div>
);
}
