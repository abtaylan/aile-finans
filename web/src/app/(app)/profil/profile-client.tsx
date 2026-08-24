"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Users, LogOut, Monitor, Globe2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { updateProfileAction, updateFamilyAction } from "./actions";
import type { Family, UserProfile } from "@/lib/types/database";
import type { FamilyMember } from "./page";

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

const ROLE_BADGE_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  owner: "default",
  admin: "secondary",
  member: "outline",
  viewer: "outline",
};

export function ProfileClient({
  profile,
  family,
  members,
}: {
  profile: UserProfile;
  family: Family | null;
  members: FamilyMember[];
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState<"local" | "global" | null>(null);

  async function handleSignOut(scope: "local" | "global") {
    setSigningOut(scope);
    const supabase = createClient();
    await supabase.auth.signOut({ scope });
    router.push("/giris");
    router.refresh();
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

          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-[var(--text-primary)]">Aile Üyeleri</p>
            <p className="mb-2 text-xs text-[var(--text-secondary)]">
              Üye ekleme, çıkarma ve rol atama yakında eklenecek.
            </p>
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-medium text-[var(--text-secondary)]">
                      {member.full_name.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">
                        {member.full_name}
                        {member.id === profile.id && (
                          <span className="ml-1.5 text-xs font-normal text-[var(--text-muted)]">
                            (sen)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">{member.email}</p>
                    </div>
                  </div>
                  <Badge variant={ROLE_BADGE_VARIANT[member.role] ?? "outline"}>
                    {ROLE_LABELS[member.role] ?? member.role}
                  </Badge>
                </div>
              ))}
            </div>
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
