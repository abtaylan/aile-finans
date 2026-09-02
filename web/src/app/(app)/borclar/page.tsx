import { requireFamilyContext } from "@/lib/auth-context";
import { DebtsClient } from "./debts-client";
import type { Loan } from "@/lib/types/database";

export default async function BorclarPage() {
const { supabase, profile } = await requireFamilyContext();

const { data: debts } = await supabase
.from("loans")
.select("*")
.eq("family_id", profile.family_id)
.order("is_active", { ascending: false })
.order("end_date", { ascending: true });

return <DebtsClient debts={(debts as Loan[]) ?? []} />;
}
