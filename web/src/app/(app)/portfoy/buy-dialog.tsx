"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { buyAssetAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { Account, Asset } from "@/lib/types/database";

const NEW_ASSET_VALUE = "__new__";

export function BuyDialog({ assets, accounts }: { assets: Asset[]; accounts: Account[] }) {
const [open, setOpen] = useState(false);
const [assetId, setAssetId] = useState(assets[0]?.id ?? "");

async function handleSubmit(formData: FormData) {
await buyAssetAction(formData);
setOpen(false);
}

return (
<Dialog open={open} onOpenChange={setOpen}>
<DialogTrigger asChild>
<Button>
<Plus className="h-4 w-4" />
Alim Ekle
</Button>
</DialogTrigger>
<DialogContent>
<DialogHeader>
<DialogTitle>Yeni Alim (Lot) Ekle</DialogTitle>
</DialogHeader>
<form action={handleSubmit} className="flex flex-col gap-4">
<div className="flex flex-col gap-1.5">
<Label htmlFor="assetId">Varlik</Label>
<Select name="assetId" value={assetId} onValueChange={setAssetId}>
<SelectTrigger id="assetId">
<SelectValue placeholder="Varlik sec" />
</SelectTrigger>
<SelectContent>
{assets.map((a) => (
<SelectItem key={a.id} value={a.id}>
{a.name}
</SelectItem>
))}
<SelectItem value={NEW_ASSET_VALUE}>+ Diger (yeni varlik ekle)</SelectItem>
</SelectContent>
</Select>
</div>
{assetId === NEW_ASSET_VALUE && (
<div className="flex flex-col gap-1.5">
<Label htmlFor="newAssetName">Yeni Varligin Adi</Label>
<Input
id="newAssetName"
name="newAssetName"
placeholder="Orn. Aile Halisi, Ozel Koleksiyon..."
required
/>
</div>
)}
<div className="flex flex-col gap-1.5">
<Label htmlFor="accountId">Yatirim Hesabi</Label>
<Select name="accountId" defaultValue={accounts[0]?.id}>
<SelectTrigger id="accountId">
<SelectValue placeholder="Hesap sec" />
</SelectTrigger>
<SelectContent>
{accounts.map((a) => (
<SelectItem key={a.id} value={a.id}>
{a.name}
</SelectItem>
))}
</SelectContent>
</Select>
</div>
<div className="grid grid-cols-2 gap-3">
<div className="flex flex-col gap-1.5">
<Label htmlFor="quantity">Miktar</Label>
<Input id="quantity" name="quantity" type="number" step="0.00000001" min="0" required />
</div>
<div className="flex flex-col gap-1.5">
<Label htmlFor="unitPrice">Birim Fiyat (TL)</Label>
<Input id="unitPrice" name="unitPrice" type="number" step="0.01" min="0" required />
</div>
</div>
<div className="flex flex-col gap-1.5">
<Label htmlFor="transactionDate">Alim Tarihi</Label>
<Input
id="transactionDate"
name="transactionDate"
type="date"
defaultValue={new Date().toISOString().slice(0, 10)}
required
/>
</div>
<input type="hidden" name="costMethod" value="weighted_average" />
<DialogFooter>
<Button type="submit" disabled={accounts.length === 0}>
Ekle
</Button>
</DialogFooter>
{accounts.length === 0 && (
<p className="text-xs text-[var(--critical)]">
Once Hesaplar sayfasindan bir yatirim hesabi eklemelisin.
</p>
)}
</form>
</DialogContent>
</Dialog>
);
}
