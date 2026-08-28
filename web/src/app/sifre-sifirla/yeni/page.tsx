import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "./new-password-form";

export default async function YeniSifrePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Buraya geçerli bir sıfırlama oturumu olmadan gelinmiş (bağlantının
    // süresi dolmuş, daha önce kullanılmış, veya doğrudan URL'e girilmiş).
    redirect("/sifre-sifirla?error=link_suresi_dolmus");
  }

  return <NewPasswordForm />;
}
