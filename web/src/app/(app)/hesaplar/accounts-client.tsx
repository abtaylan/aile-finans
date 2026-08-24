"use client";

import { Trash2, Landmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { deleteAccountAction } from "./actions";
import { AccountDialog } from "./account-dialog";
import type { Account } from "@/lib/types/database";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "Vadesiz Hesap",
  savings: "Vadeli Hesap",
  credit_card: "Kredi Kartı",
  cash: "Nakit",
  investment: "Yatırım Hesabı",
  loan: "Kredi Hesabı",
};

export function AccountsClient({ accounts }: { accounts: Account[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Hesaplar</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Banka hesaplarını ve kredi kartlarını yönet.
          </p>
        </div>
        <AccountDialog />
      </div>

      {accounts.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Landmark className="h-8 w-8 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-secondary)]">
            Henüz hiç hesap eklenmedi. Başlamak için “Hesap Ekle” butonuna tıkla.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: account.color ?? "#2a78d6" }}
                  >
                    <Landmark className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {account.name}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {account.bank_name || ACCOUNT_TYPE_LABELS[account.account_type]}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <AccountDialog account={account} />
                  <form action={deleteAccountAction}>
                    <input type="hidden" name="id" value={account.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label="Sil"
                      className="text-[var(--critical)] hover:bg-[var(--critical-bg)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </form>
                </div>
              </div>
              <p className="text-2xl font-semibold text-[var(--text-primary)]">
                {formatCurrency(account.current_balance, account.currency)}
              </p>
              {account.credit_limit != null && (
                <p className="text-xs text-[var(--text-secondary)]">
                  Limit: {formatCurrency(account.credit_limit, account.currency)}
                </p>
              )}
              {account.iban && (
                <p className="text-xs text-[var(--text-muted)]">{account.iban}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
