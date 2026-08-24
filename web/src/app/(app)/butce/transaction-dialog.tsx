"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { upsertTransactionAction } from "./actions";
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
import type { Account, Category, Transaction } from "@/lib/types/database";

export function TransactionDialog({
  accounts,
  categories,
  transaction,
}: {
  accounts: Account[];
  categories: Category[];
  transaction?: Transaction;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"income" | "expense">(
    (transaction?.type as "income" | "expense") ?? "expense"
  );
  const isEdit = Boolean(transaction);
  const filteredCategories = categories.filter((c) => c.type === type);

  async function handleSubmit(formData: FormData) {
    await upsertTransactionAction(formData);
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
            Kalem Ekle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Kalemi Düzenle" : "Yeni Gelir / Gider Kalemi"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          {transaction && <input type="hidden" name="id" value={transaction.id} />}

          <div className="flex flex-col gap-1.5">
            <Label>Tür</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType("expense")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                  type === "expense"
                    ? "border-[var(--critical)] bg-[var(--critical-bg)] text-[var(--critical)]"
                    : "border-[var(--border)] text-[var(--text-secondary)]"
                }`}
              >
                Gider
              </button>
              <button
                type="button"
                onClick={() => setType("income")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                  type === "income"
                    ? "border-[var(--good)] bg-[var(--good-bg)] text-[var(--good)]"
                    : "border-[var(--border)] text-[var(--text-secondary)]"
                }`}
              >
                Gelir
              </button>
            </div>
            <input type="hidden" name="type" value={type} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Açıklama</Label>
            <Input
              id="description"
              name="description"
              defaultValue={transaction?.description ?? ""}
              placeholder="Örn. Migros market alışverişi"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Tutar (₺)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={transaction?.amount ?? ""}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="transactionDate">Tarih</Label>
              <Input
                id="transactionDate"
                name="transactionDate"
                type="date"
                defaultValue={transaction?.transaction_date ?? new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="accountId">Hesap</Label>
              <Select name="accountId" defaultValue={transaction?.account_id ?? accounts[0]?.id}>
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
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="categoryId">Kategori</Label>
              <Select
                name="categoryId"
                defaultValue={transaction?.category_id ?? filteredCategories[0]?.id}
                key={type}
              >
                <SelectTrigger id="categoryId">
                  <SelectValue placeholder="Kategori seç" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={accounts.length === 0}>
              {isEdit ? "Kaydet" : "Ekle"}
            </Button>
          </DialogFooter>
          {accounts.length === 0 && (
            <p className="text-xs text-[var(--critical)]">
              Önce Hesaplar sayfasından bir hesap eklemelisin.
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
