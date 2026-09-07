"use client";

import { useMemo } from "react";
import { Trash2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import {
PieChart,
Pie,
Cell,
ResponsiveContainer,
Tooltip,
Legend,
BarChart,
Bar,
XAxis,
YAxis,
CartesianGrid,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { deleteTransactionAction } from "./actions";
import { TransactionDialog } from "./transaction-dialog";
import type { Account, Category, Transaction } from "@/lib/types/database";

const PIE_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#4a3aa7", "#64748b"];

const AY_KISA = [
"Oca", "Sub", "Mar", "Nis", "May", "Haz",
"Tem", "Agu", "Eyl", "Eki", "Kas", "Ara",
];

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

const categoryBreakdown = useMemo(() => {
const totals = new Map<string, number>();
for (const t of transactions) {
if (t.type !== "expense") continue;
const name = categoryById.get(t.category_id ?? "")?.name ?? "Diger";
totals.set(name, (totals.get(name) ?? 0) + Number(t.amount));
}
return Array.from(totals.entries())
.map(([name, value]) => ({ name, value }))
.sort((a, b) => b.value - a.value);
}, [transactions, categoryById]);

const monthlyData = useMemo(() => {
const buckets = new Map<string, { income: number; expense: number }>();
for (const t of transactions) {
const d = new Date(t.transaction_date);
const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const bucket = buckets.get(key) ?? { income: 0, expense: 0 };
if (t.type === "income") bucket.income += Number(t.amount);
else bucket.expense += Number(t.amount);
buckets.set(key, bucket);
}
return Array.from(buckets.entries())
.sort((a, b) => a[0].localeCompare(b[0]))
.slice(-6)
.map(([key, v]) => {
const monthIndex = Number(key.split("-")[1]) - 1;
return { ay: AY_KISA[monthIndex], Gelir: v.income, Gider: v.expense };
});
}, [transactions]);

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

{transactions.length > 0 && (
<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
<Card>
<CardHeader>
<CardTitle>Kategoriye Göre Giderler</CardTitle>
</CardHeader>
<CardContent className="pt-0">
{categoryBreakdown.length === 0 ? (
<p className="py-8 text-center text-sm text-[var(--text-secondary)]">
Henüz gider kaydı yok.
</p>
) : (
<div className="h-72 w-full">
<ResponsiveContainer width="100%" height="100%">
<PieChart>
<Pie
data={categoryBreakdown}
dataKey="value"
nameKey="name"
cx="50%"
cy="50%"
innerRadius={55}
outerRadius={90}
paddingAngle={2}
>
{categoryBreakdown.map((_, index) => (
<Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
))}
</Pie>
<Tooltip formatter={(value) => formatCurrency(Number(value))} />
  <Legend />
</PieChart>
</ResponsiveContainer>
</div>
)}
</CardContent>
</Card>
<Card>
<CardHeader>
<CardTitle>Aylık Gelir / Gider</CardTitle>
</CardHeader>
<CardContent className="pt-0">
<div className="h-72 w-full">
<ResponsiveContainer width="100%" height="100%">
<BarChart data={monthlyData}>
<CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
<XAxis dataKey="ay" stroke="var(--text-secondary)" fontSize={12} />
<YAxis stroke="var(--text-secondary)" fontSize={12} />
<Tooltip formatter={(value) => formatCurrency(Number(value))} />
<Legend />
<Bar dataKey="Gelir" fill="#1baf7a" radius={[4, 4, 0, 0]} />
<Bar dataKey="Gider" fill="#eb6834" radius={[4, 4, 0, 0]} />
</BarChart>
</ResponsiveContainer>
</div>
</CardContent>
</Card>
</div>
)}

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
{t.description || category?.name || "-"}
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
