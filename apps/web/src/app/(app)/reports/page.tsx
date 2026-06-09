"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/store/auth";

type GroupType = "HOME" | "EVENT";

interface ReportMember {
  id: string;
  userId: string | null;
  role: "ADMIN" | "MEMBER";
  user: { id: string; name: string } | null;
  externalName: string | null;
}

interface ReportGroup {
  id: string;
  name: string;
  type: GroupType;
  eventType: string | null;
  code: string;
  members: ReportMember[];
}

interface ReportAccount {
  id: string;
  title: string;
  amount: string | number;
  currency: string;
  dueDate: string | null;
  status: "OPEN" | "PAID" | "DEFERRED" | "CLOSED";
  type: "EXPENSE" | "INCOME";
  category: { id: string; name: string; color: string | null } | null;
}

interface ReportBalance {
  id: string;
  groupId: string;
  month: number;
  year: number;
  status: string;
  totalExpense: string | number;
  totalByMember: Record<string, number> | null;
}

interface ReportTransfer {
  id: string;
  amount: string | number;
  currency: string;
  month: number;
  year: number;
  status: string;
  fromMember: {
    userId: string | null;
    user: { name: string } | null;
    externalName: string | null;
  };
  toMember: {
    userId: string | null;
    user: { name: string } | null;
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

const CHART_COLORS = [
  "#E8A23D",
  "#3FA7A0",
  "#C2603F",
  "#6F6757",
  "#A79C89",
  "#2E8079",
  "#C07F1E",
  "#5A8B85",
];

const TRANSFER_STATUS: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pendente", color: "#C07F1E" },
  AWAITING_CONFIRMATION: { label: "Aguardando", color: "#3FA7A0" },
  CONFIRMED: { label: "Confirmado", color: "#2E8079" },
  OFFSET: { label: "Abatido", color: "#A79C89" },
  EXTERNAL_PAID: { label: "Pago (ext.)", color: "#2E8079" },
};

function fmtAmount(v: number | string, currency = "BRL") {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency });
}

function memberLabel(m: { user: { name: string } | null; externalName: string | null } | null) {
  if (!m) return "?";
  return m.user?.name ?? m.externalName ?? "Externo";
}

export default function ReportsPage() {
  const user = useAuthStore((s) => s.user);
  const { data: groups } = trpc.groups.list.useQuery();
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [period, setPeriod] = useState<3 | 6 | 12>(6);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const list = groups as ReportGroup[] | undefined;
    if (list?.length && !selectedGroupId) {
      setSelectedGroupId(list[0].id);
    }
  }, [groups, selectedGroupId]);

  const { data: rawAccounts } = trpc.accounts.list.useQuery(
    { groupId: selectedGroupId },
    { enabled: !!selectedGroupId },
  );

  const { data: rawBalances } = trpc.balances.list.useQuery(
    { groupId: selectedGroupId },
    { enabled: !!selectedGroupId },
  );

  const { data: rawTransfers } = trpc.transfers.list.useQuery(
    { groupId: selectedGroupId },
    { enabled: !!selectedGroupId },
  );

  const selectedGroup = (groups as ReportGroup[] | undefined)?.find(
    (g) => g.id === selectedGroupId,
  );

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth() - period + 1, 1);

  const accounts =
    (rawAccounts as ReportAccount[] | undefined)?.filter((a) => {
      if (!a.dueDate) return true;
      const d = new Date(a.dueDate);
      return d >= periodStart;
    }) ?? [];

  const balances = ((rawBalances as ReportBalance[] | undefined) ?? [])
    .filter((b) => {
      const d = new Date(b.year, b.month - 1, 1);
      return d >= periodStart;
    })
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));

  const transfers = (rawTransfers as ReportTransfer[] | undefined) ?? [];

  // PieChart data: expenses by category
  const catMap: Record<string, { value: number; color: string | null }> = {};
  for (const a of accounts) {
    if (a.type !== "EXPENSE") continue;
    const name = a.category?.name ?? "Sem categoria";
    const color = a.category?.color ?? null;
    if (!catMap[name]) catMap[name] = { value: 0, color };
    catMap[name].value += Number(a.amount);
  }
  const pieData = Object.entries(catMap).map(([name, { value, color }], i) => ({
    name,
    value: Math.round(value * 100) / 100,
    fill: color ?? CHART_COLORS[i % CHART_COLORS.length],
  }));

  // BarChart data: monthly expense total from balances
  const barData = balances.map((b) => ({
    name: `${MONTH_NAMES[b.month - 1]} ${String(b.year).slice(2)}`,
    total: Math.round(Number(b.totalExpense) * 100) / 100,
  }));

  // Member balance: sum totalByMember across closed balances
  const memberBalance: Record<string, number> = {};
  for (const b of balances) {
    if (!b.totalByMember) continue;
    for (const [memberId, amount] of Object.entries(b.totalByMember)) {
      memberBalance[memberId] = (memberBalance[memberId] ?? 0) + Number(amount);
    }
  }
  const memberBalanceRows = Object.entries(memberBalance).map(([memberId, net]) => {
    const member = selectedGroup?.members.find((m) => m.id === memberId);
    const name = member?.user?.name ?? member?.externalName ?? "Desconhecido";
    return { memberId, name, net };
  });

  const totalExpense = accounts
    .filter((a) => a.type === "EXPENSE" && a.status === "PAID")
    .reduce((s, a) => s + Number(a.amount), 0);

  const inputStyle: React.CSSProperties = {
    border: "1px solid var(--line-strong)",
    borderRadius: 11,
    padding: "9px 14px",
    fontSize: 14,
    fontFamily: "var(--font-body)",
    color: "var(--ink)",
    background: "var(--surface)",
    outline: "none",
    appearance: "none",
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
        <div style={{ flex: 1, minWidth: 0 }}>
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
            Relatórios
          </h1>
          <div style={{ marginTop: 3, fontSize: 13.5, color: "var(--ink-soft)" }}>
            Análise financeira dos seus grupos
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 32px 60px", display: "flex", flexDirection: "column", gap: 28 }}>
        {/* Filters */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            style={{ ...inputStyle, minWidth: 200 }}
          >
            {(groups as ReportGroup[] | undefined)?.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          <div
            style={{
              display: "flex",
              background: "var(--surface-2)",
              borderRadius: 11,
              padding: 3,
              gap: 2,
            }}
          >
            {([3, 6, 12] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                style={{
                  border: "none",
                  borderRadius: 8,
                  padding: "7px 14px",
                  fontSize: 13,
                  fontWeight: 650,
                  fontFamily: "var(--font-body)",
                  cursor: "pointer",
                  background: period === p ? "var(--surface)" : "transparent",
                  color: period === p ? "var(--ink)" : "var(--ink-soft)",
                  boxShadow: period === p ? "0 1px 3px rgba(40,30,10,.1)" : "none",
                }}
              >
                {p}m
              </button>
            ))}
          </div>

          {totalExpense > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 16px",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 11,
                fontSize: 13.5,
                color: "var(--ink-soft)",
              }}
            >
              Total pago: <strong style={{ color: "var(--ink)" }}>{fmtAmount(totalExpense)}</strong>
            </div>
          )}
        </div>

        {!selectedGroupId ? (
          <div
            style={{
              textAlign: "center",
              padding: "80px 32px",
              color: "var(--ink-faint)",
            }}
          >
            Selecione um grupo para ver os relatórios.
          </div>
        ) : (
          <>
            {/* Charts row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 20,
              }}
            >
              {/* Category PieChart */}
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 18,
                  padding: "22px 24px",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 18px",
                    fontSize: 14.5,
                    fontWeight: 750,
                    fontFamily: "var(--font-display)",
                    color: "var(--ink)",
                  }}
                >
                  Gastos por categoria
                </h3>
                {mounted && pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {pieData.map((entry, i) => (
                          <Cell
                            key={entry.name}
                            fill={entry.fill ?? CHART_COLORS[i % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: number) => fmtAmount(val)}
                        contentStyle={{
                          background: "var(--surface)",
                          border: "1px solid var(--line-strong)",
                          borderRadius: 10,
                          fontSize: 13,
                        }}
                      />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div
                    style={{
                      height: 240,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--ink-faint)",
                      fontSize: 13.5,
                    }}
                  >
                    {mounted ? "Sem dados de categoria no período." : "Carregando..."}
                  </div>
                )}
              </div>

              {/* Monthly BarChart */}
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 18,
                  padding: "22px 24px",
                }}
              >
                <h3
                  style={{
                    margin: "0 0 18px",
                    fontSize: 14.5,
                    fontWeight: 750,
                    fontFamily: "var(--font-display)",
                    color: "var(--ink)",
                  }}
                >
                  Evolução mensal
                </h3>
                {mounted && barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12, fill: "var(--ink-faint)" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "var(--ink-faint)" }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                      />
                      <Tooltip
                        formatter={(val: number) => [fmtAmount(val), "Total"]}
                        contentStyle={{
                          background: "var(--surface)",
                          border: "1px solid var(--line-strong)",
                          borderRadius: 10,
                          fontSize: 13,
                        }}
                      />
                      <Bar dataKey="total" fill="var(--amber)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div
                    style={{
                      height: 240,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--ink-faint)",
                      fontSize: 13.5,
                    }}
                  >
                    {mounted ? "Sem dados mensais no período." : "Carregando..."}
                  </div>
                )}
              </div>
            </div>

            {/* Member balance table (HOME groups with closed months) */}
            {selectedGroup?.type === "HOME" && memberBalanceRows.length > 0 && (
              <div
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 18,
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "18px 22px 14px" }}>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: 14.5,
                      fontWeight: 750,
                      fontFamily: "var(--font-display)",
                      color: "var(--ink)",
                    }}
                  >
                    Balanço por membro
                  </h3>
                  <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--ink-faint)" }}>
                    Saldo líquido nos meses fechados do período selecionado
                  </p>
                </div>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13.5,
                  }}
                >
                  <thead>
                    <tr style={{ borderTop: "1px solid var(--line)" }}>
                      {["Membro", "Saldo líquido", "Situação"].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 22px",
                            textAlign: h === "Membro" ? "left" : "right",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "var(--ink-faint)",
                            letterSpacing: ".04em",
                            textTransform: "uppercase",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {memberBalanceRows
                      .sort((a, b) => b.net - a.net)
                      .map((row) => (
                        <tr key={row.memberId} style={{ borderTop: "1px solid var(--line)" }}>
                          <td
                            style={{
                              padding: "12px 22px",
                              fontWeight: 600,
                              color: "var(--ink)",
                            }}
                          >
                            {row.name}
                          </td>
                          <td
                            style={{
                              padding: "12px 22px",
                              textAlign: "right",
                              fontWeight: 700,
                              fontFamily: "var(--font-mono)",
                              color: row.net >= 0 ? "var(--teal-deep)" : "var(--coral)",
                            }}
                          >
                            {row.net >= 0 ? "+" : ""}
                            {fmtAmount(row.net)}
                          </td>
                          <td
                            style={{
                              padding: "12px 22px",
                              textAlign: "right",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 650,
                                padding: "3px 10px",
                                borderRadius: 8,
                                background:
                                  row.net > 0
                                    ? "rgba(63,167,160,.12)"
                                    : row.net < 0
                                      ? "rgba(194,96,63,.1)"
                                      : "var(--surface-2)",
                                color:
                                  row.net > 0
                                    ? "var(--teal-deep)"
                                    : row.net < 0
                                      ? "var(--coral)"
                                      : "var(--ink-faint)",
                              }}
                            >
                              {row.net > 0 ? "A receber" : row.net < 0 ? "A pagar" : "Quitado"}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Transfer history table */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 18,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "18px 22px 14px",
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    fontSize: 14.5,
                    fontWeight: 750,
                    fontFamily: "var(--font-display)",
                    color: "var(--ink)",
                  }}
                >
                  Histórico de repasses
                </h3>
                <span
                  style={{
                    fontSize: 12.5,
                    color: "var(--ink-faint)",
                  }}
                >
                  {transfers.length} repasse{transfers.length !== 1 ? "s" : ""}
                </span>
              </div>

              {transfers.length === 0 ? (
                <div
                  style={{
                    padding: "32px",
                    textAlign: "center",
                    color: "var(--ink-faint)",
                    fontSize: 13.5,
                    borderTop: "1px solid var(--line)",
                  }}
                >
                  Nenhum repasse neste grupo.
                </div>
              ) : (
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13.5,
                  }}
                >
                  <thead>
                    <tr style={{ borderTop: "1px solid var(--line)" }}>
                      {["De", "Para", "Período", "Valor", "Status"].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 18px",
                            textAlign: h === "Valor" ? "right" : "left",
                            fontSize: 12,
                            fontWeight: 700,
                            color: "var(--ink-faint)",
                            letterSpacing: ".04em",
                            textTransform: "uppercase",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transfers.map((t) => {
                      const isMine =
                        t.fromMember.userId === user?.id || t.toMember.userId === user?.id;
                      const cfg = TRANSFER_STATUS[t.status] ?? {
                        label: t.status,
                        color: "var(--ink-faint)",
                      };
                      return (
                        <tr
                          key={t.id}
                          style={{
                            borderTop: "1px solid var(--line)",
                            background: isMine ? "rgba(232,162,61,.03)" : undefined,
                          }}
                        >
                          <td style={{ padding: "11px 18px", color: "var(--ink)" }}>
                            {memberLabel(t.fromMember)}
                          </td>
                          <td style={{ padding: "11px 18px", color: "var(--ink)" }}>
                            {memberLabel(t.toMember)}
                          </td>
                          <td style={{ padding: "11px 18px", color: "var(--ink-soft)" }}>
                            {MONTH_NAMES[t.month - 1]} {t.year}
                          </td>
                          <td
                            style={{
                              padding: "11px 18px",
                              textAlign: "right",
                              fontWeight: 700,
                              fontFamily: "var(--font-mono)",
                              color: "var(--ink)",
                            }}
                          >
                            {fmtAmount(t.amount, t.currency)}
                          </td>
                          <td style={{ padding: "11px 18px" }}>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 650,
                                padding: "3px 9px",
                                borderRadius: 7,
                                background: `${cfg.color}20`,
                                color: cfg.color,
                              }}
                            >
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
