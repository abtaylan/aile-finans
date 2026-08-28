import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Oturum gerektirmeyen rotalar: giriş/kayıt, şifre sıfırlama (istek +
  // e-posta bağlantısının indiği /auth/confirm). /sifre-sifirla/yeni bu
  // gruba GİRMİYOR — oraya yalnızca /auth/confirm'ün kurduğu geçici
  // "recovery" oturumuyla erişilir, dolayısıyla zaten `user` dolu olur.
  const isPublicRoute =
    pathname.startsWith("/giris") ||
    pathname.startsWith("/kayit") ||
    pathname.startsWith("/sifre-sifirla") ||
    pathname.startsWith("/auth/confirm");
  const isPublicAsset =
    pathname.startsWith("/_next") || pathname.startsWith("/favicon");

  if (!user && !isPublicRoute && !isPublicAsset) {
    const url = request.nextUrl.clone();
    url.pathname = "/giris";
    return NextResponse.redirect(url);
  }

  // Zaten giriş yapmış bir kullanıcı giriş/kayıt/"şifremi unuttum" istek
  // sayfasına dönmemeli — ama /sifre-sifirla/yeni bunun dışında, çünkü
  // oraya tam olarak giriş yapılmış (recovery oturumlu) haldeyken gelinir.
  const isRedirectIfAuthedRoute =
    pathname.startsWith("/giris") ||
    pathname.startsWith("/kayit") ||
    pathname === "/sifre-sifirla";

  if (user && isRedirectIfAuthedRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
