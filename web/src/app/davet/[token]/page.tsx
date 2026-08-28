import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ROLE_LABELS: Record<string, string> = {
  admin: "Yönetici",
  member: "Üye",
  viewer: "İzleyici",
};

type InvitePreview = {
  family_name: string;
  role: string;
  email: string;
  valid: boolean;
};

export default async function DavetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: invite } = await supabase
    .rpc("get_invite_preview", { p_token: token })
    .maybeSingle<InvitePreview>();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let hasProfile = false;
  if (user) {
    const { data: existingProfile } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    hasProfile = Boolean(existingProfile);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page)] px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-[var(--text-primary)]">
            Aile Daveti
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!invite || !invite.valid ? (
            <p className="text-sm text-[var(--text-secondary)]">
              Bu davet linki geçersiz, süresi dolmuş veya zaten kullanılmış.
            </p>
          ) : (
            <>
              <p className="text-sm text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">{invite.family_name}</strong> ailesine{" "}
                <strong className="text-[var(--text-primary)]">
                  {ROLE_LABELS[invite.role] ?? invite.role}
                </strong>{" "}
                rolüyle davet edildin.
                <br />
                Davet edilen e-posta: {invite.email}
              </p>

              {!user && (
                <div className="flex flex-col gap-2">
                  <Button asChild>
                    <Link href={`/kayit?email=${encodeURIComponent(invite.email)}`}>
                      Hesap oluştur ve katıl
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/giris?email=${encodeURIComponent(invite.email)}`}>
                      Zaten hesabım var, giriş yap
                    </Link>
                  </Button>
                </div>
              )}

              {user && hasProfile && (
                <p className="text-sm text-[var(--critical)]">
                  Bu hesap zaten bir aileye üye. Daveti kabul etmek için davetin gönderildiği
                  e-posta ile farklı bir hesapla giriş yapman gerekiyor.
                </p>
              )}

              {user && !hasProfile && (
                <Button asChild>
                  <Link href="/onboarding">Devam et</Link>
                </Button>
              )}
            </>
          )}

          <Link
            href="/giris"
            className="text-center text-sm text-[var(--text-secondary)] hover:underline"
          >
            Girişe dön
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
