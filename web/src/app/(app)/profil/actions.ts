"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/server";
import { clearDeviceCookie, getDeviceTokenHash } from "@/lib/auth/two-factor";

const LOCALES = ["tr-TR", "en-US"];

export async function updateProfileAction(formData: FormData) {
  const { supabase, profile } = await requireFamilyContext();

  const fullName = String(formData.get("fullName") || "").trim();
  const locale = String(formData.get("locale") || "tr-TR").trim();

  if (!fullName) {
    throw new Error("Ad soyad boş olamaz.");
  }
  if (!LOCALES.includes(locale)) {
    throw new Error("Geçersiz dil seçimi.");
  }

  const { error } = await supabase
    .from("users")
    .update({ full_name: fullName, locale })
    .eq("id", profile.id);

  if (error) throw new Error(error.message);

  revalidatePath("/profil");
  revalidatePath("/", "layout");
}

export async function updateFamilyAction(formData: FormData) {
  const { supabase, profile } = await requireFamilyContext();

  if (profile.role !== "owner" && profile.role !== "admin") {
    throw new Error("Aile adını yalnızca sahip veya yöneticiler değiştirebilir.");
  }

  const name = String(formData.get("familyName") || "").trim();

  if (!name) {
    throw new Error("Aile adı boş olamaz.");
  }

  const { error } = await supabase
    .from("families")
    .update({ name })
    .eq("id", profile.family_id);

  if (error) throw new Error(error.message);

  revalidatePath("/profil");
}

/**
 * "Bu cihazdan çıkış": yalnızca bu tarayıcının oturumunu ve bu cihazın
 * güvenilir-cihaz kaydını kaldırır — sonraki girişte bu cihaz yine OTP
 * ister.
 * "Tüm cihazlardan çıkış": tüm Supabase oturumlarını VE bu hesaba ait
 * tüm güvenilir-cihaz kayıtlarını siler — her cihaz bir sonraki girişte
 * yeniden OTP ile doğrulanmak zorunda kalır (bkz. ROADMAP.md #5).
 */
export async function signOutAction(scope: "local" | "global") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    if (scope === "global") {
      await supabase.from("trusted_devices").delete().eq("user_id", user.id);
    } else {
      const tokenHash = await getDeviceTokenHash();
      if (tokenHash) {
        await supabase
          .from("trusted_devices")
          .delete()
          .eq("user_id", user.id)
          .eq("token_hash", tokenHash);
      }
    }
  }

  await clearDeviceCookie();
  await supabase.auth.signOut({ scope });
  redirect("/giris");
}
