"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/store/auth";

type TransferStatus =
  | "PENDING"
  | "AWAITING_CONFIRMATION"
  | "CONFIRMED"
  | "OFFSET"
  | "EXTERNAL_PAID";

interface Transfer {
  id: string;
  amount: number | string;
  currency: string;
  month: number;
  year: number;
  status: TransferStatus;
  groupId: string | null;
  fromMember: {
    id: string;
    userId: string | null;
    user: { id: string; username: string; name: string } | null;
    externalName: string | null;
  };
  toMember: {
    id: string;
    userId: string | null;
    user: { id: string; username: string; name: string } | null;
    externalName: string | null;
  };
}

const MONTH_NAMES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

const STATUS_CONFIG: Record<TransferStatus, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Pendente", color: "#C07F1E", bg: "rgba(232,162,61,.14)" },
  AWAITING_CONFIRMATION: { label: "Aguardando", color: "#3FA7A0", bg: "rgba(63,167,160,.12)" },
  CONFIRMED: { label: "Confirmado", color: "#2E8079", bg: "rgba(46,128,121,.12)" },
  OFFSET: { label: "Abatido", color: "#A79C89", bg: "rgba(167,156,137,.12)" },
  EXTERNAL_PAID: { label: "Pago (ext.)", color: "#2E8079", bg: "rgba(46,128,121,.12)" },
};

function fmtAmount(v: number | string, currency = "BRL") {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency });
}

function memberName(m: { user: { name: string } | null; externalName: string | null } | null) {
  if (!m) return "?";
  return m.user?.name ?? m.externalName ?? "Externo";
}

type FilterDir = "all" | "sent" | "received";
type FilterStatus = TransferStatus | "";

export default function RepassesPage() {
  const user = useAuthStore((s) => s.user);
  const [filterDir, setFilterDir] = useState<FilterDir>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("");
  const [error, setError] = useState("");
  const utils = trpc.useUtils();

  const { data: transfers, isLoading } = trpc.transfers.list.useQuery({});

  const markPaidMutation = trpc.transfers.markPaid.useMutation({
    onSuccess: () => void utils.transfers.list.invalidate(),
    onError: (e) => setError(e.message),
  });

  const confirmMutation = trpc.transfers.confirm.useMutation({
    onSuccess: () => void utils.transfers.list.invalidate(),
    onError: (e) => setError(e.message),
  });

  const list = (transfers as Transfer[] | undefined) ?? [];

  const filtered = list.filter((t) => {
    const isSent = t.fromMember.userId === user?.id;
    const isReceived = t.toMember.userId === user?.id;
    if (filterDir === "sent" && !isSent) return false;
    if (filterDir === "received" && !isReceived) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    return true;
  });

  const pendingCount = list.filter(
    (t) =>
      (t.fromMember.userId === user?.id && t.status === "PENDING") ||
      (t.toMember.userId === user?.id && t.status === "AWAITING_CONFIRMATION"),
  ).length;

  return (
    <>
      {/* Topbar */}
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
              Repasses
            </h1>
            {pendingCount > 0 && (
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
                {pendingCount}
              </span>
            )}
          </div>
          <div style={{ marginTop: 3, fontSize: 13.5, color: "var(--ink-soft)" }}>
            Repasses entre membros dos seus grupos
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "24px 32px 60px" }}>
        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              background: "var(--surface-2)",
              borderRadius: 11,
              padding: 3,
              gap: 2,
            }}
          >
            {(["all", "sent", "received"] as FilterDir[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setFilterDir(d)}
                style={{
                  border: "none",
                  borderRadius: 8,
                  padding: "7px 13px",
                  fontSize: 13,
                  fontWeight: 650,
                  fontFamily: "var(--font-body)",
                  cursor: "pointer",
                  background: filterDir === d ? "var(--surface)" : "transparent",
                  color: filterDir === d ? "var(--ink)" : "var(--ink-soft)",
                  boxShadow: filterDir === d ? "0 1px 3px rgba(40,30,10,.1)" : "none",
                }}
              >
                {d === "all" ? "Todos" : d === "sent" ? "↑ Devo" : "↓ Me devem"}
              </button>
            ))}
          </div>

          <select
            style={{
              border: "1px solid var(--line-strong)",
              borderRadius: 10,
              padding: "7px 12px",
              fontSize: 13,
              fontFamily: "var(--font-body)",
              color: "var(--ink)",
              background: "var(--surface)",
              outline: "none",
              appearance: "none",
            }}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          >
            <option value="">Todos os status</option>
            {(Object.keys(STATUS_CONFIG) as TransferStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_CONFIG[s].label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div
            style={{
              background: "rgba(194,96,63,.1)",
              border: "1px solid rgba(194,96,63,.3)",
              borderRadius: 10,
              padding: "10px 14px",
              fontSize: 13.5,
              color: "var(--coral)",
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                style={{
                  height: 72,
                  background: "var(--surface-2)",
                  borderRadius: 13,
                  animation: "pulse 1.5s infinite",
                }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 32px",
              color: "var(--ink-faint)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 48 }}>⇄</span>
            <p style={{ fontSize: 15, margin: 0, color: "var(--ink-soft)" }}>
              Nenhum repasse encontrado.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((t) => {
              const isSent = t.fromMember.userId === user?.id;
              const cfg = STATUS_CONFIG[t.status];
              const otherMember = isSent ? t.toMember : t.fromMember;

              return (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 18px",
                    background: "var(--surface)",
                    border: "1px solid var(--line)",
                    borderRadius: 14,
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 18,
                      background: isSent ? "rgba(194,96,63,.1)" : "rgba(63,167,160,.1)",
                      flexShrink: 0,
                    }}
                  >
                    {isSent ? "↑" : "↓"}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 650,
                        fontSize: 14.5,
                        color: "var(--ink)",
                      }}
                    >
                      {isSent ? `Para ${memberName(otherMember)}` : `De ${memberName(otherMember)}`}
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "var(--ink-faint)",
                        marginTop: 2,
                        display: "flex",
                        gap: 8,
                      }}
                    >
                      <span>
                        {MONTH_NAMES[t.month - 1]} {t.year}
                      </span>
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 650,
                      padding: "3px 9px",
                      borderRadius: 7,
                      background: cfg.bg,
                      color: cfg.color,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cfg.label}
                  </span>

                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 16,
                      color: isSent ? "var(--coral)" : "var(--teal-deep)",
                      whiteSpace: "nowrap",
                      minWidth: 110,
                      textAlign: "right",
                    }}
                  >
                    {isSent ? "-" : "+"}
                    {fmtAmount(t.amount, t.currency)}
                  </span>

                  {isSent && t.status === "PENDING" && (
                    <button
                      type="button"
                      disabled={markPaidMutation.isPending}
                      onClick={() => {
                        setError("");
                        markPaidMutation.mutate({ id: t.id });
                      }}
                      style={{
                        background: "rgba(232,162,61,.14)",
                        color: "var(--amber-deep)",
                        border: "none",
                        borderRadius: 9,
                        padding: "8px 14px",
                        fontSize: 13,
                        fontWeight: 650,
                        cursor: "pointer",
                        fontFamily: "var(--font-body)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Marcar pago
                    </button>
                  )}

                  {!isSent && t.status === "AWAITING_CONFIRMATION" && (
                    <button
                      type="button"
                      disabled={confirmMutation.isPending}
                      onClick={() => {
                        setError("");
                        confirmMutation.mutate({ id: t.id });
                      }}
                      style={{
                        background: "rgba(63,167,160,.15)",
                        color: "var(--teal-deep)",
                        border: "none",
                        borderRadius: 9,
                        padding: "8px 14px",
                        fontSize: 13,
                        fontWeight: 650,
                        cursor: "pointer",
                        fontFamily: "var(--font-body)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Confirmar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
