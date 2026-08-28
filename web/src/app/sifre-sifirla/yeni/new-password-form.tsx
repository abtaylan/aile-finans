"use client";

import { useActionState } from "react";
import { updatePasswordAction, type UpdatePasswordState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const initialState: UpdatePasswordState = { error: null };

export function NewPasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page)] px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-[var(--text-primary)]">
            Yeni Şifre Belirle
          </CardTitle>
          <p className="text-sm text-[var(--text-secondary)]">
            Hesabın için yeni bir şifre gir.
          </p>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Yeni Şifre</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="passwordConfirm">Yeni Şifre (Tekrar)</Label>
              <Input
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {state.error && <p className="text-sm text-[var(--critical)]">{state.error}</p>}
            <Button type="submit" disabled={pending} className="mt-2 w-full">
              {pending ? "Kaydediliyor…" : "Şifreyi Güncelle"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
