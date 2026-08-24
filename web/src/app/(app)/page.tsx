import Link from "next/link";
import { Wallet, TrendingUp, HandCoins, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { requireFamilyContext } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Account, AssetHolding, Loan, Transaction } from "@/lib/types/database";

export default async function GenelBakisPage() {
  const { supabase, profile } = await requireFamilyContext();

  const [
    { data: accounts },
    { data: holdings },
    { data: loans },
    { data: recentTransactions },
  ] = await Promise.all([
    supabase.from("accounts").select("*").eq("family_id", profile.family_id).eq("is_active", true),
    supabase.from("asset_holdings").select("*").eq("family_id", profile.family_id).gt("quantity", 0),
    supabase.from("loans").select("*").eq("family_id", profile.family_id).eq("is_active", true),
    supabase
      .from("transactions")
      .select("*")
      .eq("family_id", profile.family_id)
      .order("transaction_date", { ascending: false })
      .limit(6),
  ]);

  const typedAccounts = (accounts as Account[]) ?? [];
  const typedHoldings = (holdings as AssetHolding[]) ?? [];
  const typedLoans = (loans as Loan[]) ?? [];
  const typedTransactions = (recentTransactions as Transaction[]) ?? [];

  const cashTotal = typedAccounts
    .filter((a) => a.account_type !== "credit_card" && a.account_type !== "loan")
    .reduce((sum, a) => sum + Number(a.current_balance), 0);
  const portfolioCost = typedHoldings.reduce((sum, h) => sum + Number(h.total_cost_basis), 0);
  const loanDebt = typedLoans.reduce((sum, l) => sum + Number(l.total_remaining), 0);
  const netWorth = cashTotal + portfolioCost - loanDebt;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">
          Merhaba, {profile.full_name.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Ailenin finansal durumuna genel bir bakış.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Wallet className="h-4 w-4 text-[var(--brand)]" />
            <CardTitle>Toplam Nakit</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xl font-semibold text-[var(--text-primary)]">
              {formatCurrency(cashTotal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <TrendingUp className="h-4 w-4 text-[var(--series-3)]" />
            <CardTitle>Portföy Maliyeti</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xl font-semibold text-[var(--text-primary)]">
              {formatCurrency(portfolioCost)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <HandCoins className="h-4 w-4 text-[var(--series-2)]" />
            <CardTitle>Kalan Kredi Borcu</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xl font-semibold text-[var(--critical)]">
              {formatCurrency(loanDebt)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-2 space-y-0">
            <Wallet className="h-4 w-4 text-[var(--good)]" />
            <CardTitle>Net Değer</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p
              className={`text-xl font-semibold ${
                netWorth >= 0 ? "text-[var(--good)]" : "text-[var(--critical)]"
              }`}
            >
              {formatCurrency(netWorth)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Son Hareketler</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {typedTransactions.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
                Henüz hareket yok.{" "}
                <Link href="/butce" className="text-[var(--brand)] hover:underline">
                  Bütçe sayfasından ekle
                </Link>
                .
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-[var(--border)]">
                {typedTransactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          t.type === "income"
                            ? "bg-[var(--good-bg)] text-[var(--good)]"
                            : "bg-[var(--critical-bg)] text-[var(--critical)]"
                        }`}
                      >
                        {t.type === "income" ? (
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowDownRight className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div>
                        <p className="text-sm text-[var(--text-primary)]">
                          {t.description || "—"}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {formatDate(t.transaction_date)}
                        </p>
                      </div>
                    </div>
                    <p
                      className={`text-sm font-medium ${
                        t.type === "income" ? "text-[var(--good)]" : "text-[var(--critical)]"
                      }`}
                    >
                      {t.type === "income" ? "+" : "-"}
                      {formatCurrency(t.amount, t.currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hesaplar</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {typedAccounts.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
                Henüz hesap yok.{" "}
                <Link href="/hesaplar" className="text-[var(--brand)] hover:underline">
                  Hesap ekle
                </Link>
                .
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-[var(--border)]">
                {typedAccounts.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: a.color ?? "#2a78d6" }}
                      />
                      <p className="text-sm text-[var(--text-primary)]">{a.name}</p>
                    </div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">
                      {formatCurrency(a.current_balance, a.currency)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
