"use client";

import Link from "next/link";
import { ArrowLeft, CreditCard, Trash2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { deleteStatementAction, deleteStatementItemAction } from "./actions";
import { StatementDialog } from "./statement-dialog";
import { ItemDialog } from "./item-dialog";
import type { Account, StatementWithItems } from "@/lib/types/database";

function statementTotal(statement: StatementWithItems) {
  if (statement.statement_total_amount != null) return Number(statement.statement_total_amount);
  return statement.items.reduce((sum, item) => {
    const sign = item.direction === "income" ? -1 : 1;
    return sum + sign * Number(item.amount);
  }, 0);
}

function isOverdue(dueDate: string | null) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

export function EkstreClient({
  account,
  statements,
}: {
  account: Account;
  statements: StatementWithItems[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/hesaplar"
          className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Hesaplar
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: account.color ?? "#2a78d6" }}
          >
            <CreditCard className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-[var(--text-primary)]">
              {account.name} — Ekstreler
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Ekstre dönemlerini ve kalemlerini elle gir; kalemler otomatik olarak
              İşlemler&apos;e ve hesap bakiyesine yansır.
            </p>
          </div>
        </div>
        <StatementDialog accountId={account.id} />
      </div>

      {statements.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <FileText className="h-8 w-8 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-secondary)]">
            Henüz ekstre girilmedi. Başlamak için “Yeni Ekstre” butonuna tıkla.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {statements.map((statement) => (
            <Card key={statement.id}>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">
                    {statement.period_start && formatDate(statement.period_start)} —{" "}
                    {statement.period_end && formatDate(statement.period_end)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                    {statement.minimum_payment_amount != null && (
                      <span>
                        Asgari: {formatCurrency(statement.minimum_payment_amount, account.currency)}
                      </span>
                    )}
                    {statement.payment_due_date && (
                      <Badge variant={isOverdue(statement.payment_due_date) ? "critical" : "secondary"}>
                        Son Ödeme: {formatDate(statement.payment_due_date)}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-lg font-semibold text-[var(--text-primary)]">
                    {formatCurrency(statementTotal(statement), account.currency)}
                  </p>
                  <StatementDialog accountId={account.id} statement={statement} />
                  <form action={deleteStatementAction}>
                    <input type="hidden" name="id" value={statement.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label="Ekstreyi Sil"
                      className="text-[var(--critical)] hover:bg-[var(--critical-bg)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-0">
                {statement.items.length === 0 ? (
                  <p className="py-4 text-center text-sm text-[var(--text-secondary)]">
                    Henüz kalem eklenmedi.
                  </p>
                ) : (
                  <div className="flex flex-col divide-y divide-[var(--border)]">
                    {statement.items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 py-2.5">
                        <div>
                          <p className="text-sm text-[var(--text-primary)]">
                            {item.raw_description}
                            {item.installment_label && (
                              <span className="ml-2 text-xs text-[var(--text-muted)]">
                                ({item.installment_label})
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {formatDate(item.transaction_date)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm font-medium ${
                              item.direction === "income"
                                ? "text-[var(--good)]"
                                : "text-[var(--text-primary)]"
                            }`}
                          >
                            {item.direction === "income" ? "+" : "-"}
                            {formatCurrency(Number(item.amount), account.currency)}
                          </p>
                          <form action={deleteStatementItemAction}>
                            <input type="hidden" name="id" value={item.id} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="icon"
                              aria-label="Kalemi Sil"
                              className="text-[var(--critical)] hover:bg-[var(--critical-bg)]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <ItemDialog uploadId={statement.id} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
