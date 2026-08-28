"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User, Users, LogOut, Monitor, Globe2, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProfileAction, updateFamilyAction, signOutAction } from "./actions";
import type { Family, UserProfile } from "@/lib/types/database";

const LOCALE_LABELS: Record<string, string> = {
  "tr-TR": "Türkçe",
  "en-US": "English",
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Sahip",
  admin: "Yönetici",
  member: "Üye",
  viewer: "İzleyici",
};

export function ProfileClient({
  profile,
  family,
  memberCount,
}: {
  profile: UserProfile;
  family: Family | null;
  memberCount: number;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState<"local" | "global" | null>(null);
  const isAdmin = profile.role === "owner" || profile.role === "admin";

  async function handleSignOut(scope: "local" | "global") {
    setSigningOut(scope);
    // signOutAction hem Supabase oturumunu hem de (scope'a göre bu
    // cihazın veya tüm cihazların) güvenilir-cihaz kaydını temizleyip
    // /giris'e yönlendirir (bkz. src/app/(app)/profil/actions.ts).
    await signOutAction(scope);
  }

  async function handleUpdateProfile(formData: FormData) {
    await updateProfileAction(formData);
    router.refresh();
  }

  async function handleUpdateFamily(formData: FormData) {
    await updateFamilyAction(formData);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Profil</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          Hesap bilgilerini, aile ayarlarını ve oturumunu yönet.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand)] text-white">
            <User className="h-4 w-4" />
          </span>
          <CardTitle className="!text-base !font-semibold text-[var(--text-primary)]">
            Kişisel Bilgiler
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <form action={handleUpdateProfile} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fullName">Ad Soyad</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  defaultValue={profile.full_name}
                  placeholder="Ad Soyad"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">E-posta</Label>
                <Input id="email" value={profile.email} disabled readOnly />
              </div>
            </div>
            <div className="flex flex-col gap-1.5 sm:w-1/2 sm:pr-1.5">
              <Label htmlFor="locale">Dil</Label>
              <Select name="locale" defaultValue={profile.locale}>
                <SelectTrigger id="locale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(LOCALE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Button type="submit">Kaydet</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand)] text-white">
            <Users className="h-4 w-4" />
          </span>
          <CardTitle className="!text-base !font-semibold text-[var(--text-primary)]">
            Aile Bilgisi
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 pt-0">
          {isAdmin ? (
            <form action={handleUpdateFamily} className="flex flex-col gap-3 sm:w-1/2 sm:pr-1.5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="familyName">Aile Adı</Label>
                <Input
                  id="familyName"
                  name="familyName"
                  defaultValue={family?.name ?? ""}
                  placeholder="Örn. Yılmaz Ailesi"
                  required
                />
              </div>
              <div>
                <Button type="submit" variant="secondary">
                  Kaydet
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-1 sm:w-1/2 sm:pr-1.5">
              <Label>Aile Adı</Label>
              <p className="text-sm text-[var(--text-primary)]">{family?.name ?? "—"}</p>
              <p className="text-xs text-[var(--text-muted)]">
                Aile adını yalnızca sahip veya yöneticiler değiştirebilir.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {memberCount} üye · sen {ROLE_LABELS[profile.role] ?? profile.role} rolündesin
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Üye davet etme, rol atama ve kategori yönetimi Aile sayfasında.
              </p>
            </div>
            <Button variant="outline" asChild>
              <Link href="/aile">
                Aile Yönetimi
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand)] text-white">
            <Monitor className="h-4 w-4" />
          </span>
          <CardTitle className="!text-base !font-semibold text-[var(--text-primary)]">
            Oturum Yönetimi
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-0">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Bu cihazdan çıkış yap</p>
              <p className="text-xs text-[var(--text-secondary)]">
                Yalnızca bu tarayıcıdaki oturumu kapatır.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => handleSignOut("local")}
              disabled={signingOut !== null}
            >
              <LogOut className="h-4 w-4" />
              {signingOut === "local" ? "Çıkış yapılıyor…" : "Çıkış yap"}
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Tüm cihazlardan çıkış yap
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Bu hesapla açık olan tüm oturumları (diğer cihazlar dahil) sonlandırır.
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => handleSignOut("global")}
              disabled={signingOut !== null}
            >
              <LogOut className="h-4 w-4" />
              {signingOut === "global" ? "Çıkış yapılıyor…" : "Tümünden çık"}
            </Button>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <Globe2 className="h-3.5 w-3.5" />
            Dil tercihi: {LOCALE_LABELS[profile.locale] ?? profile.locale}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
