"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { upsertAccountAction } from "./actions";
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
import type { Account } from "@/lib/types/database";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "Vadesiz Hesap",
  savings: "Vadeli Hesap",
  credit_card: "Kredi Kartı",
  cash: "Nakit",
  investment: "Yatırım Hesabı",
  loan: "Kredi Hesabı",
};

const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#4a3aa7"];

export function AccountDialog({ account }: { account?: Account }) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(account);

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
              <Label htmlFor="bankName">Banka</Label>
              <Input id="bankName" name="bankName" defaultValue={account?.bank_name ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="accountType">Hesap Türü</Label>
              <Select name="accountType" defaultValue={account?.account_type ?? "checking"}>
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
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currentBalance">Güncel Bakiye</Label>
              <Input
                id="currentBalance"
                name="currentBalance"
                type="number"
                step="0.01"
                defaultValue={account?.current_balance ?? 0}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="creditLimit">Kredi Limiti (opsiyonel)</Label>
              <Input
                id="creditLimit"
                name="creditLimit"
                type="number"
                step="0.01"
                defaultValue={account?.credit_limit ?? ""}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="iban">IBAN (opsiyonel)</Label>
            <Input id="iban" name="iban" defaultValue={account?.iban ?? ""} />
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
          <input type="hidden" name="currency" value={account?.currency ?? "TRY"} />
          <DialogFooter>
            <Button type="submit">{isEdit ? "Kaydet" : "Ekle"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
