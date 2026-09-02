"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { addZakatPaymentAction } from "./actions";
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

export function ZakatPaymentDialog() {
const [open, setOpen] = useState(false);

async function handleSubmit(formData: FormData) {
await addZakatPaymentAction(formData);
setOpen(false);
}

return (
<Dialog open={open} onOpenChange={setOpen}>
<DialogTrigger asChild>
<Button variant="secondary" size="sm">
<Plus className="h-4 w-4" />
Zekat Odemesi Ekle
</Button>
</DialogTrigger>
<DialogContent>
<DialogHeader>
<DialogTitle>Zekat Odemesi Ekle</DialogTitle>
</DialogHeader>
<form action={handleSubmit} className="flex flex-col gap-4">
<div className="flex flex-col gap-1.5">
<Label htmlFor="amount">Tutar (TL)</Label>
<Input id="amount" name="amount" type="number" step="0.01" required />
</div>
<div className="flex flex-col gap-1.5">
<Label htmlFor="recipient">Kime Odendi</Label>
<Input id="recipient" name="recipient" placeholder="Orn. Kizilay" />
</div>
<div className="flex flex-col gap-1.5">
<Label htmlFor="paymentDate">Tarih</Label>
<Input
id="paymentDate"
name="paymentDate"
type="date"
defaultValue={new Date().toISOString().slice(0, 10)}
required
/>
</div>
<div className="flex flex-col gap-1.5">
<Label htmlFor="notes">Not</Label>
<Input id="notes" name="notes" />
</div>
<p className="text-xs text-[var(--text-secondary)]">
Bu odeme, bu yil icin odenmesi gereken toplam zekattan otomatik dusulur.
</p>
<DialogFooter>
<Button type="submit">Ekle</Button>
</DialogFooter>
</form>
</DialogContent>
</Dialog>
);
}
