"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatNumberForInput } from "@/lib/utils";

/**
 * Tutar girisi icin metin tabanli input. Turkce sayi bicimini (binlik
 * ayiraci ".", ondalik ayiraci ",") kabul eder - orn. "100.000,50".
 * Sunucu tarafinda `parseTLNumber` ile sayiya cevrilir (bkz. lib/utils.ts).
 * `<input type="number">` KULLANMIYORUZ; o yalnizca "." ondalik ayiracini
 * kabul ediyor ve "100.000" gibi bir girisi 100 olarak anliyordu (bkz.
 * Gereksinim Dosyasi v1, madde 8).
 */
export const AmountInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "defaultValue"> & {
    defaultValue?: number | string | null;
  }
>(({ defaultValue, placeholder, ...props }, ref) => {
  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder ?? "Örn. 100.000,50"}
      defaultValue={formatNumberForInput(defaultValue ?? "")}
      ref={ref}
      {...props}
    />
  );
});
AmountInput.displayName = "AmountInput";
