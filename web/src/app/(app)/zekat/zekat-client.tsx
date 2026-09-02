"use client";

import { useMemo, useState } from "react";
import { HandCoins, Home, Landmark, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatCurrency, formatDate } from "@/lib/utils";
import { hijriDateLabel, isHawlComplete, hawlCompletionDate, daysUntilHawlCompletion } from "@/lib/hijri";
import { deletePropertyAction, deleteLoanAction, setHawlStartDateAction, deleteZakatPaymentAction } from "./actions";
import { PropertyDialog } from "./property-dialog";
import { LoanDialog } from "./loan-dialog";
import { ZakatPaymentDialog } from "./zakat-payment-dialog";
import type { Account, AssetHolding, Asset, Property, Loan, ZakatPayment } from "@/lib/types/database";

const PROPERTY_TYPE_LABELS: Record<string, string> = {
ev: "Ev",
yazlik: "Yazlık",
kiralik: "Kiralık",
ticari: "Ticari",
arsa: "Arsa",
diger: "Diğer",
};

const LOAN_TYPE_LABELS: Record<string, string> = {
konut_kredisi: "Konut Kredisi",
tasit_kredisi: "Taşıt Kredisi",
ihtiyac_kredisi: "İhtiyaç Kredisi",
kredi_karti_borcu: "Kredi Kartı Borcu",
kisisel_borc: "Kişisel Borç",
diger: "Diğer",
};

export function ZekatClient({
accounts,
holdings,
assets,
latestPrices,
properties,
loans,
goldPricePerGram,
hawlStartDate,
payments,
}: {
accounts: Account[];
holdings: AssetHolding[];
assets: Asset[];
latestPrices: Record<string, number>;
properties: Property[];
loans: Loan[];
goldPricePerGram: number;
hawlStartDate: string | null;
payments: ZakatPayment[];
}) {
const [includeJewelry, setIncludeJewelry] = useState(true);
const [hawlDateInput, setHawlDateInput] = useState(hawlStartDate ?? "");
const assetById = new Map(assets.map((a) => [a.id, a]));
const today = new Date().toISOString().slice(0, 10);

const cash = accounts
.filter((a) => ["checking", "savings", "cash"].includes(a.account_type))
.reduce((sum, a) => sum + Number(a.current_balance), 0);

const portfolioValue = holdings.reduce((sum, h) => {
const asset = assetById.get(h.asset_id);
if (asset?.asset_type === "gold" && !includeJewelry) return sum;
const price = latestPrices[h.asset_id] ?? h.average_unit_cost;
return sum + h.quantity * price;
}, 0);

const tradePropertyValue = properties
.filter((p) => p.is_trade_intent)
.reduce((sum, p) => sum + Number(p.estimated_value), 0);

const totalAssets = cash + portfolioValue + tradePropertyValue;
const totalLiabilities = loans.reduce((sum, l) => sum + Number(l.monthly_installment), 0);
const netBase = Math.max(0, totalAssets - totalLiabilities);

const nisabValue = 85 * goldPricePerGram;
const isAboveNisab = netBase >= nisabValue;

const hawlComplete = hawlDateInput ? isHawlComplete(hawlDateInput, today) : false;
const completionDate = hawlDateInput ? hawlCompletionDate(hawlDateInput) : null;
const daysLeft = hawlDateInput ? daysUntilHawlCompletion(hawlDateInput, today) : null;

const isObligatory = isAboveNisab && hawlComplete;
const zakatDue = isObligatory ? netBase * 0.025 : 0;

const paymentsTotal = payments.reduce((sum, p) => sum + Number(p.amount), 0);
const remainingZakat = Math.max(0, zakatDue - paymentsTotal);

const items = useMemo(
() => [
{ label: "Nakit (Vadesiz/Vadeli/Nakit hesaplar)", value: cash },
{ label: "Portföy (altın/döviz/fon) piyasa değeri", value: portfolioValue },
{ label: "Ticaret niyetli gayrimenkul", value: tradePropertyValue },
],
[cash, portfolioValue, tradePropertyValue]
);

return (
<div className="flex flex-col gap-4">
<div>
<h1 className="text-xl font-semibold text-[var(--text-primary)]">Zekât</h1>
<p className="text-sm text-[var(--text-secondary)]">
Güncel varlıklarına göre canlı zekât hesaplaması (altın nisabı esas alınır).
</p>
</div>

<Card className="p-5">
<div className="flex flex-wrap items-center justify-between gap-4">
<div className="flex items-center gap-2">
<span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand)] text-white">
<HandCoins className="h-5 w-5" />
</span>
<div>
<p className="text-sm text-[var(--text-secondary)]">Kalan Zekât Borcu</p>
<p className="text-2xl font-semibold text-[var(--text-primary)]">
{formatCurrency(remainingZakat)}
</p>
{paymentsTotal > 0 && (
<p className="text-xs text-[var(--text-secondary)]">
Toplam {formatCurrency(zakatDue)} içinden {formatCurrency(paymentsTotal)} ödendi
</p>
)}
</div>
</div>
<div className="flex flex-col gap-2 text-sm">
<label className="flex items-center gap-2">
<Switch checked={includeJewelry} onCheckedChange={setIncludeJewelry} />
Ziynet eşyası (altın) matraha dahil edilsin
</label>
</div>
</div>

<div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
{items.map((item) => (
<div
key={item.label}
className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
>
<span className="text-[var(--text-secondary)]">{item.label}</span>
<span className="font-medium text-[var(--text-primary)]">
{formatCurrency(item.value)}
</span>
</div>
))}
<div className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
<span className="text-[var(--text-secondary)]">Düşülebilir borç (aylık taksitler)</span>
<span className="font-medium text-[var(--critical)]">
-{formatCurrency(totalLiabilities)}
</span>
</div>
</div>

<div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--surface-2)] p-3 text-sm">
<span className="text-[var(--text-secondary)]">
Net matrah: <strong className="text-[var(--text-primary)]">{formatCurrency(netBase)}</strong>
{" · "}Nisab (85gr altın): <strong className="text-[var(--text-primary)]">{formatCurrency(nisabValue)}</strong>
</span>
<span
className={`rounded-full px-2.5 py-1 text-xs font-medium ${
isAboveNisab
? "bg-[var(--good-bg)] text-[var(--good)]"
: "bg-[var(--surface-3)] text-[var(--text-secondary)]"
}`}
>
{isAboveNisab ? "Nisabın üzerinde" : "Nisabın altında"}
</span>
</div>

<div className="mt-4 flex flex-col gap-3 rounded-lg border border-[var(--border)] p-3">
<p className="text-sm font-medium text-[var(--text-primary)]">Havl (1 Hicri Yıl)</p>
<form action={setHawlStartDateAction} className="flex flex-wrap items-end gap-2">
<div className="flex flex-col gap-1.5">
<label htmlFor="hawlStartDate" className="text-xs text-[var(--text-secondary)]">
Servetin nisaba ulaştığı tarih
</label>
<Input
id="hawlStartDate"
name="hawlStartDate"
type="date"
value={hawlDateInput}
onChange={(e) => setHawlDateInput(e.target.value)}
className="h-9 w-44"
/>
</div>
<Button type="submit" size="sm" variant="secondary">
Kaydet
</Button>
</form>
{hawlDateInput ? (
<p className="text-xs text-[var(--text-secondary)]">
Hicri karşılığı: <strong>{hijriDateLabel(hawlDateInput)}</strong>
{" · "}
{hawlComplete ? (
<span className="text-[var(--good)]">
Havl {formatDate(completionDate!)} tarihinde tamamlandı - zekât farz.
</span>
) : (
<span>
Havl {formatDate(completionDate!)} tarihinde tamamlanacak (yaklaşık {daysLeft} gün
kaldı, Hicri: {hijriDateLabel(completionDate!)}).
</span>
)}
</p>
) : (
<p className="text-xs text-[var(--text-muted)]">
Tarih girilmezse zekât farz olma durumu MUHAFAZAKAR olarak &quot;tamamlanmadı&quot; kabul
edilir.
</p>
)}
</div>

<p className="mt-3 text-xs text-[var(--text-muted)]">
Not: Altın fiyatı manuel olarak Portföy sayfasından güncellenen son &quot;Gram Altın&quot;
fiyatı esas alınır (şu an {formatCurrency(goldPricePerGram)}/gr). Hicri tarih
dönüşümü tablo bazlı bir yaklaşık algoritma kullanır (~1 gün sapma olabilir);
kesinlik gerektiren durumlarda Diyanet takvimiyle teyit edin.
</p>
</Card>

<Card>
<CardHeader className="flex-row items-center justify-between">
<CardTitle className="!text-base !font-semibold text-[var(--text-primary)]">
Bu Yıl Yapılan Zekât Ödemeleri
</CardTitle>
<ZakatPaymentDialog />
</CardHeader>
<CardContent className="pt-0">
{payments.length === 0 ? (
<p className="py-6 text-center text-sm text-[var(--text-secondary)]">
Henüz zekât ödemesi eklenmedi.
</p>
) : (
<div className="flex flex-col divide-y divide-[var(--border)]">
{payments.map((p) => (
<div key={p.id} className="flex items-center justify-between gap-2 py-3">
<div>
<p className="text-sm font-medium text-[var(--text-primary)]">
{p.recipient || "Belirtilmedi"}
</p>
<p className="text-xs text-[var(--text-secondary)]">
{formatDate(p.payment_date)}
{p.notes ? ` · ${p.notes}` : ""}
</p>
</div>
<div className="flex items-center gap-2">
<p className="text-sm font-medium text-[var(--text-primary)]">
{formatCurrency(p.amount)}
</p>
<form action={deleteZakatPaymentAction}>
<input type="hidden" name="id" value={p.id} />
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

<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
<Card>
<CardHeader className="flex-row items-center justify-between">
<CardTitle className="!text-base !font-semibold text-[var(--text-primary)]">
Gayrimenkuller
</CardTitle>
<PropertyDialog />
</CardHeader>
<CardContent className="pt-0">
{properties.length === 0 ? (
<p className="py-6 text-center text-sm text-[var(--text-secondary)]">
Henüz gayrimenkul eklenmedi.
</p>
) : (
<div className="flex flex-col divide-y divide-[var(--border)]">
{properties.map((p) => (
<div key={p.id} className="flex items-center justify-between gap-2 py-3">
<div className="flex items-center gap-3">
<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)]">
<Home className="h-4 w-4" />
</span>
<div>
<p className="text-sm font-medium text-[var(--text-primary)]">
{p.name}
</p>
<p className="text-xs text-[var(--text-secondary)]">
{PROPERTY_TYPE_LABELS[p.property_type]}
{p.is_trade_intent && " · Zekâta tabi"}
</p>
</div>
</div>
<div className="flex items-center gap-2">
<p className="text-sm font-medium text-[var(--text-primary)]">
{formatCurrency(p.estimated_value)}
</p>
<PropertyDialog property={p} />
<form action={deletePropertyAction}>
<input type="hidden" name="id" value={p.id} />
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

<Card>
<CardHeader className="flex-row items-center justify-between">
<CardTitle className="!text-base !font-semibold text-[var(--text-primary)]">
Krediler / Borçlar
</CardTitle>
<LoanDialog />
</CardHeader>
<CardContent className="pt-0">
{loans.length === 0 ? (
<p className="py-6 text-center text-sm text-[var(--text-secondary)]">
Henüz kredi/borç eklenmedi.
</p>
) : (
<div className="flex flex-col divide-y divide-[var(--border)]">
{loans.map((l) => (
<div key={l.id} className="flex items-center justify-between gap-2 py-3">
<div className="flex items-center gap-3">
<span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--text-secondary)]">
<Landmark className="h-4 w-4" />
</span>
<div>
<p className="text-sm font-medium text-[var(--text-primary)]">
{l.name}
</p>
<p className="text-xs text-[var(--text-secondary)]">
{LOAN_TYPE_LABELS[l.loan_type]} · Bitiş {l.end_date}
</p>
</div>
</div>
<div className="flex items-center gap-2">
<div className="text-right">
<p className="text-sm font-medium text-[var(--text-primary)]">
{formatCurrency(l.monthly_installment)}/ay
</p>
<p className="text-xs text-[var(--text-muted)]">
Kalan: {formatCurrency(l.total_remaining)}
</p>
</div>
<LoanDialog loan={l} />
<form action={deleteLoanAction}>
<input type="hidden" name="id" value={l.id} />
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
</div>
);
}
