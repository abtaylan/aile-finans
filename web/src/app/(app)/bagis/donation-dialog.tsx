"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { upsertDonationAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import type { Donation } from "@/lib/types/database";

const TYPE_LABELS: Record<string, string> = {
bagis: "Bağış",
sadaka: "Sadaka",
fitre: "Fitre",
kurban: "Kurban",
diger: "Diğer",
};

export function DonationDialog({ donation }: { donation?: Donation }) {
const [open, setOpen] = useState(false);
const [countsTowardZakat, setCountsTowardZakat] = useState(donation?.counts_toward_zakat ?? false);
const isEdit = Boolean(donation);

async function handleSubmit(formData: FormData) {
await upsertDonationAction(formData);
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
<Button variant="secondary">
<Plus className="h-4 w-4" />
Bağış / Sadaka Ekle
</Button>
)}
</DialogTrigger>
<DialogContent>
<DialogHeader>
<DialogTitle>{isEdit ? "Kaydı Düzenle" : "Yeni Bağış / Sadaka"}</DialogTitle>
</DialogHeader>
<form action={handleSubmit} className="flex flex-col gap-4">
{donation && <input type="hidden" name="id" value={donation.id} />}
<div className="grid grid-cols-2 gap-3">
<div className="flex flex-col gap-1.5">
<Label htmlFor="donationType">Tür</Label>
<Select name="donationType" defaultValue={donation?.donation_type ?? "sadaka"}>
<SelectTrigger id="donationType">
<SelectValue />
</SelectTrigger>
<SelectContent>
{Object.entries(TYPE_LABELS).map(([value, label]) => (
<SelectItem key={value} value={value}>
{label}
</SelectItem>
))}
</SelectContent>
</Select>
</div>
<div className="flex flex-col gap-1.5">
<Label htmlFor="amount">Tutar (TL)</Label>
<Input
id="amount"
name="amount"
type="number"
step="0.01"
defaultValue={donation?.amount ?? ""}
required
/>
</div>
</div>
<div className="flex flex-col gap-1.5">
<Label htmlFor="recipient">Kime Verildi</Label>
<Input
id="recipient"
name="recipient"
defaultValue={donation?.recipient}
placeholder="Örn. Kızılay, komşu Ahmet Bey, cami inşaatı..."
required
/>
</div>
<div className="flex flex-col gap-1.5">
<Label htmlFor="description">Açıklama</Label>
<Input
id="description"
name="description"
defaultValue={donation?.description ?? ""}
placeholder="İsteğe bağlı not"
/>
</div>
<div className="flex flex-col gap-1.5">
<Label htmlFor="donationDate">Tarih</Label>
<Input
id="donationDate"
name="donationDate"
type="date"
defaultValue={donation?.donation_date}
required
/>
</div>
<label className="flex items-center gap-2 text-sm">
<Switch checked={countsTowardZakat} onCheckedChange={setCountsTowardZakat} />
Bu ödeme zekât borcumdan düşülsün
</label>
<input type="hidden" name="countsTowardZakat" value={countsTowardZakat ? "on" : ""} />
<DialogFooter>
<Button type="submit">{isEdit ? "Kaydet" : "Ekle"}</Button>
</DialogFooter>
</form>
</DialogContent>
</Dialog>
);
}
