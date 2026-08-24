"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { addStatementItemAction } from "./actions";
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

export function ItemDialog({ uploadId }: { uploadId: string }) {
  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<"expense" | "income">("expense");

  async function handleSubmit(formData: FormData) {
    await addStatementItemAction(formData);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Plus className="h-4 w-4" />
          Kalem Ekle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni Ekstre Kalemi</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <input type="hidden" name="uploadId" value={uploadId} />

          <div className="flex flex-col gap-1.5">
            <Label>Tür</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection("expense")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                  direction === "expense"
                    ? "border-[var(--critical)] bg-[var(--critical-bg)] text-[var(--critical)]"
                    : "border-[var(--border)] text-[var(--text-secondary)]"
                }`}
              >
                Harcama
              </button>
              <button
                type="button"
                onClick={() => setDirection("income")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                  direction === "income"
                    ? "border-[var(--good)] bg-[var(--good-bg)] text-[var(--good)]"
                    : "border-[var(--border)] text-[var(--text-secondary)]"
                }`}
              >
                İade
              </button>
            </div>
            <input type="hidden" name="direction" value={direction} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Açıklama</Label>
            <Input
              id="description"
              name="description"
              placeholder="Örn. Migros market alışverişi"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Tutar (₺)</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="transactionDate">Tarih</Label>
              <Input
                id="transactionDate"
                name="transactionDate"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="installmentLabel">Taksit (opsiyonel)</Label>
            <Input
              id="installmentLabel"
              name="installmentLabel"
              placeholder="Örn. 3/6 — boş bırakılırsa tek çekim"
            />
          </div>

          <DialogFooter>
            <Button type="submit">Ekle</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
