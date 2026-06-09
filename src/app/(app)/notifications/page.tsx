"use client";

import { useRouter } from "next/navigation";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationList,
} from "@/hooks/use-notifications";

interface Notification {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

const NOTIFICATION_CONFIG: Record<
  string,
  {
    icon: string;
    label: (p: Record<string, unknown>) => string;
    href: (p: Record<string, unknown>) => string;
  }
> = {
  GROUP_INVITE: {
    icon: "👋",
    label: (p) => `Você foi convidado para ${p.groupName ?? "um grupo"}`,
    href: (p) => (p.groupId ? `/groups/${p.groupId}` : "/dashboard"),
  },
  NEW_ACCOUNT: {
    icon: "💸",
    label: (p) => `Nova conta em ${p.groupName ?? "um grupo"}`,
    href: (p) => (p.groupId ? `/groups/${p.groupId}` : "/dashboard"),
  },
  TRANSFER_PENDING: {
    icon: "⇄",
    label: () => "Novo repasse aguardando pagamento",
    href: () => "/repasses",
  },
  TRANSFER_CONFIRMED: {
    icon: "✓",
    label: () => "Repasse confirmado",
    href: () => "/repasses",
  },
  MONTH_CLOSED: {
    icon: "📊",
    label: (p) =>
      `Mês ${p.month ?? ""}/${p.year ?? ""} fechado${p.groupName ? ` em ${p.groupName}` : ""}`,
    href: (p) => (p.groupId ? `/groups/${p.groupId}` : "/dashboard"),
  },
  MONTH_AWAITING_CLOSE: {
    icon: "⏰",
    label: (p) => `Mês ${p.month ?? ""}/${p.year ?? ""} aguardando fechamento`,
    href: (p) => (p.groupId ? `/groups/${p.groupId}` : "/dashboard"),
  },
  GROUP_CLOSED: {
    icon: "🔒",
    label: (p) => `Grupo ${p.groupName ?? ""} encerrado`,
    href: () => "/dashboard",
  },
  ACCOUNT_DUE: {
    icon: "📅",
    label: (p) => `Conta vencendo: ${p.title ?? ""}`,
    href: (p) => (p.groupId ? `/groups/${p.groupId}` : "/dashboard"),
  },
};

function timeAgo(iso: string) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `há ${diffD}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function NotificationsPage() {
  const router = useRouter();

  const { data: rawNotifications, isLoading } = useNotificationList({ refetchInterval: 30_000 });
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const notifications = (rawNotifications as Notification[] | undefined) ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleClick = (n: Notification) => {
    if (!n.read) {
      markReadMutation.mutate({ id: n.id });
    }
    const cfg = NOTIFICATION_CONFIG[n.type];
    const href = cfg?.href(n.payload) ?? "/dashboard";
    router.push(href);
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "20px 32px 18px",
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "var(--bg-blur)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10 }}>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: 25,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
            }}
          >
            Notificações
          </h1>
          {unreadCount > 0 && (
            <span
              style={{
                background: "var(--coral)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                minWidth: 22,
                height: 22,
                borderRadius: 11,
                display: "grid",
                placeItems: "center",
                padding: "0 6px",
              }}
            >
              {unreadCount}
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            disabled={markAllReadMutation.isPending}
            onClick={() => markAllReadMutation.mutate()}
            style={{
              background: "var(--surface-2)",
              color: "var(--ink-soft)",
              border: "1px solid var(--line-strong)",
              borderRadius: 10,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 650,
              fontFamily: "var(--font-body)",
              cursor: markAllReadMutation.isPending ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Marcar todas como lidas
          </button>
        )}
      </div>

      <div style={{ padding: "16px 32px 60px" }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  height: 68,
                  background: "var(--surface-2)",
                  borderRadius: 14,
                  animation: "pulse 1.5s infinite",
                }}
              />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 32px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 48 }}>🔔</span>
            <p style={{ fontSize: 15, margin: 0, color: "var(--ink-soft)" }}>
              Sem notificações por aqui.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {notifications.map((n) => {
              const cfg = NOTIFICATION_CONFIG[n.type];
              const icon = cfg?.icon ?? "🔔";
              const label = cfg?.label(n.payload) ?? n.type;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleClick(n)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    padding: "14px 18px",
                    background: n.read ? "var(--surface)" : "rgba(232,162,61,.07)",
                    border: `1px solid ${n.read ? "var(--line)" : "rgba(232,162,61,.22)"}`,
                    borderRadius: 14,
                    textAlign: "left",
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                    transition: "background .12s",
                    width: "100%",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 11,
                      background: n.read ? "var(--surface-2)" : "rgba(232,162,61,.14)",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    {icon}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: n.read ? 560 : 680,
                        color: "var(--ink)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-faint)", marginTop: 3 }}>
                      {timeAgo(n.created_at)}
                    </div>
                  </div>

                  {!n.read && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--amber-deep)",
                        flexShrink: 0,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
