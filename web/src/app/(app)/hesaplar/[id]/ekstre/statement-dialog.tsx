"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { upsertStatementAction } from "./actions";
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
import type { BankStatementUpload } from "@/lib/types/database";

export function StatementDialog({
  accountId,
  statement,
}: {
  accountId: string;
  statement?: BankStatementUpload;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(statement);

  async function handleSubmit(formData: FormData) {
    await upsertStatementAction(formData);
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
            Yeni Ekstre
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ekstreyi Düzenle" : "Yeni Ekstre Dönemi"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          {statement && <input type="hidden" name="id" value={statement.id} />}
          <input type="hidden" name="accountId" value={accountId} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="periodMonth">Dönem (Ay)</Label>
            <Input
              id="periodMonth"
              name="periodMonth"
              type="month"
              defaultValue={statement?.period_start?.slice(0, 7) ?? new Date().toISOString().slice(0, 7)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="minimumPaymentAmount">Asgari Ödeme Tutarı (₺)</Label>
              <Input
                id="minimumPaymentAmount"
                name="minimumPaymentAmount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={statement?.minimum_payment_amount ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paymentDueDate">Son Ödeme Tarihi</Label>
              <Input
                id="paymentDueDate"
                name="paymentDueDate"
                type="date"
                defaultValue={statement?.payment_due_date ?? ""}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="statementTotalAmount">Toplam Ekstre Tutarı (₺, opsiyonel)</Label>
            <Input
              id="statementTotalAmount"
              name="statementTotalAmount"
              type="number"
              step="0.01"
              min="0"
              defaultValue={statement?.statement_total_amount ?? ""}
              placeholder="Boş bırakılırsa kalemlerin toplamı gösterilir"
            />
          </div>
          <DialogFooter>
            <Button type="submit">{isEdit ? "Kaydet" : "Oluştur"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
