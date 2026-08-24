"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  UserPlus,
  Trash2,
  Tags,
  Plus,
  Copy,
  Check,
  ShieldAlert,
  Download,
  Mail,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import {
  inviteMemberAction,
  revokeInviteAction,
  setMemberRoleAction,
  removeMemberAction,
  upsertCategoryAction,
  deleteCategoryAction,
  deleteFamilyAction,
} from "./actions";
import type {
  Category,
  Family,
  FamilyInvite,
  FamilyMember,
  InvitableRole,
  MemberRole,
  UserProfile,
} from "@/lib/types/database";

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "Sahip",
  admin: "Yönetici",
  member: "Üye",
  viewer: "İzleyici",
};

const ROLE_BADGE_VARIANT: Record<MemberRole, "default" | "secondary" | "outline"> = {
  owner: "default",
  admin: "secondary",
  member: "outline",
  viewer: "outline",
};

const INVITABLE_ROLE_OPTIONS: InvitableRole[] = ["admin", "member", "viewer"];
const ASSIGNABLE_ROLE_OPTIONS: MemberRole[] = ["owner", "admin", "member", "viewer"];

const PALETTE = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#4a3aa7", "#e34948", "#898781"];

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-[var(--critical)]">{message}</p>;
}

export function AileClient({
  profile,
  family,
  members,
  invites,
  categories,
  isAdmin,
}: {
  profile: UserProfile;
  family: Family | null;
  members: FamilyMember[];
  invites: FamilyInvite[];
  categories: Category[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const isOwner = profile.role === "owner";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)]">Aile Yönetimi</h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {family?.name ?? "Ailen"} için üyeleri, rolleri ve kategorileri yönet.
        </p>
      </div>

      <MembersCard
        profile={profile}
        members={members}
        invites={invites}
        isAdmin={isAdmin}
        router={router}
      />

      <CategoriesCard categories={categories} isAdmin={isAdmin} router={router} />

      {isAdmin && <DangerZoneCard family={family} isOwner={isOwner} router={router} />}
    </div>
  );
}

// =======================================================================
// Üyeler + davetler
// =======================================================================
function MembersCard({
  profile,
  members,
  invites,
  isAdmin,
  router,
}: {
  profile: UserProfile;
  members: FamilyMember[];
  invites: FamilyInvite[];
  isAdmin: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleInvite(formData: FormData) {
    setError(null);
    try {
      await inviteMemberAction(formData);
      setInviteOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Davet gönderilemedi.");
    }
  }

  async function handleRevoke(formData: FormData) {
    setError(null);
    try {
      await revokeInviteAction(formData);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Davet iptal edilemedi.");
    }
  }

  async function handleRoleChange(memberId: string, formData: FormData) {
    setError(null);
    setBusyId(memberId);
    try {
      await setMemberRoleAction(formData);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rol güncellenemedi.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleRemove(memberId: string, formData: FormData) {
    setError(null);
    setBusyId(memberId);
    try {
      await removeMemberAction(formData);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Üye çıkarılamadı.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand)] text-white">
            <Users className="h-4 w-4" />
          </span>
          <CardTitle className="!text-base !font-semibold text-[var(--text-primary)]">
            Aile Üyeleri
          </CardTitle>
        </div>
        {isAdmin && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-4 w-4" />
                Davet Et
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Aileye Üye Davet Et</DialogTitle>
              </DialogHeader>
              <form action={handleInvite} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="invite-email">E-posta</Label>
                  <Input id="invite-email" name="email" type="email" required placeholder="ornek@aile.com" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="invite-role">Rol</Label>
                  <Select name="role" defaultValue="member">
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INVITABLE_ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Davet, kişi bu e-posta ile giriş yaptığında otomatik olarak kabul edilir. Henüz
                  otomatik e-posta gönderimi yok — daveti kabul edeceği bağlantıyı sana gösterilen
                  koddan kopyalayıp kendisine ilet.
                </p>
                <ErrorText message={error} />
                <DialogFooter>
                  <Button type="submit">Davet Oluştur</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-0">
        <ErrorText message={error} />

        <div className="flex flex-col divide-y divide-[var(--border)]">
          {members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              isSelf={member.id === profile.id}
              isAdmin={isAdmin}
              busy={busyId === member.id}
              onRoleChange={handleRoleChange}
              onRemove={handleRemove}
            />
          ))}
        </div>

        {isAdmin && invites.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4">
            <p className="flex items-center gap-1.5 text-sm font-medium text-[var(--text-primary)]">
              <Mail className="h-3.5 w-3.5" />
              Bekleyen Davetler
            </p>
            <div className="flex flex-col gap-2">
              {invites.map((invite) => (
                <InviteRow key={invite.id} invite={invite} onRevoke={handleRevoke} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MemberRow({
  member,
  isSelf,
  isAdmin,
  busy,
  onRoleChange,
  onRemove,
}: {
  member: FamilyMember;
  isSelf: boolean;
  isAdmin: boolean;
  busy: boolean;
  onRoleChange: (memberId: string, formData: FormData) => void;
  onRemove: (memberId: string, formData: FormData) => void;
}) {
  const [selectedRole, setSelectedRole] = useState<MemberRole>(member.role);
  const dirty = selectedRole !== member.role;

  function saveRole() {
    const fd = new FormData();
    fd.set("memberId", member.id);
    fd.set("role", selectedRole);
    onRoleChange(member.id, fd);
  }

  function remove() {
    if (!confirm(`${member.full_name} aileden çıkarılsın mı? Bu işlem geri alınamaz.`)) return;
    const fd = new FormData();
    fd.set("memberId", member.id);
    onRemove(member.id, fd);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-2.5">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-2)] text-xs font-medium text-[var(--text-secondary)]">
          {member.full_name.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            {member.full_name}
            {isSelf && (
              <span className="ml-1.5 text-xs font-normal text-[var(--text-muted)]">(sen)</span>
            )}
          </p>
          <p className="text-xs text-[var(--text-secondary)]">{member.email}</p>
        </div>
      </div>

      {isAdmin && !isSelf ? (
        <div className="flex items-center gap-1.5">
          <Select
            value={selectedRole}
            onValueChange={(value) => setSelectedRole(value as MemberRole)}
            disabled={busy}
          >
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSIGNABLE_ROLE_OPTIONS.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {dirty && (
            <Button type="button" size="sm" disabled={busy} onClick={saveRole}>
              Kaydet
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Üyeyi çıkar"
            disabled={busy}
            className="text-[var(--critical)] hover:bg-[var(--critical-bg)]"
            onClick={remove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Badge variant={ROLE_BADGE_VARIANT[member.role]}>{ROLE_LABELS[member.role]}</Badge>
      )}
    </div>
  );
}

function InviteRow({
  invite,
  onRevoke,
}: {
  invite: FamilyInvite;
  onRevoke: (formData: FormData) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = `${window.location.origin}/davet/${invite.token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Panoya erişim engellenmişse sessizce yok say; kullanıcı elle kopyalayabilir.
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-2.5">
      <div>
        <p className="text-sm text-[var(--text-primary)]">{invite.email}</p>
        <p className="text-xs text-[var(--text-secondary)]">
          {ROLE_LABELS[invite.role]} · {formatDate(invite.expires_at)} tarihine kadar geçerli
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Kopyalandı" : "Linki Kopyala"}
        </Button>
        <form action={onRevoke}>
          <input type="hidden" name="id" value={invite.id} />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            aria-label="Daveti iptal et"
            className="text-[var(--critical)] hover:bg-[var(--critical-bg)]"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

// =======================================================================
// Kategoriler
// =======================================================================
function CategoriesCard({
  categories,
  isAdmin,
  router,
}: {
  categories: Category[];
  isAdmin: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const incomeCategories = categories.filter((c) => c.type === "income");
  const expenseCategories = categories.filter((c) => c.type === "expense");

  async function handleUpsert(formData: FormData) {
    setError(null);
    try {
      await upsertCategoryAction(formData);
      setDialogOpen(false);
      setEditing(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kategori kaydedilemedi.");
    }
  }

  async function handleDelete(formData: FormData) {
    setError(null);
    try {
      await deleteCategoryAction(formData);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kategori silinemedi.");
    }
  }

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setDialogOpen(true);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--brand)] text-white">
            <Tags className="h-4 w-4" />
          </span>
          <CardTitle className="!text-base !font-semibold text-[var(--text-primary)]">
            Kategoriler
          </CardTitle>
        </div>
        {isAdmin && (
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) setEditing(null);
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" onClick={openNew}>
                <Plus className="h-4 w-4" />
                Kategori Ekle
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Kategoriyi Düzenle" : "Yeni Kategori"}</DialogTitle>
              </DialogHeader>
              <form action={handleUpsert} className="flex flex-col gap-4">
                {editing && <input type="hidden" name="id" value={editing.id} />}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="category-name">Ad</Label>
                  <Input
                    id="category-name"
                    name="name"
                    defaultValue={editing?.name}
                    placeholder="Örn. Eğitim"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="category-type">Tür</Label>
                  <Select name="type" defaultValue={editing?.type ?? "expense"}>
                    <SelectTrigger id="category-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="expense">Gider</SelectItem>
                      <SelectItem value="income">Gelir</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Renk</Label>
                  <div className="flex flex-wrap gap-2">
                    {PALETTE.map((c) => (
                      <label key={c} className="cursor-pointer">
                        <input
                          type="radio"
                          name="color"
                          value={c}
                          defaultChecked={(editing?.color ?? PALETTE[0]) === c}
                          className="peer sr-only"
                        />
                        <span
                          className="block h-7 w-7 rounded-full ring-offset-2 peer-checked:ring-2"
                          style={{ backgroundColor: c }}
                        />
                      </label>
                    ))}
                  </div>
                </div>
                <ErrorText message={error} />
                <DialogFooter>
                  <Button type="submit">{editing ? "Kaydet" : "Ekle"}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-5 pt-0">
        <ErrorText message={error} />
        {categories.length === 0 ? (
          <p className="text-sm text-[var(--text-secondary)]">Henüz kategori eklenmedi.</p>
        ) : (
          <>
            <CategoryList
              title="Gider"
              items={expenseCategories}
              isAdmin={isAdmin}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
            <CategoryList
              title="Gelir"
              items={incomeCategories}
              isAdmin={isAdmin}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function CategoryList({
  title,
  items,
  isAdmin,
  onEdit,
  onDelete,
}: {
  title: string;
  items: Category[];
  isAdmin: boolean;
  onEdit: (category: Category) => void;
  onDelete: (formData: FormData) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((category) => (
          <div
            key={category.id}
            className="flex items-center gap-1.5 rounded-full border border-[var(--border)] py-1 pl-1 pr-1.5"
          >
            <span
              className="h-4 w-4 rounded-full"
              style={{ backgroundColor: category.color ?? "#898781" }}
            />
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => isAdmin && onEdit(category)}
              className="text-sm text-[var(--text-primary)] disabled:cursor-default"
            >
              {category.name}
            </button>
            {isAdmin && (
              <form action={onDelete}>
                <input type="hidden" name="id" value={category.id} />
                <button
                  type="submit"
                  aria-label={`${category.name} kategorisini sil`}
                  className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--critical-bg)] hover:text-[var(--critical)]"
                  onClick={(e) => {
                    if (!confirm(`"${category.name}" kategorisi silinsin mi?`)) {
                      e.preventDefault();
                    }
                  }}
                >
                  ×
                </button>
              </form>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// =======================================================================
// Tehlikeli bölge
// =======================================================================
function DangerZoneCard({
  family,
  isOwner,
  router,
}: {
  family: Family | null;
  isOwner: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const familyName = family?.name ?? "";
  const canConfirmDelete = confirmText.trim() === familyName && familyName.length > 0;

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      await deleteFamilyAction();
      // Aile (ve bu kullanıcının users satırı) silindi — profil artık yok,
      // bir sonraki adım yeni bir aile kurmak. router.refresh() DEĞİL,
      // doğrudan onboarding'e geçiyoruz.
      router.push("/onboarding");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Aile silinemedi.");
      setDeleting(false);
    }
  }

  return (
    <Card className="border-[var(--critical)]">
      <CardHeader className="flex-row items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--critical-bg)] text-[var(--critical)]">
          <ShieldAlert className="h-4 w-4" />
        </span>
        <CardTitle className="!text-base !font-semibold text-[var(--text-primary)]">
          Tehlikeli Bölge
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Aile verilerini dışa aktar</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Hesaplar, işlemler, kategoriler ve diğer tüm aile verilerini JSON olarak indir.
            </p>
          </div>
          <Button variant="outline" asChild>
            <a href="/aile/disa-aktar" download>
              <Download className="h-4 w-4" />
              Dışa Aktar
            </a>
          </Button>
        </div>

        {isOwner && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--critical)] p-3">
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">Aileyi sil</p>
              <p className="text-xs text-[var(--text-secondary)]">
                Tüm hesaplar, işlemler, kategoriler ve diğer üyelerin bu aileyle bağlantısı kalıcı
                olarak silinir. Geri alınamaz.
              </p>
            </div>
            <Dialog
              open={confirmOpen}
              onOpenChange={(open) => {
                setConfirmOpen(open);
                if (!open) {
                  setConfirmText("");
                  setError(null);
                }
              }}
            >
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4" />
                  Aileyi Sil
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Aileyi kalıcı olarak sil</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-3">
                  <p className="text-sm text-[var(--text-secondary)]">
                    Onaylamak için ailenin adını yaz: <strong className="text-[var(--text-primary)]">{familyName}</strong>
                  </p>
                  <Input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder={familyName}
                  />
                  <ErrorText message={error} />
                </div>
                <DialogFooter>
                  <Button
                    variant="destructive"
                    disabled={!canConfirmDelete || deleting}
                    onClick={handleDelete}
                  >
                    {deleting ? "Siliniyor…" : "Kalıcı Olarak Sil"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
