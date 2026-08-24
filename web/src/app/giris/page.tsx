"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { sendOtpAction, verifyOtpAction, type OtpState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const baseState: OtpState = { step: "email", email: "", error: null, info: null };

function GirisPageInner() {
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get("email") ?? "";
  const initialState: OtpState = { ...baseState, email: prefillEmail };

  const [emailState, sendAction, sendPending] = useActionState(sendOtpAction, initialState);
  const [codeState, verifyAction, verifyPending] = useActionState(verifyOtpAction, initialState);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState(prefillEmail);

  // Sunucu action'ları her tamamlandığında (render sırasında, effect içinde DEĞİL —
  // bkz. React "adjusting state when a prop changes" deseni) yerel adım/e-posta
  // state'ini senkronize ediyoruz. Önceki referansla kıyaslamak sonsuz render'ı önler.
  const [prevEmailState, setPrevEmailState] = useState(emailState);
  if (emailState !== prevEmailState) {
    setPrevEmailState(emailState);
    if (emailState.step === "code" && emailState.email) {
      setStep("code");
      setEmail(emailState.email);
    }
  }

  const [prevCodeState, setPrevCodeState] = useState(codeState);
  if (codeState !== prevCodeState) {
    setPrevCodeState(codeState);
    if (codeState.error) {
      setStep("code");
      if (codeState.email) setEmail(codeState.email);
    }
  }

  const error = step === "code" ? codeState.error : emailState.error;
  const info = emailState.info || codeState.info;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page)] px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-[var(--text-primary)]">
            Aile Finans’a Giriş Yap
          </CardTitle>
          <p className="text-sm text-[var(--text-secondary)]">
            {step === "email"
              ? "E-postana gönderilecek kod ile giriş yap veya hesap oluştur."
              : `${email} adresine gönderilen 6 haneli kodu gir.`}
          </p>
        </CardHeader>
        <CardContent>
          {step === "email" ? (
            <form action={sendAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email">E-posta</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={email}
                  required
                  autoComplete="email"
                />
              </div>
              {error && <p className="text-sm text-[var(--critical)]">{error}</p>}
              <Button type="submit" disabled={sendPending} className="mt-2 w-full">
                {sendPending ? "Kod gönderiliyor…" : "Kod Gönder"}
              </Button>
            </form>
          ) : (
            <form action={verifyAction} className="flex flex-col gap-4">
              <input type="hidden" name="email" value={email} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="code">Doğrulama Kodu</Label>
                <Input
                  id="code"
                  name="code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete="one-time-code"
                  placeholder="123456"
                  required
                  autoFocus
                />
              </div>
              {info && <p className="text-sm text-[var(--text-secondary)]">{info}</p>}
              {error && <p className="text-sm text-[var(--critical)]">{error}</p>}
              <Button type="submit" disabled={verifyPending} className="mt-2 w-full">
                {verifyPending ? "Doğrulanıyor…" : "Doğrula ve Giriş Yap"}
              </Button>
              <button
                type="button"
                onClick={() => setStep("email")}
                className="text-center text-sm text-[var(--text-secondary)] hover:underline"
              >
                Farklı bir e-posta kullan
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function GirisPage() {
  return (
    <Suspense fallback={null}>
      <GirisPageInner />
    </Suspense>
  );
}
