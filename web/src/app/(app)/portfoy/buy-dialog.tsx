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

export function BuyDialog({ assets, accounts }: { assets: Asset[]; accounts: Account[] }) {
  const [open, setOpen] = useState(false);

  async function handleSubmit(formData: FormData) {
    await buyAssetAction(formData);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Alım Ekle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni Alım (Lot) Ekle</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="assetId">Varlık</Label>
            <Select name="assetId" defaultValue={assets[0]?.id}>
              <SelectTrigger id="assetId">
                <SelectValue placeholder="Varlık seç" />
              </SelectTrigger>
              <SelectContent>
                {assets.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accountId">Yatırım Hesabı</Label>
            <Select name="accountId" defaultValue={accounts[0]?.id}>
              <SelectTrigger id="accountId">
                <SelectValue placeholder="Hesap seç" />
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
              <Label htmlFor="unitPrice">Birim Fiyat (₺)</Label>
              <Input id="unitPrice" name="unitPrice" type="number" step="0.01" min="0" required />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transactionDate">Alım Tarihi</Label>
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
            <Button type="submit" disabled={assets.length === 0 || accounts.length === 0}>
              Ekle
            </Button>
          </DialogFooter>
          {accounts.length === 0 && (
            <p className="text-xs text-[var(--critical)]">
              Önce Hesaplar sayfasından bir yatırım hesabı eklemelisin.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
