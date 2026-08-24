"use client";

import { useActionState } from "react";
import { createFamilyAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function OnboardingForm({ defaultFullName }: { defaultFullName: string }) {
  const [state, formAction, pending] = useActionState(createFamilyAction, { error: null });

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page)] px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-[var(--text-primary)]">
            Ailenizi Oluşturun
          </CardTitle>
          <p className="text-sm text-[var(--text-secondary)]">
            Son bir adım: ailenizin finans panosunu kurmak için birkaç bilgi.
          </p>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="familyName">Aile Adı</Label>
              <Input
                id="familyName"
                name="familyName"
                placeholder="Örn. Taylan Ailesi"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName">Ad Soyad</Label>
              <Input
                id="fullName"
                name="fullName"
                defaultValue={defaultFullName}
                required
              />
            </div>
            {state.error && <p className="text-sm text-[var(--critical)]">{state.error}</p>}
            <Button type="submit" disabled={pending} className="mt-2 w-full">
              {pending ? "Oluşturuluyor…" : "Devam Et"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
