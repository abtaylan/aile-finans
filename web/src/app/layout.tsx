import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aile Finans ve Varlık Yönetimi",
  description: "Ailenizin bütçesini, portföyünü ve zekâtını tek yerden yönetin.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Kayıtlı tema tercihi varsa ilk boyamadan önce uygula (flash önleme) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
