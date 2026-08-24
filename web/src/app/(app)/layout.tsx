import { requireFamilyContext } from "@/lib/auth-context";
import { AppShell } from "./app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireFamilyContext();

  return <AppShell fullName={profile.full_name}>{children}</AppShell>;
}
