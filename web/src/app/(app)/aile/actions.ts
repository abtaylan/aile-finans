"use server";

import { revalidatePath } from "next/cache";
import { requireFamilyContext } from "@/lib/auth-context";
import { createAdminClient } from "@/lib/supabase/admin";
import type { InvitableRole, MemberRole } from "@/lib/types/database";

const INVITABLE_ROLES: InvitableRole[] = ["admin", "member", "viewer"];
const ASSIGNABLE_ROLES: MemberRole[] = ["owner", "admin", "member", "viewer"];
const CATEGORY_TYPES = ["income", "expense"] as const;

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function requireAdmin(role: MemberRole) {
  if (role !== "owner" && role !== "admin") {
    throw new Error("Bu işlem için yetkin yok.");
  }
}

// ---------------------------------------------------------------------
// Davetler
// ---------------------------------------------------------------------
export async function inviteMemberAction(formData: FormData) {
  const { supabase, profile } = await requireFamilyContext();
  requireAdmin(profile.role);

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "member") as InvitableRole;

  if (!isEmail(email)) {
    throw new Error("Geçerli bir e-posta adresi gir.");
  }
  if (!INVITABLE_ROLES.includes(role)) {
    throw new Error("Geçersiz rol.");
  }
  if (profile.role === "admin" && role === "admin") {
    throw new Error("Yönetici rolüyle davet etmek için aile sahibi olman gerekiyor.");
  }

  const { data: existingMember } = await supabase
    .from("users")
    .select("id")
    .eq("family_id", profile.family_id)
    .eq("email", email)
    .maybeSingle();
  if (existingMember) {
    throw new Error("Bu e-posta zaten ailenin bir üyesi.");
  }

  const { error } = await supabase.from("family_invites").insert({
    family_id: profile.family_id,
    email,
    role,
    invited_by_user_id: profile.id,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Bu e-postaya zaten bekleyen bir davet var.");
    }
    throw new Error(error.message);
  }

  revalidatePath("/aile");
}

export async function revokeInviteAction(formData: FormData) {
  const { supabase, profile } = await requireFamilyContext();
  requireAdmin(profile.role);

  const id = String(formData.get("id") || "");
  if (!id) return;

  const { error } = await supabase
    .from("family_invites")
    .delete()
    .eq("id", id)
    .eq("family_id", profile.family_id);
  if (error) throw new Error(error.message);

  revalidatePath("/aile");
}

// ---------------------------------------------------------------------
// Üyeler / roller
// ---------------------------------------------------------------------
export async function setMemberRoleAction(formData: FormData) {
  const { profile } = await requireFamilyContext();
  requireAdmin(profile.role);

  const memberId = String(formData.get("memberId") || "");
  const newRole = String(formData.get("role") || "") as MemberRole;

  if (!memberId || !ASSIGNABLE_ROLES.includes(newRole)) {
    throw new Error("Geçersiz istek.");
  }
  if (memberId === profile.id) {
    throw new Error("Kendi rolünü buradan değiştiremezsin.");
  }

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from("users")
    .select("id, family_id, role")
    .eq("id", memberId)
    .maybeSingle();

  if (targetError || !target || target.family_id !== profile.family_id) {
    throw new Error("Üye bulunamadı.");
  }

  const touchesOwnerOrAdmin =
    target.role === "owner" || target.role === "admin" || newRole === "owner" || newRole === "admin";
  if (profile.role === "admin" && touchesOwnerOrAdmin) {
    throw new Error("Yönetici, sahip/yönetici rollerini değiştiremez. Bu işlem için aile sahibi gerekli.");
  }

  if (target.role === "owner" && newRole !== "owner") {
    const { count } = await admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("family_id", profile.family_id)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      throw new Error("Ailenin en az bir sahibi olmalı.");
    }
  }

  const { error } = await admin.from("users").update({ role: newRole }).eq("id", memberId);
  if (error) throw new Error(error.message);

  revalidatePath("/aile");
  revalidatePath("/profil");
}

export async function removeMemberAction(formData: FormData) {
  const { profile } = await requireFamilyContext();
  requireAdmin(profile.role);

  const memberId = String(formData.get("memberId") || "");
  if (!memberId) return;
  if (memberId === profile.id) {
    throw new Error("Kendini bu ekrandan çıkaramazsın — hesabını silmek için farklı bir akış gerekir.");
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from("users")
    .select("id, family_id, role")
    .eq("id", memberId)
    .maybeSingle();

  if (!target || target.family_id !== profile.family_id) {
    throw new Error("Üye bulunamadı.");
  }
  if (profile.role === "admin" && (target.role === "owner" || target.role === "admin")) {
    throw new Error("Yönetici, sahibi veya diğer yöneticileri çıkaramaz.");
  }
  if (target.role === "owner") {
    const { count } = await admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("family_id", profile.family_id)
      .eq("role", "owner");
    if ((count ?? 0) <= 1) {
      throw new Error("Ailenin son sahibini çıkaramazsın.");
    }
  }

  // auth.users kaydını sil — public.users satırı ON DELETE CASCADE ile
  // otomatik silinir; hesaplar/işlemler gibi diğer tablolardaki
  // referanslar ON DELETE SET NULL ile korunur.
  const { error } = await admin.auth.admin.deleteUser(memberId);
  if (error) throw new Error(error.message);

  revalidatePath("/aile");
}

// ---------------------------------------------------------------------
// Kategoriler
// ---------------------------------------------------------------------
export async function upsertCategoryAction(formData: FormData) {
  const { supabase, profile } = await requireFamilyContext();
  requireAdmin(profile.role);

  const id = String(formData.get("id") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const type = String(formData.get("type") || "expense") as (typeof CATEGORY_TYPES)[number];
  const color = String(formData.get("color") || "#2a78d6").trim();

  if (!name) throw new Error("Kategori adı boş olamaz.");
  if (!CATEGORY_TYPES.includes(type)) throw new Error("Geçersiz kategori türü.");

  const payload = { family_id: profile.family_id, name, type, color };

  if (id) {
    const { error } = await supabase
      .from("categories")
      .update(payload)
      .eq("id", id)
      .eq("family_id", profile.family_id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("categories").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/aile");
}

export async function deleteCategoryAction(formData: FormData) {
  const { supabase, profile } = await requireFamilyContext();
  requireAdmin(profile.role);

  const id = String(formData.get("id") || "");
  if (!id) return;

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("family_id", profile.family_id);
  if (error) throw new Error(error.message);

  revalidatePath("/aile");
}

// ---------------------------------------------------------------------
// Tehlikeli bölge: aile silme
// ---------------------------------------------------------------------
export async function deleteFamilyAction() {
  const { profile } = await requireFamilyContext();
  if (profile.role !== "owner") {
    throw new Error("Yalnızca aile sahibi bu işlemi yapabilir.");
  }

  const admin = createAdminClient();
  // families satırının silinmesi tüm alt tabloları (hesaplar, işlemler,
  // kategoriler, davetler, diğer üyelerin users satırları dahil) CASCADE
  // ile temizler. Diğer üyelerin auth.users hesapları etkilenmez — bir
  // sonraki girişte onboarding'e düşerler.
  //
  // Not: burada bilerek redirect() çağrılmıyor — bu action istemciden
  // düz bir fonksiyon çağrısı olarak (form action değil) tetikleniyor ve
  // redirect()'in attığı özel hata try/catch içinde yanlışlıkla
  // yakalanıp "silinemedi" hatası gibi gösterilebilir. Yönlendirmeyi
  // başarı sonrası istemci (router.push) yapıyor.
  const { error } = await admin.from("families").delete().eq("id", profile.family_id);
  if (error) throw new Error(error.message);
}
