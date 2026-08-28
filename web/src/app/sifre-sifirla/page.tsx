"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { requestPasswordResetAction, type ForgotPasswordState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: ForgotPasswordState = { error: null, info: null };

function SifreSifirlaInner() {
  const searchParams = useSearchParams();
  const linkExpired = searchParams.get("error") === "link_suresi_dolmus";
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page)] px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-[var(--text-primary)]">
            Şifreni mi unuttun?
          </CardTitle>
          <p className="text-sm text-[var(--text-secondary)]">
            E-posta adresini gir, sana bir şifre sıfırlama bağlantısı gönderelim.
          </p>
        </CardHeader>
        <CardContent>
          {linkExpired && !state.info && (
            <p className="mb-4 text-sm text-[var(--critical)]">
              Bağlantının süresi dolmuş veya geçersiz. Tekrar dene.
            </p>
          )}
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-posta</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            {state.error && <p className="text-sm text-[var(--critical)]">{state.error}</p>}
            {state.info && <p className="text-sm text-[var(--good)]">{state.info}</p>}
            <Button type="submit" disabled={pending} className="mt-2 w-full">
              {pending ? "Gönderiliyor…" : "Sıfırlama Bağlantısı Gönder"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-[var(--text-secondary)]">
            <Link href="/giris" className="text-[var(--brand)] hover:underline">
              Girişe dön
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SifreSifirlaPage() {
  return (
    <Suspense fallback={null}>
      <SifreSifirlaInner />
    </Suspense>
  );
}
