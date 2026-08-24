"use client";

import { useMemo, useState } from "react";
import { Coins, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/utils";
import { sellAssetAction, updatePriceAction } from "./actions";
import { BuyDialog } from "./buy-dialog";
import type { Account, Asset, AssetHolding, AssetTransaction } from "@/lib/types/database";

const PERIODS = [
  { label: "1A", months: 1 },
  { label: "3A", months: 3 },
  { label: "6A", months: 6 },
  { label: "9A", months: 9 },
  { label: "12A", months: 12 },
];

export function PortfolioClient({
  assets,
  accounts,
  holdings,
  transactions,
  latestPrices,
}: {
  assets: Asset[];
  accounts: Account[];
  holdings: AssetHolding[];
  transactions: AssetTransaction[];
  latestPrices: Record<string, number>;
}) {
  const [periodMonths, setPeriodMonths] = useState(12);
  const assetById = new Map(assets.map((a) => [a.id, a]));

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - periodMonths);
    return d;
  }, [periodMonths]);

  const totals = holdings.reduce(
    (acc, h) => {
      const price = latestPrices[h.asset_id] ?? h.average_unit_cost;
      const marketValue = h.quantity * price;
      acc.cost += h.total_cost_basis;
      acc.market += marketValue;
      return acc;
    },
    { cost: 0, market: 0 }
  );
  const totalPnl = totals.market - totals.cost;
  const totalPnlPct = totals.cost > 0 ? (totalPnl / totals.cost) * 100 : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Portföy</h1>
          <p className="text-sm text-[var(--text-secondary)]">
            Altın, döviz ve fon pozisyonlarını lot bazında takip et.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-[var(--surface-2)] p-1">
            {PERIODS.map((p) => (
              <button
                key={p.months}
                onClick={() => setPeriodMonths(p.months)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  periodMonths === p.months
                    ? "bg-[var(--surface-1)] text-[var(--text-primary)] shadow-sm"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <BuyDialog assets={assets} accounts={accounts} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Toplam Maliyet</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold text-[var(--text-primary)]">
              {formatCurrency(totals.cost)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Güncel Piyasa Değeri</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-2xl font-semibold text-[var(--text-primary)]">
              {formatCurrency(totals.market)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Kâr / Zarar</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2 pt-0">
            {totalPnl >= 0 ? (
              <TrendingUp className="h-5 w-5 text-[var(--good)]" />
            ) : (
              <TrendingDown className="h-5 w-5 text-[var(--critical)]" />
            )}
            <p
              className={`text-2xl font-semibold ${
                totalPnl >= 0 ? "text-[var(--good)]" : "text-[var(--critical)]"
              }`}
            >
              {formatCurrency(totalPnl)} ({totalPnlPct.toFixed(1)}%)
            </p>
          </CardContent>
        </Card>
      </div>

      {holdings.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Coins className="h-8 w-8 text-[var(--text-muted)]" />
          <p className="text-sm text-[var(--text-secondary)]">
            Henüz bir alım yapılmadı. “Alım Ekle” ile ilk lotunu ekle.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {holdings.map((h) => {
            const asset = assetById.get(h.asset_id);
            const price = latestPrices[h.asset_id] ?? h.average_unit_cost;
            const marketValue = h.quantity * price;
            const pnl = marketValue - h.total_cost_basis;
            const pnlPct = h.total_cost_basis > 0 ? (pnl / h.total_cost_basis) * 100 : 0;
            const lots = transactions
              .filter((t) => t.holding_id === h.id)
              .filter((t) => new Date(t.transaction_date) >= cutoff)
              .sort(
                (a, b) =>
                  new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
              );

            return (
              <Card key={h.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">{asset?.name}</p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {h.quantity} {asset?.unit} · Ort. maliyet{" "}
                      {formatCurrency(h.average_unit_cost)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">
                        {formatCurrency(marketValue)}
                      </p>
                      <p
                        className={`text-xs font-medium ${
                          pnl >= 0 ? "text-[var(--good)]" : "text-[var(--critical)]"
                        }`}
                      >
                        {pnl >= 0 ? "+" : ""}
                        {formatCurrency(pnl)} ({pnlPct.toFixed(1)}%)
                      </p>
                    </div>
                    <form action={updatePriceAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="assetId" value={h.asset_id} />
                      <Input
                        name="price"
                        type="number"
                        step="0.01"
                        placeholder="Güncel fiyat"
                        defaultValue={latestPrices[h.asset_id] ?? ""}
                        className="h-8 w-28 text-xs"
                      />
                      <Button type="submit" size="sm" variant="secondary">
                        Güncelle
                      </Button>
                    </form>
                    <form action={sellAssetAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="holdingId" value={h.id} />
                      <Input
                        name="quantity"
                        type="number"
                        step="0.00000001"
                        placeholder="Miktar"
                        className="h-8 w-20 text-xs"
                      />
                      <Input
                        name="unitPrice"
                        type="number"
                        step="0.01"
                        placeholder="Fiyat"
                        className="h-8 w-20 text-xs"
                      />
                      <input
                        type="hidden"
                        name="transactionDate"
                        value={new Date().toISOString().slice(0, 10)}
                      />
                      <Button type="submit" size="sm" variant="destructive">
                        Sat
                      </Button>
                    </form>
                  </div>
                </div>

                {lots.length > 0 && (
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[var(--text-muted)]">
                          <th className="pb-1.5 font-medium">Tarih</th>
                          <th className="pb-1.5 font-medium">İşlem</th>
                          <th className="pb-1.5 font-medium text-right">Miktar</th>
                          <th className="pb-1.5 font-medium text-right">Birim Fiyat</th>
                          <th className="pb-1.5 font-medium text-right">Tutar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {lots.map((t) => (
                          <tr key={t.id}>
                            <td className="py-1.5 text-[var(--text-secondary)]">
                              {formatDate(t.transaction_date)}
                            </td>
                            <td className="py-1.5">
                              <span
                                className={
                                  t.transaction_type === "buy"
                                    ? "text-[var(--good)]"
                                    : "text-[var(--critical)]"
                                }
                              >
                                {t.transaction_type === "buy" ? "Alım" : "Satım"}
                              </span>
                            </td>
                            <td className="py-1.5 text-right">{t.quantity}</td>
                            <td className="py-1.5 text-right">{formatCurrency(t.unit_price)}</td>
                            <td className="py-1.5 text-right">
                              {formatCurrency(t.quantity * t.unit_price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
