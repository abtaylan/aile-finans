"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { upsertDebtAction } from "./actions";
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
import type { Loan } from "@/lib/types/database";

const TYPE_LABELS: Record<string, string> = {
konut_kredisi: "Konut Kredisi",
tasit_kredisi: "Tasit Kredisi",
ihtiyac_kredisi: "Ihtiyac Kredisi",
kredi_karti_borcu: "Kredi Karti Borcu",
kisisel_borc: "Kisisel Borc",
diger: "Diger",
};

export function DebtDialog({ debt }: { debt?: Loan }) {
const [open, setOpen] = useState(false);
const [isActive, setIsActive] = useState(debt?.is_active ?? true);
const isEdit = Boolean(debt);

async function handleSubmit(formData: FormData) {
await upsertDebtAction(formData);
setOpen(false);
}

return (
<Dialog open={open} onOpenChange={setOpen}>
<DialogTrigger asChild>
{isEdit ? (
<Button variant="ghost" size="icon" aria-label="Duzenle">
<Pencil className="h-4 w-4" />
</Button>
) : (
<Button variant="secondary">
<Plus className="h-4 w-4" />
Borc Ekle
</Button>
)}
</DialogTrigger>
<DialogContent>
<DialogHeader>
<DialogTitle>{isEdit ? "Borcu Duzenle" : "Yeni Borc"}</DialogTitle>
</DialogHeader>
<form action={handleSubmit} className="flex flex-col gap-4">
{debt && <input type="hidden" name="id" value={debt.id} />}
<div className="grid grid-cols-2 gap-3">
<div className="flex flex-col gap-1.5">
<Label htmlFor="name">Ad</Label>
<Input id="name" name="name" defaultValue={debt?.name} placeholder="Orn. Konut Kredisi" required />
</div>
<div className="flex flex-col gap-1.5">
<Label htmlFor="loanType">Tur</Label>
<Select name="loanType" defaultValue={debt?.loan_type ?? "ihtiyac_kredisi"}>
<SelectTrigger id="loanType">
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
</div>
<div className="flex flex-col gap-1.5">
<Label htmlFor="lenderName">Alacakli / Kurum</Label>
<Input
id="lenderName"
name="lenderName"
defaultValue={debt?.lender_name ?? ""}
placeholder="Orn. Ziraat Bankasi, kisi adi..."
/>
</div>
<div className="grid grid-cols-2 gap-3">
<div className="flex flex-col gap-1.5">
<Label htmlFor="principalAmount">Ana Para (TL)</Label>
<Input
id="principalAmount"
name="principalAmount"
type="number"
step="0.01"
defaultValue={debt?.principal_amount ?? ""}
/>
</div>
<div className="flex flex-col gap-1.5">
<Label htmlFor="totalRemaining">Kalan Toplam Borc (TL)</Label>
<Input
id="totalRemaining"
name="totalRemaining"
type="number"
step="0.01"
defaultValue={debt?.total_remaining ?? ""}
required
/>
</div>
</div>
<div className="flex flex-col gap-1.5">
<Label htmlFor="monthlyInstallment">Aylik Taksit (TL)</Label>
<Input
id="monthlyInstallment"
name="monthlyInstallment"
type="number"
step="0.01"
defaultValue={debt?.monthly_installment ?? ""}
required
/>
</div>
<div className="grid grid-cols-2 gap-3">
<div className="flex flex-col gap-1.5">
<Label htmlFor="startDate">Baslangic Tarihi</Label>
<Input id="startDate" name="startDate" type="date" defaultValue={debt?.start_date} required />
</div>
<div className="flex flex-col gap-1.5">
<Label htmlFor="endDate">Bitis Tarihi</Label>
<Input id="endDate" name="endDate" type="date" defaultValue={debt?.end_date} required />
</div>
</div>
<div className="flex flex-col gap-1.5">
<Label htmlFor="notes">Not</Label>
<Input id="notes" name="notes" defaultValue={debt?.notes ?? ""} />
</div>
<label className="flex items-center gap-2 text-sm">
<Switch checked={isActive} onCheckedChange={setIsActive} />
Borc hala devam ediyor
</label>
<input type="hidden" name="isActive" value={isActive ? "on" : ""} />
<DialogFooter>
<Button type="submit">{isEdit ? "Kaydet" : "Ekle"}</Button>
</DialogFooter>
</form>
</DialogContent>
</Dialog>
);
}
