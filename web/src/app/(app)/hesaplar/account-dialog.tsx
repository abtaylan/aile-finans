"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { upsertAccountAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AmountInput } from "@/components/ui/amount-input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TURKISH_BANKS } from "@/lib/banks";
import { parseTLNumber, formatNumberForInput } from "@/lib/utils";
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

const CURRENCY_LABELS: Record<string, string> = {
  TRY: "Türk Lirası (TL)",
  USD: "Amerikan Doları (USD)",
  EUR: "Euro (EUR)",
  GBP: "İngiliz Sterlini (GBP)",
  XAU: "Altın (gram)",
  XAG: "Gümüş (gram)",
};

const MULTI_CURRENCY_TYPES: AccountType[] = ["checking", "cash"];
const OTHER_BANK = "__other__";
const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#4a3aa7"];

export function AccountDialog({ account, assets = [] }: { account?: Account; assets?: Asset[] }) {
  const [open, setOpen] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>(account?.account_type ?? "checking");
  const [assetCategory, setAssetCategory] = useState<AssetType>("gold");

const knownBank = account?.bank_name
  ? TURKISH_BANKS.some((b) => b.name === account.bank_name)
  ? account.bank_name
  : OTHER_BANK
  : "";
  const [bankChoice, setBankChoice] = useState(knownBank);
  const [otherBankName, setOtherBankName] = useState(
    knownBank === OTHER_BANK ? account?.bank_name ?? "" : ""
    );

const [currency, setCurrency] = useState(account?.currency?.trim() || "TRY");
  const [balanceInput, setBalanceInput] = useState(
    formatNumberForInput(account?.current_balance ?? "")
    );
  const [fxRateInput, setFxRateInput] = useState(formatNumberForInput(account?.fx_rate ?? ""));

const isEdit = Boolean(account);
  const showCurrency = MULTI_CURRENCY_TYPES.includes(accountType);
  const needsFxRate = showCurrency && currency !== "TRY";

const tryEquivalent = useMemo(() => {
  if (!needsFxRate) return null;
  const balance = parseTLNumber(balanceInput);
  const rate = parseTLNumber(fxRateInput);
  if (!balance || !rate) return null;
  return balance * rate;
}, [needsFxRate, balanceInput, fxRateInput]);

const categoryAssets = useMemo(
  () => assets.filter((a) => a.asset_type === assetCategory),
  [assets, assetCategory]
  );

async function handleSubmit(formData: FormData) {
  const finalBankName = bankChoice === OTHER_BANK ? otherBankName.trim() : bankChoice;
  formData.set("bankName", finalBankName);
  if (tryEquivalent != null) {
    formData.set("tryEquivalentAmount", String(tryEquivalent));
  }
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
  <DialogContent className="max-h-[90vh] overflow-y-auto">
  <DialogHeader>
  <DialogTitle>{isEdit ? "Hesabı Düzenle" : "Yeni Hesap Ekle"}</DialogTitle>
  </DialogHeader>
  <form action={handleSubmit} className="flex flex-col gap-4">
    {account && <input type="hidden" name="id" value={account.id} />}
  <div className="flex flex-col gap-1.5">
  <Label htmlFor="name">Hesap Adı</Label>
  <Input id="name" name="name" defaultValue={account?.name} placeholder="Örn. Ana Vadesiz Hesap" required />
  </div>
  </DialogTrigger>
    <div className="grid grid-cols-2 gap-3">
    <div className="flex flex-col gap-1.5">
    <Label htmlFor="bankChoice">Banka / Kurum</Label>
    <Select value={bankChoice} onValueChange={setBankChoice}>
    <SelectTrigger id="bankChoice">
    <SelectValue placeholder="Seçiniz" />
    </SelectTrigger>
    <SelectContent>
      {TURKISH_BANKS.map((b) => (
    <SelectItem key={b.name} value={b.name}>
      {b.name}
    </SelectItem>
    ))}
    <SelectItem value={OTHER_BANK}>Diğer...</SelectItem>
    </SelectContent>
    </Select>
      {bankChoice === OTHER_BANK && (
    <Input className="mt-1.5" placeholder="Kurum adını yaz (Örn. Ev, Yurtdışı Hesabı)" value={otherBankName} onChange={(e) => setOtherBankName(e.target.value)} />
    )}
    </div>
    <div className="flex flex-col gap-1.5">
    <Label htmlFor="accountType">Hesap Türü</Label>
    <Select name="accountType" value={accountType} onValueChange={(v) => setAccountType(v as AccountType)}>
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
  
    {showCurrency && (
    <div className="grid grid-cols-2 gap-3">
    <div className="flex flex-col gap-1.5">
    <Label htmlFor="currency">Para Birimi</Label>
    <Select name="currency" value={currency} onValueChange={setCurrency}>
    <SelectTrigger id="currency">
    <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {Object.entries(CURRENCY_LABELS).map(([value, label]) => (
      <SelectItem key={value} value={value}>
        {label}
      </SelectItem>
      ))}
    </SelectContent>
    </Select>
    </div>
    <div className="flex flex-col gap-1.5">
    <Label htmlFor="currentBalance">{currency === "XAU" || currency === "XAG" ? "Miktar (gram)" : "Bakiye"}</Label>
    <AmountInput id="currentBalance" name="currentBalance" value={balanceInput} onChange={(e) => setBalanceInput(e.target.value)} required />
    </div>
    </div>
  )}
  
    {needsFxRate && (
    <div className="rounded-lg border border-[var(--border)] p-3">
    <div className="grid grid-cols-2 gap-3">
    <div className="flex flex-col gap-1.5">
    <Label htmlFor="fxRate">Bankanızın Güncel Kuruyla TL Karşılığı — Döviz Kuru Satış Fiyatı</Label>
    <AmountInput id="fxRate" name="fxRate" value={fxRateInput} onChange={(e) => setFxRateInput(e.target.value)} placeholder="Örn. 34,50" required />
    </div>
    <div className="flex flex-col gap-1.5">
    <Label>Hesaplanan Toplam TL Karşılığı</Label>
    <div className="flex h-9 items-center rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm font-medium text-[var(--text-primary)]">
      {tryEquivalent != null ? tryEquivalent.toLocaleString("tr-TR", { style: "currency", currency: "TRY" }) : "—"}
    </div>
    </div>
    </div>
    <p className="mt-2 text-xs text-[var(--text-secondary)]">
    1 {currency === "XAU" ? "gram altın" : currency === "XAG" ? "gram gümüş" : currency} kaç TL ediyorsa (bankanızın satış kuru) onu girin — toplam TL karşılığı otomatik hesaplanır.
    </p>
    </div>
  )}
  
    {!showCurrency && accountType !== "investment" && (
    <div className="flex flex-col gap-1.5">
    <Label htmlFor="currentBalance">Güncel Bakiye</Label>
    <AmountInput id="currentBalance" name="currentBalance" value={balanceInput} onChange={(e) => setBalanceInput(e.target.value)} />
    </div>
  )}
  
    {accountType === "credit_card" && (
    <div className="flex flex-col gap-1.5">
    <Label htmlFor="creditLimit">Kredi Limiti</Label>
    <AmountInput id="creditLimit" name="creditLimit" defaultValue={account?.credit_limit} />
    </div>
  )}
  
    {accountType === "investment" && !isEdit && (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] p-3">
    <p className="text-xs font-medium text-[var(--text-secondary)]">
    Yatırım hesabı - isteğe bağlı olarak açılış pozisyonunu hemen ekleyebilirsin (altın, gümüş, döviz, kripto para, borsa hissesi...). Boş bırakırsan hesap pozisyonsuz açılır, sonra Portföy sayfasından ekleyebilirsin.
    </p>
    <div className="grid grid-cols-2 gap-3">
    <div className="flex flex-col gap-1.5">
    <Label htmlFor="assetCategory">Varlık Türü</Label>
    <Select value={assetCategory} onValueChange={(v) => setAssetCategory(v as AssetType)}>
    <SelectTrigger id="assetCategory">
    <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {(Object.entries(ASSET_CATEGORY_LABELS) as [AssetType, string][]).map(([value, label]) => (
      <SelectItem key={value} value={value}>
        {label}
      </SelectItem>
      ))}
    </SelectContent>
    </Select>
    </div>
    <div className="flex flex-col gap-1.5">
    <Label htmlFor="assetId">Sembol</Label>
      {assetCategory === "other" || categoryAssets.length === 0 ? (
      <Input id="newAssetName" name="newAssetName" placeholder="Örn. Aile Halısı, Özel Koleksiyon..." />
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
    <AmountInput id="openingUnitPrice" name="openingUnitPrice" placeholder="Döviz için TCMB satış kuru" />
    </div>
    </div>
    </div>
  )}
    {accountType === "investment" && isEdit && (
    <p className="text-sm text-[var(--text-secondary)]">
    Pozisyonlar Portföy sayfasından yönetilir — bu formdan yalnızca hesap adı, banka/kurum ve rengi değiştirebilirsin.
    </p>
  )}
  
  <div className="flex flex-col gap-1.5">
  <Label htmlFor="iban">IBAN (opsiyonel)</Label>
  <Input id="iban" name="iban" defaultValue={account?.iban ?? ""} />
  </div>
  <div className="flex flex-col gap-1.5">
  <Label htmlFor="notes">Not / Açıklama (opsiyonel)</Label>
  <Input id="notes" name="notes" defaultValue={account?.notes ?? ""} />
  </div>
  
  <div className="flex flex-col gap-1.5">
  <Label>Renk</Label>
  <div className="flex gap-2">
    {PALETTE.map((c) => (
    <label key={c} className="cursor-pointer">
    <input type="radio" name="color" value={c} defaultChecked={(account?.color ?? PALETTE[0]) === c} className="peer sr-only" />
    <span className="block h-7 w-7 rounded-full ring-offset-2 peer-checked:ring-2" style={{ backgroundColor: c }} />
    </label>
    ))}
  </div>
  </div>
  <DialogFooter>
  <Button type="submit">{isEdit ? "Kaydet" : "Ekle"}</Button>
  </DialogFooter>
  </DialogContent>
  </Dialog>
  </Dialog>
  );
    }
  </div>
