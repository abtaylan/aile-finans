"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { markDeviceTrusted } from "@/lib/auth/two-factor";

export type UpdatePasswordState = { error: string | null };

export async function updatePasswordAction(
  _prevState: UpdatePasswordState,
  formData: FormData
): Promise<UpdatePasswordState> {
  const password = String(formData.get("password") || "");
  const passwordConfirm = String(formData.get("passwordConfirm") || "");

  if (password.length < 8) {
    return { error: "Şifre en az 8 karakter olmalı." };
  }
  if (password !== passwordConfirm) {
    return { error: "Şifreler eşleşmiyor." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Oturum süresi dolmuş, sıfırlama bağlantısını tekrar iste." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: `Şifre güncellenemedi: ${error.message}` };
  }

  // Sıfırlama bağlantısına e-postadan erişildi — bu, OTP ile aynı güçte
  // bir "bu cihaz e-postana erişebiliyor" kanıtı, o yüzden cihazı da
  // güvenilir işaretliyoruz; kullanıcı ayrıca OTP görmeden devam eder.
  await markDeviceTrusted(supabase, user.id);

  const { data: profile } = await supabase
    .from("users")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  redirect(profile ? "/" : "/onboarding");
}
