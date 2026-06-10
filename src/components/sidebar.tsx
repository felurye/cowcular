"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useGroupList } from "@/hooks/use-groups";
import { useNotificationList } from "@/hooks/use-notifications";
import { useTransferList } from "@/hooks/use-transfers";
import { getSupabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";

const GROUP_EMOJI: Record<string, string> = {
  HOME: "🏠",
  TRIP: "✈️",
  BBQ: "🍖",
  GIFT: "🎁",
  FUNDRAISER: "💰",
  GENERAL: "📋",
};

function NavItem({
  icon,
  label,
  href,
  active,
  badge,
  sub,
}: {
  icon: string;
  label: string;
  href: string;
  active: boolean;
  badge?: number;
  sub?: boolean;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 11,
        width: "100%",
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--ink)" : "var(--ink-soft)",
        padding: sub ? "8px 12px 8px 14px" : "10px 12px",
        borderRadius: 11,
        textDecoration: "none",
        fontSize: sub ? 13.5 : 14.5,
        fontWeight: active ? 700 : 560,
        boxShadow: active ? "0 1px 3px rgba(40,30,10,.10)" : "none",
        transition: "background .12s",
      }}
    >
      <span style={{ fontSize: sub ? 15 : 17, width: 20, textAlign: "center" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && badge > 0 && (
        <span
          style={{
            background: "var(--coral)",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            display: "grid",
            placeItems: "center",
            padding: "0 5px",
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

function UserInitials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        background: "var(--amber)",
        color: "#3a2a08",
        display: "grid",
        placeItems: "center",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: 14,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

type SidebarGroup = {
  id: string;
  name: string;
  type: string;
  event_type: string | null;
};

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const { data: rawGroups } = useGroupList();
  const groups = rawGroups as SidebarGroup[] | undefined;

  const { data: transfers } = useTransferList(undefined, { refetchInterval: 30_000 });
  const { data: notifications } = useNotificationList({ refetchInterval: 30_000 });

  const pendingTransfers =
    (
      transfers as
        | Array<{
            status: string;
            from_member: { user_id: string | null };
            to_member: { user_id: string | null };
          }>
        | undefined
    )?.filter(
      (t) =>
        (t.from_member.user_id === user?.id && t.status === "PENDING") ||
        (t.to_member.user_id === user?.id && t.status === "AWAITING_CONFIRMATION"),
    ).length ?? 0;

  const unreadNotifications =
    (notifications as Array<{ read: boolean }> | undefined)?.filter((n) => !n.read).length ?? 0;

  const handleLogout = async () => {
    logout();
    await getSupabase().auth.signOut();
    router.push("/login");
  };

  return (
    <aside
      style={{
        width: 260,
        flexShrink: 0,
        background: "var(--surface-alt)",
        borderRight: "1px solid var(--line)",
        height: "100vh",
        position: "sticky",
        top: 0,
        display: "flex",
        flexDirection: "column",
        padding: "20px 14px",
        gap: 0,
      }}
    >
      <div style={{ padding: "4px 8px 18px", display: "flex", alignItems: "center", gap: 9 }}>
        <Image
          src="/cow.png"
          width={30}
          height={30}
          alt="Cowcular"
          style={{ objectFit: "contain" }}
        />
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
          }}
        >
          cow<span style={{ color: "var(--amber-deep)" }}>cular</span>
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <NavItem icon="◎" label="Dashboard" href="/dashboard" active={pathname === "/dashboard"} />
        <NavItem
          icon="⇄"
          label="Repasses"
          href="/repasses"
          active={pathname === "/repasses"}
          badge={pendingTransfers}
        />
        <NavItem icon="▤" label="Relatórios" href="/reports" active={pathname === "/reports"} />
        <NavItem
          icon="🔔"
          label="Notificações"
          href="/notifications"
          active={pathname === "/notifications"}
          badge={unreadNotifications}
        />
      </div>

      <div
        style={{
          padding: "20px 12px 8px",
          fontSize: 11.5,
          fontWeight: 750,
          letterSpacing: ".08em",
          color: "var(--ink-faint)",
          textTransform: "uppercase",
        }}
      >
        Meus grupos
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 3,
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
        }}
      >
        {groups?.map((g) => {
          const icon =
            g.type === "HOME" ? GROUP_EMOJI.HOME : (GROUP_EMOJI[g.event_type ?? "GENERAL"] ?? "📋");
          const href = `/groups/${g.id}`;
          return (
            <NavItem
              key={g.id}
              sub
              icon={icon}
              label={g.name}
              href={href}
              active={pathname === href}
            />
          );
        })}
        <Link
          href="/dashboard?new=1"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 11,
            width: "100%",
            border: "1.5px dashed var(--line-strong)",
            background: "transparent",
            color: "var(--ink-faint)",
            marginTop: 4,
            padding: "9px 12px",
            borderRadius: 11,
            fontSize: 13.5,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>＋</span> Novo grupo
        </Link>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 10,
          borderRadius: 13,
          background: "var(--surface)",
          border: "1px solid var(--line)",
          marginTop: 12,
        }}
      >
        <Link href="/profile" style={{ textDecoration: "none", flexShrink: 0 }}>
          {user && <UserInitials name={user.name} />}
        </Link>
        <Link href="/profile" style={{ flex: 1, minWidth: 0, textDecoration: "none" }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: "var(--ink)" }}>{user?.name}</div>
          <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>@{user?.username}</div>
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          title="Sair"
          style={{
            background: "none",
            border: "none",
            color: "var(--ink-faint)",
            fontSize: 16,
            cursor: "pointer",
            padding: 4,
          }}
        >
          ⎋
        </button>
      </div>
    </aside>
  );
}
