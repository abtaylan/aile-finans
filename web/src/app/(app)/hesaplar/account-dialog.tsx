"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { upsertAccountAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AmountInput } from "@/components/ui/amount-input";
import {
Dialog,
DialogContent,
DialogHeader,
DialogTitle,
DialogFooter,
DialogTrigger,
} from "@/components/ui/dialog";
import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";
import { TURKISH_BANKS, getBankBadge } from "@/lib/banks";
import type { Account, AccountType, Asset, AssetType } from "@/lib/types/database";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
checking: "Vadesiz Hesap",
savings: "Vadeli Hesap",
credit_card: "Kredi Kartı",
cash: "Nakit",
investment: "Yatırım Hesabı",
loan: "Kredi Hesabı",
};

const ASSET_CATEGORY_LABELS: Record<AssetType, string> = {
gold: "Altın",
silver: "Gümüş",
currency: "Döviz",
crypto: "Kripto Para",
stock: "Borsa / Hisse Senedi",
tefas_fund: "Yatırım Fonu (TEFAS)",
other: "Diğer",
};

// Vadesiz Hesap / Nakit turlerinde secilebilen para birimleri (Gereksinim
// v1, madde 9-10). XAU/XAG = gram bazli altin/gumus (bkz. lib/utils.ts).
const CURRENCY_OPTIONS: { value: string; label: string }[] = [
{ value: "TRY", label: "Türk Lirası (TL)" },
{ value: "USD", label: "Amerikan Doları (USD)" },
{ value: "EUR", label: "Euro (EUR)" },
{ value: "GBP", label: "İngiliz Sterlini (GBP)" },
{ value: "XAU", label: "Altın (gram)" },
{ value: "XAG", label: "Gümüş (gram)" },
];
const CURRENCY_UNIT_LABELS: Record<string, string> = {
USD: "USD",
EUR: "EUR",
GBP: "GBP",
XAU: "gram Altın",
XAG: "gram Gümüş",
};
const MULTI_CURRENCY_TYPES: AccountType[] = ["checking", "cash"];

const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#4a3aa7"];

export function AccountDialog({ account, assets = [] }: { account?: Account; assets?: Asset[] }) {
const [open, setOpen] = useState(false);
const [accountType, setAccountType] = useState<AccountType>(account?.account_type ?? "checking");
const [assetCategory, setAssetCategory] = useState<AssetType>("gold");
const [currency, setCurrency] = useState<string>(account?.currency ?? "TRY");
const isEdit = Boolean(account);
const isMultiCurrencyType = MULTI_CURRENCY_TYPES.includes(accountType);

const knownBankNames = useMemo(() => new Set(TURKISH_BANKS.map((b) => b.name)), []);
const [bankChoice, setBankChoice] = useState<string>(() => {
if (!account?.bank_name) return "__none__";
return knownBankNames.has(account.bank_name) ? account.bank_name : "__other__";
});
const [manualBank, setManualBank] = useState<string>(() =>
account?.bank_name && !knownBankNames.has(account.bank_name) ? account.bank_name : ""
);
const bankBadge =
bankChoice === "__other__"
? getBankBadge(manualBank)
: bankChoice === "__none__"
? null
: getBankBadge(bankChoice);

const categoryAssets = useMemo(
() => assets.filter((a) => a.asset_type === assetCategory),
[assets, assetCategory]
);

async function handleSubmit(formData: FormData) {
await upsertAccountAction(formData);
setOpen(false);
}

return (
<Dialog open={open} onOpenChange={setOpen}>
<DialogTrigger asChild>
{isEdit ? (
<Button variant="ghost" size="icon" aria-label="Düzenle">
<Pencil className="h-4 w-4" />
</Button>
) : (
<Button>
<Plus className="h-4 w-4" />
Hesap Ekle
</Button>
)}
</DialogTrigger>
<DialogContent>
<DialogHeader>
<DialogTitle>{isEdit ? "Hesabı Düzenle" : "Yeni Hesap Ekle"}</DialogTitle>
</DialogHeader>
<form action={handleSubmit} className="flex flex-col gap-4">
{account && <input type="hidden" name="id" value={account.id} />}
<div className="flex flex-col gap-1.5">
<Label htmlFor="name">Hesap Adı</Label>
<Input
id="name"
name="name"
defaultValue={account?.name}
placeholder="Örn. Ana Vadesiz Hesap"
required
/>
</div>
<div className="grid grid-cols-2 gap-3">
<div className="flex flex-col gap-1.5">
<Label htmlFor="bankChoice">Banka / Kurum</Label>
<Select value={bankChoice} onValueChange={setBankChoice}>
<SelectTrigger id="bankChoice">
<SelectValue />
</SelectTrigger>
<SelectContent>
<SelectItem value="__none__">Seçilmedi</SelectItem>
{TURKISH_BANKS.map((b) => (
<SelectItem key={b.name} value={b.name}>
{b.name}
</SelectItem>
))}
<SelectItem value="__other__">Diğer (elle gir)...</SelectItem>
</SelectContent>
</Select>
{bankChoice === "__other__" ? (
<Input
name="bankName"
value={manualBank}
onChange={(e) => setManualBank(e.target.value)}
placeholder="Örn. Ev, Yurtdışı, Arkadaşta emanet..."
className="mt-1.5"
/>
) : (
<input type="hidden" name="bankName" value={bankChoice === "__none__" ? "" : bankChoice} />
)}
{bankBadge && (
<div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
<span
className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
style={{ backgroundColor: bankBadge.color }}
>
{bankBadge.abbr}
</span>
{bankBadge.name}
</div>
)}
</div>
<div className="flex flex-col gap-1.5">
<Label htmlFor="accountType">Hesap Türü</Label>
<Select
name="accountType"
value={accountType}
onValueChange={(v) => setAccountType(v as AccountType)}
>
<SelectTrigger id="accountType">
<SelectValue />
</SelectTrigger>
<SelectContent>
{Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
<SelectItem key={value} value={value}>
{label}
</SelectItem>
))}
</SelectContent>
</Select>
</div>
</div>

{accountType === "investment" ? (
isEdit ? (
<div className="rounded-lg border border-[var(--border)] p-3 text-sm text-[var(--text-secondary)]">
Yatırım hesabındaki pozisyonlar (altın, döviz, hisse, fon vb.){" "}
<Link href="/portfoy" className="underline">
Portföy
</Link>{" "}
sayfasından eklenip yönetilir. Buradan yalnızca hesabın adı, banka/kurum
bilgisi ve notu güncellenebilir.
</div>
) : (
<div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] p-3">
<p className="text-xs font-medium text-[var(--text-secondary)]">
Yatırım hesabı - isteğe bağlı olarak açılış pozisyonunu hemen ekleyebilirsin
(altın, gümüş, döviz, kripto para, borsa hissesi...). Boş bırakırsan hesap
pozisyonsuz açılır, sonra Portföy sayfasından ekleyebilirsin.
</p>
<div className="grid grid-cols-2 gap-3">
<div className="flex flex-col gap-1.5">
<Label htmlFor="assetCategory">Varlık Türü</Label>
<Select value={assetCategory} onValueChange={(v) => setAssetCategory(v as AssetType)}>
<SelectTrigger id="assetCategory">
<SelectValue />
</SelectTrigger>
<SelectContent>
{(Object.entries(ASSET_CATEGORY_LABELS) as [AssetType, string][]).map(
([value, label]) => (
<SelectItem key={value} value={value}>
{label}
</SelectItem>
)
)}
</SelectContent>
</Select>
</div>
<div className="flex flex-col gap-1.5">
<Label htmlFor="assetId">Sembol</Label>
{assetCategory === "other" || categoryAssets.length === 0 ? (
<Input
id="newAssetName"
name="newAssetName"
placeholder="Örn. Aile Halısı, Özel Koleksiyon..."
/>
) : (
<Select name="assetId" defaultValue={categoryAssets[0]?.id}>
<SelectTrigger id="assetId">
<SelectValue />
</SelectTrigger>
<SelectContent>
{categoryAssets.map((a) => (
<SelectItem key={a.id} value={a.id}>
{a.name}
</SelectItem>
))}
</SelectContent>
</Select>
)}
</div>
</div>
<div className="grid grid-cols-2 gap-3">
<div className="flex flex-col gap-1.5">
<Label htmlFor="openingQuantity">Miktar</Label>
<AmountInput id="openingQuantity" name="openingQuantity" placeholder="Boş = pozisyonsuz" />
</div>
<div className="flex flex-col gap-1.5">
<Label htmlFor="openingUnitPrice">Birim Fiyat (TL)</Label>
<AmountInput
id="openingUnitPrice"
name="openingUnitPrice"
placeholder="Döviz için TCMB satış kuru"
/>
</div>
</div>
</div>
)
) : (
<div className="flex flex-col gap-3">
{isMultiCurrencyType && (
<div className="flex flex-col gap-1.5">
<Label htmlFor="currency">Para Birimi / Varlık</Label>
<Select name="currency" value={currency} onValueChange={setCurrency}>
<SelectTrigger id="currency">
<SelectValue />
</SelectTrigger>
<SelectContent>
{CURRENCY_OPTIONS.map((c) => (
<SelectItem key={c.value} value={c.value}>
{c.label}
</SelectItem>
))}
</SelectContent>
</Select>
</div>
)}
<div className="grid grid-cols-2 gap-3">
<div className="flex flex-col gap-1.5">
<Label htmlFor="currentBalance">
Güncel Bakiye
{isMultiCurrencyType && currency !== "TRY" ? ` (${CURRENCY_UNIT_LABELS[currency]})` : ""}
</Label>
<AmountInput
id="currentBalance"
name="currentBalance"
defaultValue={account?.current_balance ?? 0}
/>
</div>
{accountType === "credit_card" && (
<div className="flex flex-col gap-1.5">
<Label htmlFor="creditLimit">Kredi Limiti (opsiyonel)</Label>
<AmountInput id="creditLimit" name="creditLimit" defaultValue={account?.credit_limit ?? ""} />
</div>
)}
</div>
{isMultiCurrencyType && currency !== "TRY" && (
<div className="flex flex-col gap-1.5">
<Label htmlFor="tryEquivalentAmount">
Bankanızın Güncel Kuruyla TL Karşılığı (opsiyonel)
</Label>
<AmountInput
id="tryEquivalentAmount"
name="tryEquivalentAmount"
defaultValue={account?.try_equivalent_amount ?? ""}
placeholder="Örn. 45.000"
/>
</div>
)}
</div>
)}

<div className="flex flex-col gap-1.5">
<Label htmlFor="iban">IBAN (opsiyonel)</Label>
<Input id="iban" name="iban" defaultValue={account?.iban ?? ""} />
</div>
<div className="flex flex-col gap-1.5">
<Label htmlFor="notes">Not / Açıklama (opsiyonel)</Label>
<Textarea
id="notes"
name="notes"
defaultValue={account?.notes ?? ""}
placeholder="Bu hesapla ilgili kısa bir not..."
/>
</div>
<div className="flex flex-col gap-1.5">
<Label>Renk</Label>
<div className="flex gap-2">
{PALETTE.map((c) => (
<label key={c} className="cursor-pointer">
<input
type="radio"
name="color"
value={c}
defaultChecked={(account?.color ?? PALETTE[0]) === c}
className="peer sr-only"
/>
<span
className="block h-7 w-7 rounded-full ring-offset-2 peer-checked:ring-2"
style={{ backgroundColor: c }}
/>
</label>
))}
</div>
</div>
<DialogFooter>
<Button type="submit">{isEdit ? "Kaydet" : "Ekle"}</Button>
</DialogFooter>
</form>
</DialogContent>
</Dialog>
);
}
