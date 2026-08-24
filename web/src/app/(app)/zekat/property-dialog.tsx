"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { upsertPropertyAction } from "./actions";
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
import type { Property } from "@/lib/types/database";

const TYPE_LABELS: Record<string, string> = {
  ev: "Ev",
  yazlik: "Yazlık",
  kiralik: "Kiralık",
  ticari: "Ticari",
  arsa: "Arsa",
  diger: "Diğer",
};

export function PropertyDialog({ property }: { property?: Property }) {
  const [open, setOpen] = useState(false);
  const [tradeIntent, setTradeIntent] = useState(property?.is_trade_intent ?? false);
  const isEdit = Boolean(property);

  async function handleSubmit(formData: FormData) {
    await upsertPropertyAction(formData);
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
            Gayrimenkul Ekle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Gayrimenkulü Düzenle" : "Yeni Gayrimenkul"}</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="flex flex-col gap-4">
          {property && <input type="hidden" name="id" value={property.id} />}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Ad</Label>
            <Input id="name" name="name" defaultValue={property?.name} placeholder="Örn. Ev - Kadıköy" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="propertyType">Tür</Label>
              <Select name="propertyType" defaultValue={property?.property_type ?? "ev"}>
                <SelectTrigger id="propertyType">
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
              <Label htmlFor="estimatedValue">Tahmini Değer (₺)</Label>
              <Input
                id="estimatedValue"
                name="estimatedValue"
                type="number"
                step="0.01"
                defaultValue={property?.estimated_value ?? ""}
                required
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Satış / ticaret niyetiyle tutuluyor
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Yalnızca bu işaretliyse zekât matrahına dahil edilir.
              </p>
            </div>
            <Switch checked={tradeIntent} onCheckedChange={setTradeIntent} />
            <input type="hidden" name="isTradeIntent" value={tradeIntent ? "on" : ""} />
          </div>
          <DialogFooter>
            <Button type="submit">{isEdit ? "Kaydet" : "Ekle"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
