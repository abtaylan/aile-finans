"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { upsertLoanAction } from "./actions";
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
import type { Loan } from "@/lib/types/database";

const TYPE_LABELS: Record<string, string> = {
  konut_kredisi: "Konut Kredisi",
  tasit_kredisi: "Taşıt Kredisi",
  ihtiyac_kredisi: "İhtiyaç Kredisi",
  kredi_karti_borcu: "Kredi Kartı Borcu",
  kisisel_borc: "Kişisel Borç",
  diger: "Diğer",
};

export function LoanDialog({ loan }: { loan?: Loan }) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(loan);

  async function handleSubmit(formData: FormData) {
    await upsertLoanAction(formData);
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
            Kredi / Borç Ekle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Krediyi Düzenle" : "Yeni Kredi / Borç"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          {loan && <input type="hidden" name="id" value={loan.id} />}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Ad</Label>
            <Input id="name" name="name" defaultValue={loan?.name} placeholder="Örn. Konut Kredisi" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="loanType">Tür</Label>
            <Select name="loanType" defaultValue={loan?.loan_type ?? "ihtiyac_kredisi"}>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="totalRemaining">Kalan Toplam Borç (₺)</Label>
              <Input
                id="totalRemaining"
                name="totalRemaining"
                type="number"
                step="0.01"
                defaultValue={loan?.total_remaining ?? ""}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="monthlyInstallment">Aylık Taksit (₺)</Label>
              <Input
                id="monthlyInstallment"
                name="monthlyInstallment"
                type="number"
                step="0.01"
                defaultValue={loan?.monthly_installment ?? ""}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startDate">Başlangıç Tarihi</Label>
              <Input id="startDate" name="startDate" type="date" defaultValue={loan?.start_date} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="endDate">Bitiş Tarihi</Label>
              <Input id="endDate" name="endDate" type="date" defaultValue={loan?.end_date} required />
            </div>
          </div>
          <p className="text-xs text-[var(--text-secondary)]">
            Zekât matrahından yalnızca aylık taksit tutarı düşülür — fıkhen sadece vadesi
            gelen borç indirilebilir, kalan toplam bakiye değil.
          </p>
          <DialogFooter>
            <Button type="submit">{isEdit ? "Kaydet" : "Ekle"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
