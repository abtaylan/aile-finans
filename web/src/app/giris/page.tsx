"use client";

import { Suspense, useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signInAction, verifyLoginOtpAction, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const baseState: LoginState = { step: "password", email: "", error: null, info: null };

function GirisPageInner() {
  const searchParams = useSearchParams();
  const prefillEmail = searchParams.get("email") ?? "";
  // /kayit'tan gelen yeni hesaplar OTP kodu zaten gönderilmiş halde
  // buraya (step=otp) yönlendirilir — kullanıcı tekrar "kod gönder"
  // tıklamak zorunda kalmaz.
  const startAtOtp = searchParams.get("step") === "otp" && prefillEmail !== "";
  const initialInfo = startAtOtp
    ? "Hesabını doğrulamak için e-postana gönderdiğimiz 6 haneli kodu gir."
    : null;
  const initialState: LoginState = {
    ...baseState,
    email: prefillEmail,
    info: initialInfo,
  };

  const [passwordState, passwordAction, passwordPending] = useActionState(
    signInAction,
    initialState
  );
  const [otpState, otpAction, otpPending] = useActionState(verifyLoginOtpAction, initialState);
  const [step, setStep] = useState<"password" | "otp">(startAtOtp ? "otp" : "password");
  const [email, setEmail] = useState(prefillEmail);

  // Sunucu action'ları her tamamlandığında (render sırasında, effect içinde DEĞİL —
  // bkz. React "adjusting state when a prop changes" deseni) yerel adım/e-posta
  // state'ini senkronize ediyoruz. Önceki referansla kıyaslamak sonsuz render'ı önler.
  const [prevPasswordState, setPrevPasswordState] = useState(passwordState);
  if (passwordState !== prevPasswordState) {
    setPrevPasswordState(passwordState);
    if (passwordState.step === "otp" && passwordState.email) {
      setStep("otp");
      setEmail(passwordState.email);
    }
  }

  const [prevOtpState, setPrevOtpState] = useState(otpState);
  if (otpState !== prevOtpState) {
    setPrevOtpState(otpState);
    if (otpState.error) {
      setStep("otp");
      if (otpState.email) setEmail(otpState.email);
    }
  }

  const error = step === "otp" ? otpState.error : passwordState.error;
  const info = passwordState.info || otpState.info || (step === "otp" ? initialInfo : null);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--page)] px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-[var(--text-primary)]">
            Aile Finans’a Giriş Yap
          </CardTitle>
          <p className="text-sm text-[var(--text-secondary)]">
            {step === "password"
              ? "E-posta ve şifrenle giriş yap."
              : `${email} adresine gönderilen 6 haneli kodu gir.`}
          </p>
        </CardHeader>
        <CardContent>
          {step === "password" ? (
            <form action={passwordAction} className="flex flex-col gap-4">
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
              {error && <p className="text-sm text-[var(--critical)]">{error}</p>}
              <Button type="submit" disabled={passwordPending} className="mt-2 w-full">
                {passwordPending ? "Giriş yapılıyor…" : "Giriş Yap"}
              </Button>
              <Link
                href="/sifre-sifirla"
                className="text-center text-sm text-[var(--text-secondary)] hover:underline"
              >
                Şifremi unuttum
              </Link>
            </form>
          ) : (
            <form action={otpAction} className="flex flex-col gap-4">
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
              <Button type="submit" disabled={otpPending} className="mt-2 w-full">
                {otpPending ? "Doğrulanıyor…" : "Doğrula ve Giriş Yap"}
              </Button>
              <button
                type="button"
                onClick={() => setStep("password")}
                className="text-center text-sm text-[var(--text-secondary)] hover:underline"
              >
                Farklı bir e-posta kullan
              </button>
            </form>
          )}
          {step === "password" && (
            <p className="mt-4 text-center text-sm text-[var(--text-secondary)]">
              Hesabın yok mu?{" "}
              <Link href="/kayit" className="text-[var(--brand)] hover:underline">
                Kayıt ol
              </Link>
            </p>
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
