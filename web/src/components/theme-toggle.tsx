"use client";

import { useLayoutEffect } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

function getStoredTheme(): Theme | null {
  try {
    const t = window.localStorage.getItem("theme");
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null;
  }
}

export function ThemeToggle() {
  // React Strict Mode, dev'de bir kez remount ederken layout'taki inline
  // script'in <html> üzerine koyduğu data-theme attribute'unu sıfırlıyor.
  // Kayıtlı bir tercih varsa burada yeniden uygula (prod'da no-op).
  useLayoutEffect(() => {
    const stored = getStoredTheme();
    if (stored) {
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  function toggle() {
    const current = document.documentElement.getAttribute("data-theme");
    const isDark =
      current === "dark" ||
      (current !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next: Theme = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem("theme", next);
    } catch {
      // localStorage kullanılamıyor (ör. gizli sekme) — tema yalnızca bu
      // oturumda geçerli olur, sonraki ziyarette sistem tercihine döner.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Temayı değiştir"
      className="flex items-center justify-center rounded-lg p-2 text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
    >
      <Sun className="theme-toggle-sun h-4 w-4" />
      <Moon className="theme-toggle-moon h-4 w-4" />
    </button>
  );
}
