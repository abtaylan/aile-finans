import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aile Finans ve Varlık Yönetimi",
  description: "Ailenizin bütçesini, portföyünü ve zekâtını tek yerden yönetin.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
