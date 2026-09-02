"use client";

import { useMemo } from "react";
import { HandHeart, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { deleteDonationAction } from "./actions";
import { DonationDialog } from "./donation-dialog";
import type { Donation } from "@/lib/types/database";

const TYPE_LABELS: Record<string, string> = {
bagis: "Bagis",
sadaka: "Sadaka",
fitre: "Fitre",
kurban: "Kurban",
diger: "Diger",
};

export function DonationsClient({ donations }: { donations: Donation[] }) {
const sorted = useMemo(
() => [...donations].sort((a, b) => b.donation_date.localeCompare(a.donation_date)),
[donations]
);
const total = donations.reduce((sum, d) => sum + Number(d.amount), 0);
const zakatTotal = donations
.filter((d) => d.counts_toward_zakat)
.reduce((sum, d) => sum + Number(d.amount), 0);

return (
<div className="flex flex-col gap-4">
<div className="flex items-center justify-between">
<div>
<h1 className="text-xl font-semibold text-[var(--text-primary)]">Bagis ve Sadaka</h1>
<p className="text-sm text-[var(--text-secondary)]">
Yapilan hayirlarin kime, ne zaman ve ne kadar verildiginin kaydi.
</p>
</div>
<DonationDialog />
</div>

<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
<Card className="p-4">
<p className="text-sm text-[var(--text-secondary)]">Toplam Bagis/Sadaka</p>
<p className="text-2xl font-semibold text-[var(--text-primary)]">
{formatCurrency(total)}
</p>
</Card>
<Card className="p-4">
<p className="text-sm text-[var(--text-secondary)]">Zekattan Dusulen</p>
<p className="text-2xl font-semibold text-[var(--text-primary)]">
{formatCurrency(zakatTotal)}
</p>
</Card>
</div>

<Card>
<CardHeader>
<CardTitle className="!text-base !font-semibold text-[var(--text-primary)]">
Hareketler
</CardTitle>
</CardHeader>
<CardContent className="pt-0">
{sorted.length === 0 ? (
<p className="py-6 text-center text-sm text-[var(--text-secondary)]">
Henuz bagis/sadaka kaydi eklenmedi.
</p>
) : (
<div className="flex flex-col divide-y divide-[var(--border)]">
{sorted.map((d) => (
<div key={d.id} className="flex items-center justify-between gap-2 py-3">
<div className="flex items-center gap-3">
<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)]">
<HandHeart className="h-4 w-4" />
</span>
<div>
<p className="text-sm font-medium text-[var(--text-primary)]">
{d.recipient}
</p>
<p className="text-xs text-[var(--text-secondary)]">
{formatDate(d.donation_date)}
{d.description ? ` · ${d.description}` : ""}
</p>
</div>
</div>
<div className="flex items-center gap-2">
<div className="text-right">
<p className="text-sm font-medium text-[var(--text-primary)]">
{formatCurrency(d.amount)}
</p>
<div className="flex items-center justify-end gap-1">
<Badge variant="secondary">{TYPE_LABELS[d.donation_type]}</Badge>
{d.counts_toward_zakat && <Badge>Zekat</Badge>}
</div>
</div>
<DonationDialog donation={d} />
<form action={deleteDonationAction}>
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
