"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function KayitPage() {
  const [state, formAction, pending] = useActionState(signUpAction, {
    error: null,
    info: null,
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page)] px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-[var(--text-primary)]">
            Aile Finans’a Kayıt Ol
          </CardTitle>
          <p className="text-sm text-[var(--text-secondary)]">
            Ailenin finans panosunu oluşturmak için bir hesap aç.
          </p>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName">Ad Soyad</Label>
              <Input id="fullName" name="fullName" type="text" required autoComplete="name" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-posta</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Şifre</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {state.error && <p className="text-sm text-[var(--critical)]">{state.error}</p>}
            {state.info && <p className="text-sm text-[var(--good)]">{state.info}</p>}
            <Button type="submit" disabled={pending} className="mt-2 w-full">
              {pending ? "Kayıt oluşturuluyor…" : "Kayıt Ol"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-[var(--text-secondary)]">
            Zaten hesabın var mı?{" "}
            <Link href="/giris" className="text-[var(--brand)] hover:underline">
              Giriş yap
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
