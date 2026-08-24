import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/giris");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    redirect("/");
  }

  // E-postasına bekleyen bir aile daveti varsa otomatik olarak o aileye
  // katılır — bu durumda yeni bir aile oluşturma formu hiç gösterilmez.
  const { data: joinedFamilyId } = await supabase.rpc("accept_my_pending_invite");
  if (joinedFamilyId) {
    redirect("/");
  }

  const defaultFullName =
    (user.user_metadata?.full_name as string | undefined) ?? "";

  return <OnboardingForm defaultFullName={defaultFullName} />;
}
