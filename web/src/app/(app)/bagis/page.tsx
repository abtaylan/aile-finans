import { requireFamilyContext } from "@/lib/auth-context";
import { DonationsClient } from "./donations-client";
import type { Donation } from "@/lib/types/database";

export default async function BagisPage() {
const { supabase, profile } = await requireFamilyContext();

const { data: donations } = await supabase
.from("donations")
.select("*")
.eq("family_id", profile.family_id)
.order("donation_date", { ascending: false });

return <DonationsClient donations={(donations as Donation[]) ?? []} />;
}
