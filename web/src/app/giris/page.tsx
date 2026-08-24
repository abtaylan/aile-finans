"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function GirisPage() {
  const [state, formAction, pending] = useActionState(signInAction, { error: null });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page)] px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-[var(--text-primary)]">
            Aile Finans’a Giriş Yap
          </CardTitle>
          <p className="text-sm text-[var(--text-secondary)]">
            Hesabına giriş yaparak ailenin finans panosuna eriş.
          </p>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
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
                autoComplete="current-password"
              />
            </div>
            {state.error && (
              <p className="text-sm text-[var(--critical)]">{state.error}</p>
            )}
            <Button type="submit" disabled={pending} className="mt-2 w-full">
              {pending ? "Giriş yapılıyor…" : "Giriş Yap"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-[var(--text-secondary)]">
            Hesabın yok mu?{" "}
            <Link href="/kayit" className="text-[var(--brand)] hover:underline">
              Kayıt ol
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
