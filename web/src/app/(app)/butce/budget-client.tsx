"use client";

import { Trash2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { deleteTransactionAction } from "./actions";
import { TransactionDialog } from "./transaction-dialog";
import type { Account, Category, Transaction } from "@/lib/types/database";

export function BudgetClient({
  accounts,
  categories,
  transactions,
}: {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
}) {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const net = totalIncome - totalExpense;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Bütçe</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Gelir ve gider kalemlerini ekle, gerçek zamanlı takip et.
          </p>
        </div>
        <TransactionDialog accounts={accounts} categories={categories} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Toplam Gelir</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold text-[var(--good)]">
              {formatCurrency(totalIncome)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Toplam Gider</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold text-[var(--critical)]">
              {formatCurrency(totalExpense)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Net Durum</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p
              className={`text-2xl font-semibold ${
                net >= 0 ? "text-[var(--good)]" : "text-[var(--critical)]"
              }`}
            >
              {formatCurrency(net)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Hareketler</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
              Henüz hareket eklenmedi.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {transactions.map((t) => {
                const category = categoryById.get(t.category_id ?? "");
                return (
                  <div key={t.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full ${
                          t.type === "income"
                            ? "bg-[var(--good-bg)] text-[var(--good)]"
                            : "bg-[var(--critical-bg)] text-[var(--critical)]"
                        }`}
                      >
                        {t.type === "income" ? (
                          <ArrowUpRight className="h-4 w-4" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4" />
                        )}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">
                          {t.description || category?.name || "—"}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {category?.name} · {formatDate(t.transaction_date)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <p
                        className={`text-sm font-semibold ${
                          t.type === "income" ? "text-[var(--good)]" : "text-[var(--critical)]"
                        }`}
                      >
                        {t.type === "income" ? "+" : "-"}
                        {formatCurrency(t.amount, t.currency)}
                      </p>
                      <TransactionDialog
                        accounts={accounts}
                        categories={categories}
                        transaction={t}
                      />
                      <form action={deleteTransactionAction}>
                        <input type="hidden" name="id" value={t.id} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          className="text-[var(--critical)] hover:bg-[var(--critical-bg)]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
