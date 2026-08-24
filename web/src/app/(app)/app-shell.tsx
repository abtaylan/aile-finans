"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Wallet,
  PiggyBank,
  LineChart,
  HandCoins,
  LogOut,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Genel Bakış", icon: LayoutDashboard },
  { href: "/hesaplar", label: "Hesaplar", icon: Wallet },
  { href: "/butce", label: "Bütçe", icon: PiggyBank },
  { href: "/portfoy", label: "Portföy", icon: LineChart },
  { href: "/zekat", label: "Zekât", icon: HandCoins },
];

export function AppShell({
  children,
  fullName,
}: {
  children: React.ReactNode;
  fullName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/giris");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--page)]">
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface-1)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand)] text-white font-semibold">
              A
            </div>
            <span className="font-semibold text-[var(--text-primary)]">Aile Finans</span>
          </div>
          <nav className="hidden md:flex">
            <ul className="flex items-center gap-1 rounded-xl bg-[var(--surface-2)] p-1">
              {NAV_ITEMS.map((item) => {
                const active =
                  item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] transition-colors",
                        active &&
                          "bg-[var(--surface-1)] text-[var(--text-primary)] shadow-sm"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="flex items-center gap-1.5">
            <Link
              href="/profil"
              className={cn(
                "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)]",
                pathname.startsWith("/profil") && "bg-[var(--surface-2)] text-[var(--text-primary)]"
              )}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surface-2)]">
                <User className="h-3.5 w-3.5" />
              </span>
              <span className="hidden sm:inline">{fullName}</span>
            </Link>
            <button
              onClick={handleSignOut}
              aria-label="Çıkış"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Çıkış</span>
            </button>
          </div>
        </div>
        {/* Mobil sekme çubuğu */}
        <nav className="border-t border-[var(--border)] px-2 py-1.5 md:hidden">
          <ul className="flex items-center justify-between">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-medium text-[var(--text-secondary)]",
                      active && "text-[var(--brand)]"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
