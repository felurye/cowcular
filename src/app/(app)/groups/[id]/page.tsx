"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  useAccountList,
  useCreateAccount,
  useDeferAccount,
  useDeleteAccount,
  useMarkAccountPaid,
  useUnmarkAccountPaid,
  useUpdateAccount,
} from "@/hooks/use-accounts";
import {
  type BalancePreview,
  useBalanceList,
  useBalancePreview,
  useCloseBalance,
} from "@/hooks/use-balances";
import {
  type CategoryItem,
  useCategoryList,
  useCreateCategory,
  useDeleteCategory,
} from "@/hooks/use-categories";
import {
  type CategoryBudget,
  useCategoryBudgets,
  useCreateCategoryBudget,
  useDeleteCategoryBudget,
  useUpdateCategoryBudget,
} from "@/hooks/use-category-budgets";
import {
  useAddExternalMember,
  useCloseGroup,
  useGroup,
  useInviteByEmail,
  useInviteByUsername,
  useRemoveMember,
  useUpdateGroup,
} from "@/hooks/use-groups";
import { useConfirmTransfer, useMarkTransferPaid, useTransferList } from "@/hooks/use-transfers";
import { useAuthStore } from "@/store/auth";

// ─── Types ───────────────────────────────────────────────────────────────────

type GroupType = "HOME" | "EVENT";
type EventType = "TRIP" | "BBQ" | "GIFT" | "FUNDRAISER" | "GENERAL";
type MemberRole = "ADMIN" | "MEMBER";
type AccountStatus = "OPEN" | "PAID" | "DEFERRED" | "CLOSED";
type AccountType = "EXPENSE" | "INCOME";
type Recurrence = "ONCE" | "RECURRING" | "INSTALLMENT";
type TransferStatus =
  | "PENDING"
  | "AWAITING_CONFIRMATION"
  | "CONFIRMED"
  | "OFFSET"
  | "EXTERNAL_PAID";

interface Member {
  id: string;
  user_id: string | null;
  role: MemberRole;
  left_at: string | null;
  external_name: string | null;
  external_contact: string | null;
  user: { id: string; username: string; name: string; avatar: string | null } | null;
}

interface Group {
  id: string;
  name: string;
  type: GroupType;
  event_type: EventType | null;
  code: string;
  status: "ACTIVE" | "CLOSED";
  closing_mode: "AUTO" | "MANUAL" | null;
  default_split: unknown;
  members: Member[];
  balances: Balance[];
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
}

interface AccountSplit {
  id: string;
  member_id: string;
  percentage: number;
  amount_due: number;
  status: "PENDING" | "PAID";
  member: {
    id: string;
    user: { id: string; username: string; name: string } | null;
    external_name: string | null;
  };
}

interface Account {
  id: string;
  title: string;
  amount: number | string;
  currency: string;
  due_date: string | null;
  status: AccountStatus;
  type: AccountType;
  recurrence: Recurrence;
  total_installments: number | null;
  installment_number: number | null;
  category: Category | null;
  paid_by: {
    id: string;
    user: { id: string; username: string; name: string } | null;
    external_name: string | null;
  } | null;
  splits: AccountSplit[];
}

interface Transfer {
  id: string;
  amount: number | string;
  currency: string;
  month: number;
  year: number;
  status: TransferStatus;
  from_member: {
    id: string;
    user_id: string | null;
    user: { id: string; username: string; name: string } | null;
    external_name: string | null;
  };
  to_member: {
    id: string;
    user_id: string | null;
    user: { id: string; username: string; name: string } | null;
    external_name: string | null;
  };
}

interface Balance {
  id: string;
  month: number;
  year: number;
  status: "OPEN" | "CLOSED";
  total_expense: number | string | null;
  total_by_member: unknown;
  closed_at: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUP_EMOJI: Record<string, string> = {
  HOME: "🏠",
  TRIP: "✈️",
  BBQ: "🍖",
  GIFT: "🎁",
  FUNDRAISER: "💰",
  GENERAL: "📋",
};

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

const STATUS_CONFIG: Record<AccountStatus, { label: string; color: string; bg: string }> = {
  OPEN: { label: "Aberta", color: "#6F6757", bg: "rgba(111,103,87,.1)" },
  PAID: { label: "Paga", color: "#2E8079", bg: "rgba(63,167,160,.12)" },
  DEFERRED: { label: "Adiada", color: "#C07F1E", bg: "rgba(232,162,61,.14)" },
  CLOSED: { label: "Fechada", color: "#A79C89", bg: "rgba(167,156,137,.12)" },
};

const TRANSFER_STATUS_CONFIG: Record<TransferStatus, { label: string; color: string; bg: string }> =
  {
    PENDING: { label: "Pendente", color: "#C07F1E", bg: "rgba(232,162,61,.14)" },
    AWAITING_CONFIRMATION: { label: "Aguardando", color: "#3FA7A0", bg: "rgba(63,167,160,.12)" },
    CONFIRMED: { label: "Confirmado", color: "#2E8079", bg: "rgba(46,128,121,.12)" },
    OFFSET: { label: "Abatido", color: "#A79C89", bg: "rgba(167,156,137,.12)" },
    EXTERNAL_PAID: { label: "Pago (ext.)", color: "#2E8079", bg: "rgba(46,128,121,.12)" },
  };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtAmount(v: number | string, currency = "BRL") {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency });
}

function fmtDate(d: string | null) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("pt-BR");
}

function memberName(m: { user: { name: string } | null; external_name: string | null } | null) {
  if (!m) return "?";
  return m.user?.name ?? m.external_name ?? "Externo";
}

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line-strong)",
  borderRadius: 11,
  padding: "10px 14px",
  fontSize: 14,
  fontFamily: "var(--font-body)",
  color: "var(--ink)",
  background: "var(--surface)",
  width: "100%",
  outline: "none",
};

const selectStyle: React.CSSProperties = { ...inputStyle, appearance: "none" };

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--ink-soft)",
};

function ModalBackdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop closes on click
    // biome-ignore lint/a11y/useKeyWithClickEvents: handled by Escape key in parent
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(42,36,27,.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16,
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: stop propagation */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: handled by Escape key */}
      <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  );
}

function ModalCard({
  title,
  onClose,
  children,
  maxWidth = 480,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: 20,
        padding: 28,
        width: "100%",
        maxWidth,
        boxShadow: "0 24px 60px -16px rgba(40,30,10,.3)",
        maxHeight: "90vh",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 800,
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.01em",
            color: "var(--ink)",
          }}
        >
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 20,
            color: "var(--ink-faint)",
            padding: 4,
          }}
        >
          ×
        </button>
      </div>
      {children}
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
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
      {msg}
    </div>
  );
}

// ─── CategorySelect ───────────────────────────────────────────────────────────

function CategorySelect({
  groupId,
  value,
  onChange,
  onError,
}: {
  groupId: string;
  value: string;
  onChange: (id: string) => void;
  onError: (msg: string) => void;
}) {
  const { data: categories } = useCategoryList(groupId);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");

  const createMutation = useCreateCategory({
    onSuccess: (created) => {
      onChange(created.id);
      setShowNew(false);
      setNewName("");
    },
    onError: (e) => onError(e.message),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={labelStyle}>Categoria</span>
      <select style={selectStyle} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sem categoria</option>
        {(categories as CategoryItem[] | undefined)?.map((c) => (
          <option key={c.id} value={c.id}>
            {c.icon ? `${c.icon} ` : ""}
            {c.name}
          </option>
        ))}
      </select>
      {showNew ? (
        <div style={{ display: "flex", gap: 6 }}>
          <input
            placeholder="Nome da categoria"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            // biome-ignore lint/a11y/noAutofocus: foco intencional ao abrir campo de nova categoria
            autoFocus
            style={{ ...inputStyle, flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                e.preventDefault();
                createMutation.mutate({ name: newName.trim(), groupId });
              }
              if (e.key === "Escape") {
                setShowNew(false);
                setNewName("");
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              setShowNew(false);
              setNewName("");
            }}
            style={{
              background: "transparent",
              color: "var(--ink-faint)",
              border: "1px solid var(--line-strong)",
              borderRadius: 9,
              padding: "8px 10px",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              whiteSpace: "nowrap",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!newName.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate({ name: newName.trim(), groupId })}
            style={{
              background: "var(--amber)",
              color: "#3a2a08",
              border: "none",
              borderRadius: 9,
              padding: "8px 12px",
              fontSize: 13,
              fontWeight: 650,
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              whiteSpace: "nowrap",
            }}
          >
            Criar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNew(true)}
          style={{
            alignSelf: "flex-start",
            background: "transparent",
            border: "none",
            color: "var(--ink-faint)",
            fontSize: 12.5,
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            padding: 0,
          }}
        >
          + Nova categoria
        </button>
      )}
    </div>
  );
}

// ─── CreateAccountModal ───────────────────────────────────────────────────────

function CreateAccountModal({
  group,
  onClose,
  onSuccess,
}: {
  group: Group;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const activeMembers = group.members.filter((m) => !m.left_at);
  const defaultSplit = group.default_split as Record<string, number> | null;

  const getInitialSplits = () => {
    if (defaultSplit) {
      return Object.entries(defaultSplit).map(([memberId, pct]) => ({
        memberId,
        percentage: pct,
      }));
    }
    const eq = Math.round((100 / activeMembers.length) * 100) / 100;
    return activeMembers.map((m, i) => ({
      memberId: m.id,
      percentage: i === 0 ? 100 - eq * (activeMembers.length - 1) : eq,
    }));
  };

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState<AccountType>("EXPENSE");
  const [recurrence, setRecurrence] = useState<Recurrence>("ONCE");
  const [totalInstallments, setTotalInstallments] = useState("2");
  const [paidByMemberId, setPaidByMemberId] = useState(activeMembers[0]?.id ?? "");
  const [useSplits, setUseSplits] = useState(activeMembers.length > 1);
  const [splits, setSplits] = useState(getInitialSplits);
  const [error, setError] = useState("");

  const createMutation = useCreateAccount({
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  const splitTotal = splits.reduce((s, x) => s + (Number(x.percentage) || 0), 0);

  const handleSplitChange = (memberId: string, pct: string) => {
    setSplits((prev) =>
      prev.map((s) => (s.memberId === memberId ? { ...s, percentage: Number(pct) || 0 } : s)),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!paidByMemberId) return setError("Selecione quem pagou.");
    if (useSplits && Math.abs(splitTotal - 100) > 0.1)
      return setError("A divisão deve somar 100%.");

    createMutation.mutate({
      title,
      amount: Number(amount),
      dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
      categoryId: categoryId || undefined,
      type,
      recurrence,
      totalInstallments: recurrence === "INSTALLMENT" ? Number(totalInstallments) : undefined,
      groupId: group.id,
      paidByMemberId,
      splits: useSplits
        ? splits.map((s) => ({ memberId: s.memberId, percentage: Number(s.percentage) }))
        : undefined,
    });
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <ModalCard title="Nova conta" onClose={onClose} maxWidth={500}>
        {error && <ErrorBanner msg={error} />}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              display: "flex",
              background: "var(--surface-2)",
              borderRadius: 11,
              padding: 3,
              gap: 2,
            }}
          >
            {(["EXPENSE", "INCOME"] as AccountType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                style={{
                  flex: 1,
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13.5,
                  fontWeight: 650,
                  fontFamily: "var(--font-body)",
                  cursor: "pointer",
                  background: type === t ? "var(--surface)" : "transparent",
                  color: type === t ? "var(--ink)" : "var(--ink-soft)",
                  boxShadow: type === t ? "0 1px 3px rgba(40,30,10,.12)" : "none",
                }}
              >
                {t === "EXPENSE" ? "💸 Despesa" : "💰 Receita"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 5 }}>
              <label htmlFor="ac-title" style={labelStyle}>
                Título
              </label>
              <input
                id="ac-title"
                style={inputStyle}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Conta de luz"
                required
              />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
              <label htmlFor="ac-amount" style={labelStyle}>
                Valor (R$)
              </label>
              <input
                id="ac-amount"
                style={inputStyle}
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
              <label htmlFor="ac-due" style={labelStyle}>
                Vencimento
              </label>
              <input
                id="ac-due"
                style={inputStyle}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <CategorySelect
                groupId={group.id}
                value={categoryId}
                onChange={setCategoryId}
                onError={setError}
              />
            </div>
          </div>

          {group.type === "HOME" && (
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                <label htmlFor="ac-rec" style={labelStyle}>
                  Recorrência
                </label>
                <select
                  id="ac-rec"
                  style={selectStyle}
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as Recurrence)}
                >
                  <option value="ONCE">Única</option>
                  <option value="RECURRING">Recorrente (mensal)</option>
                  <option value="INSTALLMENT">Parcelada</option>
                </select>
              </div>
              {recurrence === "INSTALLMENT" && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                  <label htmlFor="ac-inst" style={labelStyle}>
                    Parcelas
                  </label>
                  <input
                    id="ac-inst"
                    style={inputStyle}
                    type="number"
                    min="2"
                    max="60"
                    value={totalInstallments}
                    onChange={(e) => setTotalInstallments(e.target.value)}
                  />
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label htmlFor="ac-paid-by" style={labelStyle}>
              Quem pagou
            </label>
            <select
              id="ac-paid-by"
              style={selectStyle}
              value={paidByMemberId}
              onChange={(e) => setPaidByMemberId(e.target.value)}
              required
            >
              {activeMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {memberName(m)}
                </option>
              ))}
            </select>
          </div>

          {activeMembers.length > 1 && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span style={labelStyle}>Divisão entre membros</span>
                <button
                  type="button"
                  onClick={() => setUseSplits((v) => !v)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12.5,
                    color: "var(--amber-deep)",
                    fontWeight: 650,
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {useSplits ? "Remover divisão" : "Adicionar divisão"}
                </button>
              </div>
              {useSplits && (
                <div
                  style={{
                    background: "var(--surface-alt)",
                    borderRadius: 12,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {splits.map((s) => {
                    const m = activeMembers.find((mb) => mb.id === s.memberId);
                    return (
                      <div
                        key={s.memberId}
                        style={{ display: "flex", alignItems: "center", gap: 10 }}
                      >
                        <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>
                          {memberName(m ?? null)}
                        </span>
                        <input
                          style={{ ...inputStyle, width: 80, textAlign: "right" }}
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={s.percentage}
                          onChange={(e) => handleSplitChange(s.memberId, e.target.value)}
                        />
                        <span style={{ fontSize: 13, color: "var(--ink-soft)", width: 14 }}>%</span>
                      </div>
                    );
                  })}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      gap: 6,
                      paddingTop: 4,
                      borderTop: "1px solid var(--line)",
                      marginTop: 4,
                    }}
                  >
                    <span style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>Total:</span>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color:
                          Math.abs(splitTotal - 100) < 0.1 ? "var(--teal-deep)" : "var(--coral)",
                      }}
                    >
                      {splitTotal.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                background: "transparent",
                border: "1.5px solid var(--line-strong)",
                color: "var(--ink)",
                fontFamily: "var(--font-body)",
                fontWeight: 650,
                fontSize: 14,
                borderRadius: 11,
                padding: "10px 16px",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              style={{
                flex: 1,
                background: createMutation.isPending ? "var(--amber-soft)" : "var(--amber)",
                color: "#3a2a08",
                fontFamily: "var(--font-body)",
                fontWeight: 680,
                fontSize: 14,
                border: "none",
                borderRadius: 11,
                padding: "10px 16px",
                cursor: createMutation.isPending ? "not-allowed" : "pointer",
              }}
            >
              {createMutation.isPending ? "Salvando..." : "Salvar conta"}
            </button>
          </div>
        </form>
      </ModalCard>
    </ModalBackdrop>
  );
}

// ─── EditAccountModal ─────────────────────────────────────────────────────────

const RECURRENCE_LABEL: Record<Recurrence, string> = {
  ONCE: "Única",
  RECURRING: "Recorrente",
  INSTALLMENT: "Parcelada",
};

function EditAccountModal({
  account,
  group,
  onClose,
  onSuccess,
}: {
  account: Account;
  group: Group;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const activeMembers = group.members.filter((m) => !m.left_at);

  const getEditSplits = () => {
    if (account.splits.length > 0) {
      const existing = Object.fromEntries(account.splits.map((s) => [s.member_id, s.percentage]));
      return activeMembers.map((m) => ({
        memberId: m.id,
        percentage: existing[m.id] ?? 0,
      }));
    }
    const eq = Math.round((100 / activeMembers.length) * 100) / 100;
    return activeMembers.map((m, i) => ({
      memberId: m.id,
      percentage: i === 0 ? 100 - eq * (activeMembers.length - 1) : eq,
    }));
  };

  const [title, setTitle] = useState(account.title);
  const [amount, setAmount] = useState(String(account.amount));
  const [dueDate, setDueDate] = useState(() =>
    account.due_date ? account.due_date.split("T")[0] : "",
  );
  const [categoryId, setCategoryId] = useState(account.category?.id ?? "");
  const [type, setType] = useState<AccountType>(account.type);
  const [paidByMemberId, setPaidByMemberId] = useState(account.paid_by?.id ?? "");
  const [useSplits, setUseSplits] = useState(account.splits.length > 0);
  const [splits, setSplits] = useState(getEditSplits);
  const [replicateToFuture, setReplicateToFuture] = useState(false);
  const [error, setError] = useState("");

  const updateMutation = useUpdateAccount({
    onSuccess: () => onSuccess(),
    onError: (err) => setError(err.message),
  });

  const splitTotal = splits.reduce((s, x) => s + (Number(x.percentage) || 0), 0);

  const handleSplitChange = (memberId: string, pct: string) => {
    setSplits((prev) =>
      prev.map((s) => (s.memberId === memberId ? { ...s, percentage: Number(pct) || 0 } : s)),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!paidByMemberId) return setError("Selecione quem pagou.");
    if (useSplits && Math.abs(splitTotal - 100) > 0.1)
      return setError("A divisão deve somar 100%.");

    updateMutation.mutate({
      id: account.id,
      data: {
        title,
        amount: Number(amount),
        dueDate: dueDate || null,
        categoryId: categoryId || null,
        type,
        paidByMemberId,
        splits: useSplits
          ? splits.map((s) => ({ memberId: s.memberId, percentage: Number(s.percentage) }))
          : [],
        replicateToFuture: account.recurrence === "RECURRING" ? replicateToFuture : false,
      },
    });
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <ModalCard title="Editar conta" onClose={onClose} maxWidth={500}>
        {error && <ErrorBanner msg={error} />}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              display: "flex",
              background: "var(--surface-2)",
              borderRadius: 11,
              padding: 3,
              gap: 2,
            }}
          >
            {(["EXPENSE", "INCOME"] as AccountType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                style={{
                  flex: 1,
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13.5,
                  fontWeight: 650,
                  fontFamily: "var(--font-body)",
                  cursor: "pointer",
                  background: type === t ? "var(--surface)" : "transparent",
                  color: type === t ? "var(--ink)" : "var(--ink-soft)",
                  boxShadow: type === t ? "0 1px 3px rgba(40,30,10,.12)" : "none",
                }}
              >
                {t === "EXPENSE" ? "💸 Despesa" : "💰 Receita"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 2, display: "flex", flexDirection: "column", gap: 5 }}>
              <label htmlFor="ed-title" style={labelStyle}>
                Título
              </label>
              <input
                id="ed-title"
                style={inputStyle}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
              <label htmlFor="ed-amount" style={labelStyle}>
                Valor (R$)
              </label>
              <input
                id="ed-amount"
                style={inputStyle}
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
              <label htmlFor="ed-due" style={labelStyle}>
                Vencimento
              </label>
              <input
                id="ed-due"
                style={inputStyle}
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <CategorySelect
                groupId={group.id}
                value={categoryId}
                onChange={setCategoryId}
                onError={setError}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={labelStyle}>Recorrência:</span>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 650,
                padding: "3px 9px",
                borderRadius: 8,
                background: "var(--surface-2)",
                color: "var(--ink-soft)",
              }}
            >
              {RECURRENCE_LABEL[account.recurrence]}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label htmlFor="ed-paid-by" style={labelStyle}>
              Quem pagou
            </label>
            <select
              id="ed-paid-by"
              style={selectStyle}
              value={paidByMemberId}
              onChange={(e) => setPaidByMemberId(e.target.value)}
              required
            >
              {activeMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {memberName(m)}
                </option>
              ))}
            </select>
          </div>

          {activeMembers.length > 1 && (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span style={labelStyle}>Divisão entre membros</span>
                <button
                  type="button"
                  onClick={() => setUseSplits((v) => !v)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 12.5,
                    color: "var(--amber-deep)",
                    fontWeight: 650,
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {useSplits ? "Remover divisão" : "Adicionar divisão"}
                </button>
              </div>
              {useSplits && (
                <div
                  style={{
                    background: "var(--surface-alt)",
                    borderRadius: 12,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {splits.map((s) => {
                    const m = activeMembers.find((mb) => mb.id === s.memberId);
                    return (
                      <div
                        key={s.memberId}
                        style={{ display: "flex", alignItems: "center", gap: 10 }}
                      >
                        <span style={{ flex: 1, fontSize: 13.5, color: "var(--ink)" }}>
                          {memberName(m ?? null)}
                        </span>
                        <input
                          style={{ ...inputStyle, width: 80, textAlign: "right" }}
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={s.percentage}
                          onChange={(e) => handleSplitChange(s.memberId, e.target.value)}
                        />
                        <span style={{ fontSize: 13, color: "var(--ink-soft)", width: 14 }}>%</span>
                      </div>
                    );
                  })}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      gap: 6,
                      paddingTop: 4,
                      borderTop: "1px solid var(--line)",
                      marginTop: 4,
                    }}
                  >
                    <span style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>Total:</span>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color:
                          Math.abs(splitTotal - 100) < 0.1 ? "var(--teal-deep)" : "var(--coral)",
                      }}
                    >
                      {splitTotal.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {account.recurrence === "RECURRING" && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                background: "rgba(232,162,61,.08)",
                border: "1px solid rgba(232,162,61,.25)",
                borderRadius: 11,
                cursor: "pointer",
                fontSize: 13.5,
                color: "var(--ink-soft)",
              }}
            >
              <input
                type="checkbox"
                checked={replicateToFuture}
                onChange={(e) => setReplicateToFuture(e.target.checked)}
                style={{ width: 16, height: 16, cursor: "pointer", accentColor: "var(--amber)" }}
              />
              Replicar alterações para os meses seguintes
            </label>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                background: "transparent",
                border: "1.5px solid var(--line-strong)",
                color: "var(--ink)",
                fontFamily: "var(--font-body)",
                fontWeight: 650,
                fontSize: 14,
                borderRadius: 11,
                padding: "10px 16px",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              style={{
                flex: 1,
                background: updateMutation.isPending ? "var(--amber-soft)" : "var(--amber)",
                color: "#3a2a08",
                fontFamily: "var(--font-body)",
                fontWeight: 680,
                fontSize: 14,
                border: "none",
                borderRadius: 11,
                padding: "10px 16px",
                cursor: updateMutation.isPending ? "not-allowed" : "pointer",
              }}
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      </ModalCard>
    </ModalBackdrop>
  );
}

// ─── AccountDetailModal ───────────────────────────────────────────────────────

function AccountDetailModal({
  account,
  group,
  onClose,
  onMutate,
}: {
  account: Account;
  group: Group;
  onClose: () => void;
  onMutate: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [showEdit, setShowEdit] = useState(false);

  const isMonthOpen = (() => {
    if (!account.due_date) return true;
    const d = new Date(account.due_date);
    const balance = group.balances.find(
      (b) => b.month === d.getMonth() + 1 && b.year === d.getFullYear(),
    );
    return !balance || balance.status === "OPEN";
  })();
  const canEdit = account.status === "OPEN" && isMonthOpen && group.status !== "CLOSED";

  const markPaidMutation = useMarkAccountPaid({
    onSuccess: () => {
      onMutate();
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  const unmarkPaidMutation = useUnmarkAccountPaid({
    onSuccess: () => {
      onMutate();
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  const deleteMutation = useDeleteAccount({
    onSuccess: () => {
      onMutate();
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  const deferMutation = useDeferAccount({
    onSuccess: () => {
      onMutate();
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  const handleDefer = () => {
    const next = new Date();
    next.setMonth(next.getMonth() + 1);
    next.setDate(1);
    deferMutation.mutate({ id: account.id, targetMonth: next });
  };

  const handleDelete = () => {
    if (account.status === "PAID" && !confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    deleteMutation.mutate({ id: account.id, force: confirmDelete });
  };

  const statusCfg = STATUS_CONFIG[account.status];

  if (showEdit) {
    return (
      <EditAccountModal
        account={account}
        group={group}
        onClose={() => setShowEdit(false)}
        onSuccess={() => {
          onMutate();
          onClose();
        }}
      />
    );
  }

  return (
    <ModalBackdrop onClose={onClose}>
      <ModalCard title={account.title} onClose={onClose}>
        {error && <ErrorBanner msg={error} />}
        {confirmDelete && (
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
            Esta conta foi marcada como paga. Confirmar exclusão?
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: "var(--ink)",
                fontFamily: "var(--font-display)",
              }}
            >
              {fmtAmount(account.amount, account.currency)}
            </span>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 650,
                padding: "3px 9px",
                borderRadius: 8,
                background: statusCfg.bg,
                color: statusCfg.color,
              }}
            >
              {statusCfg.label}
            </span>
            {account.category && (
              <span
                style={{
                  fontSize: 12.5,
                  color: "var(--ink-faint)",
                  background: "var(--surface-alt)",
                  padding: "3px 9px",
                  borderRadius: 8,
                }}
              >
                {account.category.icon ? `${account.category.icon} ` : ""}
                {account.category.name}
              </span>
            )}
          </div>

          <div style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>
            <span>Vencimento: {fmtDate(account.due_date)}</span>
            {account.paid_by && (
              <span style={{ marginLeft: 16 }}>Pago por: {memberName(account.paid_by)}</span>
            )}
          </div>

          {account.splits.length > 0 && (
            <div>
              <div
                style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 8 }}
              >
                Divisão
              </div>
              <div
                style={{
                  background: "var(--surface-alt)",
                  borderRadius: 12,
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {account.splits.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span style={{ fontSize: 13.5, color: "var(--ink)" }}>
                      {memberName(s.member)}
                    </span>
                    <span style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>
                      {s.percentage}% - {fmtAmount(s.amount_due, account.currency)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowEdit(true)}
                style={{
                  background: "rgba(232,162,61,.12)",
                  color: "var(--amber-deep)",
                  border: "none",
                  borderRadius: 9,
                  padding: "8px 14px",
                  fontSize: 13.5,
                  fontWeight: 650,
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Editar
              </button>
            )}
            {account.status === "OPEN" && (
              <button
                type="button"
                disabled={markPaidMutation.isPending}
                onClick={() => markPaidMutation.mutate({ id: account.id })}
                style={{
                  background: "rgba(63,167,160,.15)",
                  color: "var(--teal-deep)",
                  border: "none",
                  borderRadius: 9,
                  padding: "8px 14px",
                  fontSize: 13.5,
                  fontWeight: 650,
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Marcar como pago
              </button>
            )}
            {account.status === "PAID" && isMonthOpen && group.status !== "CLOSED" && (
              <button
                type="button"
                disabled={unmarkPaidMutation.isPending}
                onClick={() => unmarkPaidMutation.mutate({ id: account.id })}
                style={{
                  background: "rgba(63,167,160,.1)",
                  color: "var(--teal-deep)",
                  border: "1.5px solid rgba(63,167,160,.3)",
                  borderRadius: 9,
                  padding: "8px 14px",
                  fontSize: 13.5,
                  fontWeight: 650,
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Remover pagamento
              </button>
            )}
            {account.status === "OPEN" && group.type === "HOME" && (
              <button
                type="button"
                disabled={deferMutation.isPending}
                onClick={handleDefer}
                style={{
                  background: "rgba(232,162,61,.14)",
                  color: "var(--amber-deep)",
                  border: "none",
                  borderRadius: 9,
                  padding: "8px 14px",
                  fontSize: 13.5,
                  fontWeight: 650,
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Adiar
              </button>
            )}
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={handleDelete}
              style={{
                background: confirmDelete ? "rgba(194,96,63,.15)" : "transparent",
                color: "var(--coral)",
                border: "1.5px solid rgba(194,96,63,.3)",
                borderRadius: 9,
                padding: "8px 14px",
                fontSize: 13.5,
                fontWeight: 650,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                marginLeft: "auto",
              }}
            >
              {confirmDelete ? "Confirmar exclusão" : "Excluir"}
            </button>
          </div>
        </div>
      </ModalCard>
    </ModalBackdrop>
  );
}

// ─── AccountsTab ──────────────────────────────────────────────────────────────

function AccountsTab({ group, isReadOnly }: { group: Group; isReadOnly: boolean }) {
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterStatus, setFilterStatus] = useState<AccountStatus | "">("");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [, setRefresh] = useState(0);

  const { data: accounts, isLoading, refetch } = useAccountList(group.id);

  const filtered =
    (accounts as Account[] | undefined)?.filter((a) => {
      if (a.due_date) {
        const d = new Date(a.due_date);
        if (d.getMonth() + 1 !== filterMonth || d.getFullYear() !== filterYear) return false;
      }
      if (filterStatus && a.status !== filterStatus) return false;
      return true;
    }) ?? [];

  const prevMonth = () => {
    if (filterMonth === 1) {
      setFilterMonth(12);
      setFilterYear((y) => y - 1);
    } else setFilterMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (filterMonth === 12) {
      setFilterMonth(1);
      setFilterYear((y) => y + 1);
    } else setFilterMonth((m) => m + 1);
  };

  const handleMutate = () => {
    setRefresh((n) => n + 1);
    void refetch();
  };

  return (
    <div>
      {showCreate && !isReadOnly && (
        <CreateAccountModal
          group={group}
          onClose={() => setShowCreate(false)}
          onSuccess={handleMutate}
        />
      )}
      {selectedAccount && (
        <AccountDetailModal
          account={selectedAccount}
          group={group}
          onClose={() => setSelectedAccount(null)}
          onMutate={handleMutate}
        />
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 20,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <button
            type="button"
            onClick={prevMonth}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: "pointer",
              fontSize: 15,
              display: "grid",
              placeItems: "center",
            }}
          >
            ‹
          </button>
          <span
            style={{
              fontWeight: 700,
              fontSize: 14.5,
              color: "var(--ink)",
              minWidth: 100,
              textAlign: "center",
            }}
          >
            {MONTH_NAMES[filterMonth - 1]} {filterYear}
          </span>
          <button
            type="button"
            onClick={nextMonth}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 8,
              width: 32,
              height: 32,
              cursor: "pointer",
              fontSize: 15,
              display: "grid",
              placeItems: "center",
            }}
          >
            ›
          </button>
        </div>

        <select
          style={{ ...selectStyle, width: "auto", fontSize: 13, padding: "6px 12px" }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as AccountStatus | "")}
        >
          <option value="">Todos os status</option>
          {(["OPEN", "PAID", "DEFERRED", "CLOSED"] as AccountStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_CONFIG[s].label}
            </option>
          ))}
        </select>

        {!isReadOnly && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "var(--amber)",
              color: "#3a2a08",
              border: "none",
              padding: "8px 15px",
              fontSize: 13.5,
              fontWeight: 680,
              borderRadius: 10,
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              whiteSpace: "nowrap",
            }}
          >
            ＋ Nova conta
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 64,
                background: "var(--surface-2)",
                borderRadius: 12,
                animation: "pulse 1.5s infinite",
              }}
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--ink-faint)" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
          <p style={{ margin: 0 }}>Nenhuma conta neste período.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((account) => {
            const cfg = STATUS_CONFIG[account.status];
            return (
              <button
                key={account.id}
                type="button"
                onClick={() => setSelectedAccount(account)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 16px",
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: 13,
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  fontFamily: "var(--font-body)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 650, fontSize: 14.5, color: "var(--ink)" }}>
                    {account.title}
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-faint)", marginTop: 3 }}>
                    {fmtDate(account.due_date)}
                    {account.category && ` · ${account.category.name}`}
                    {account.paid_by && ` · ${memberName(account.paid_by)}`}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 650,
                    padding: "3px 8px",
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
                    fontSize: 15,
                    color: account.type === "INCOME" ? "var(--teal-deep)" : "var(--ink)",
                    whiteSpace: "nowrap",
                    minWidth: 90,
                    textAlign: "right",
                  }}
                >
                  {account.type === "INCOME" ? "+" : ""}
                  {fmtAmount(account.amount, account.currency)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── TransfersTab ─────────────────────────────────────────────────────────────

function TransfersTab({ group, userId }: { group: Group; userId: string | undefined }) {
  const { data: transfers, isLoading } = useTransferList(group.id);
  const [error, setError] = useState("");

  const markPaidMutation = useMarkTransferPaid({
    onError: (e) => setError(e.message),
  });
  const confirmMutation = useConfirmTransfer({
    onError: (e) => setError(e.message),
  });

  const list = transfers as Transfer[] | undefined;

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 64, background: "var(--surface-2)", borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  if (!list?.length) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--ink-faint)" }}>
        <div style={{ fontSize: 36, marginBottom: 10 }}>⇄</div>
        <p style={{ margin: 0 }}>Nenhum repasse neste grupo.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {error && <ErrorBanner msg={error} />}
      {list.map((t) => {
        const isSent = t.from_member.user_id === userId;
        const cfg = TRANSFER_STATUS_CONFIG[t.status];
        const otherMember = isSent ? t.to_member : t.from_member;

        return (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 13,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                fontSize: 16,
                background: isSent ? "rgba(194,96,63,.1)" : "rgba(63,167,160,.1)",
                flexShrink: 0,
              }}
            >
              {isSent ? "↑" : "↓"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 650, fontSize: 14, color: "var(--ink)" }}>
                {isSent ? `Para ${memberName(otherMember)}` : `De ${memberName(otherMember)}`}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-faint)", marginTop: 2 }}>
                {MONTH_NAMES[t.month - 1]} {t.year}
              </div>
            </div>
            <span
              style={{
                fontSize: 12,
                fontWeight: 650,
                padding: "3px 8px",
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
                fontSize: 15,
                color: isSent ? "var(--coral)" : "var(--teal-deep)",
                whiteSpace: "nowrap",
                minWidth: 90,
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
                onClick={() => markPaidMutation.mutate({ id: t.id })}
                style={{
                  background: "rgba(232,162,61,.14)",
                  color: "var(--amber-deep)",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12.5,
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
                onClick={() => confirmMutation.mutate({ id: t.id })}
                style={{
                  background: "rgba(63,167,160,.15)",
                  color: "var(--teal-deep)",
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12.5,
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
  );
}

// ─── InviteModal ──────────────────────────────────────────────────────────────

function InviteModal({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const [mode, setMode] = useState<"username" | "email">("username");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const byUsernameMutation = useInviteByUsername({
    onSuccess: () => setSuccess(true),
    onError: (e) => setError(e.message),
  });
  const byEmailMutation = useInviteByEmail({
    onSuccess: () => setSuccess(true),
    onError: (e) => setError(e.message),
  });

  const isPending = byUsernameMutation.isPending || byEmailMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "username") byUsernameMutation.mutate({ groupId, username: value });
    else byEmailMutation.mutate({ groupId, email: value });
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <ModalCard title="Convidar membro" onClose={onClose} maxWidth={400}>
        {error && <ErrorBanner msg={error} />}
        {success ? (
          <div
            style={{
              textAlign: "center",
              color: "var(--teal-deep)",
              fontWeight: 700,
              fontSize: 15,
              padding: 12,
            }}
          >
            Membro convidado com sucesso!
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div
              style={{
                display: "flex",
                background: "var(--surface-2)",
                borderRadius: 11,
                padding: 3,
                gap: 2,
              }}
            >
              {(["username", "email"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  style={{
                    flex: 1,
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 13.5,
                    fontWeight: 650,
                    fontFamily: "var(--font-body)",
                    cursor: "pointer",
                    background: mode === m ? "var(--surface)" : "transparent",
                    color: mode === m ? "var(--ink)" : "var(--ink-soft)",
                  }}
                >
                  {m === "username" ? "Username" : "E-mail"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label htmlFor="inv-value" style={labelStyle}>
                {mode === "username" ? "Username" : "E-mail"}
              </label>
              <input
                id="inv-value"
                style={inputStyle}
                type={mode === "email" ? "email" : "text"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={mode === "username" ? "@joao" : "joao@exemplo.com"}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              style={{
                background: isPending ? "var(--amber-soft)" : "var(--amber)",
                color: "#3a2a08",
                fontFamily: "var(--font-body)",
                fontWeight: 680,
                fontSize: 14,
                border: "none",
                borderRadius: 11,
                padding: "11px 20px",
                cursor: isPending ? "not-allowed" : "pointer",
              }}
            >
              {isPending ? "Convidando..." : "Convidar"}
            </button>
          </form>
        )}
      </ModalCard>
    </ModalBackdrop>
  );
}

// ─── AddExternalModal ──────────────────────────────────────────────────────────

function AddExternalModal({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState("");

  const addMutation = useAddExternalMember({
    onSuccess: () => onClose(),
    onError: (e) => setError(e.message),
  });

  return (
    <ModalBackdrop onClose={onClose}>
      <ModalCard title="Adicionar participante externo" onClose={onClose} maxWidth={400}>
        {error && <ErrorBanner msg={error} />}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addMutation.mutate({
              groupId,
              externalName: name,
              externalContact: contact || undefined,
            });
          }}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label htmlFor="ext-name" style={labelStyle}>
              Nome
            </label>
            <input
              id="ext-name"
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Carlos Silva"
              required
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label htmlFor="ext-contact" style={labelStyle}>
              Contato (opcional)
            </label>
            <input
              id="ext-contact"
              style={inputStyle}
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Telefone ou e-mail"
            />
          </div>
          <button
            type="submit"
            disabled={addMutation.isPending}
            style={{
              background: addMutation.isPending ? "var(--amber-soft)" : "var(--amber)",
              color: "#3a2a08",
              fontFamily: "var(--font-body)",
              fontWeight: 680,
              fontSize: 14,
              border: "none",
              borderRadius: 11,
              padding: "11px 20px",
              cursor: addMutation.isPending ? "not-allowed" : "pointer",
            }}
          >
            {addMutation.isPending ? "Adicionando..." : "Adicionar"}
          </button>
        </form>
      </ModalCard>
    </ModalBackdrop>
  );
}

// ─── EditGroupModal ───────────────────────────────────────────────────────────

function EditGroupModal({
  group,
  onClose,
  onSuccess,
}: {
  group: Group;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(group.name);
  const [eventType, setEventType] = useState<EventType | "">(group.event_type ?? "");
  const [closingMode, setClosingMode] = useState<"AUTO" | "MANUAL" | "">(group.closing_mode ?? "");
  const [error, setError] = useState("");

  const updateMutation = useUpdateGroup({
    onSuccess: () => {
      onSuccess();
      onClose();
    },
    onError: (e) => setError(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const payload: { name?: string; eventType?: string | null; closingMode?: string | null } = {};
    if (name.trim() !== group.name) payload.name = name.trim();
    if (group.type === "EVENT" && eventType !== (group.event_type ?? ""))
      payload.eventType = eventType || null;
    if (group.type === "HOME" && closingMode !== (group.closing_mode ?? ""))
      payload.closingMode = closingMode || null;
    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }
    updateMutation.mutate({ id: group.id, data: payload });
  };

  return (
    <ModalBackdrop onClose={onClose}>
      <ModalCard title="Editar grupo" onClose={onClose} maxWidth={440}>
        {error && <ErrorBanner msg={error} />}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label htmlFor="eg-name" style={labelStyle}>
              Nome
            </label>
            <input
              id="eg-name"
              style={inputStyle}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {group.type === "EVENT" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label htmlFor="eg-event-type" style={labelStyle}>
                Tipo de evento
              </label>
              <select
                id="eg-event-type"
                style={selectStyle}
                value={eventType}
                onChange={(e) => setEventType(e.target.value as EventType)}
              >
                <option value="TRIP">Viagem</option>
                <option value="BBQ">Churrasqueira</option>
                <option value="GIFT">Presente</option>
                <option value="FUNDRAISER">Arrecadação</option>
                <option value="GENERAL">Geral</option>
              </select>
            </div>
          )}

          {group.type === "HOME" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label htmlFor="eg-closing-mode" style={labelStyle}>
                Fechamento mensal
              </label>
              <select
                id="eg-closing-mode"
                style={selectStyle}
                value={closingMode}
                onChange={(e) => setClosingMode(e.target.value as "AUTO" | "MANUAL" | "")}
              >
                <option value="">Sem fechamento automático</option>
                <option value="MANUAL">Manual</option>
                <option value="AUTO">Automático</option>
              </select>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                background: "transparent",
                border: "1.5px solid var(--line-strong)",
                color: "var(--ink)",
                fontFamily: "var(--font-body)",
                fontWeight: 650,
                fontSize: 14,
                borderRadius: 11,
                padding: "10px 16px",
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              style={{
                flex: 1,
                background: updateMutation.isPending ? "var(--amber-soft)" : "var(--amber)",
                color: "#3a2a08",
                fontFamily: "var(--font-body)",
                fontWeight: 680,
                fontSize: 14,
                border: "none",
                borderRadius: 11,
                padding: "10px 16px",
                cursor: updateMutation.isPending ? "not-allowed" : "pointer",
              }}
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      </ModalCard>
    </ModalBackdrop>
  );
}

// ─── MembersTab ───────────────────────────────────────────────────────────────

function MembersTab({
  group,
  isAdmin,
  userId,
}: {
  group: Group;
  isAdmin: boolean;
  userId: string | undefined;
}) {
  const [showInvite, setShowInvite] = useState(false);
  const [showAddExternal, setShowAddExternal] = useState(false);
  const [error, setError] = useState("");

  const removeMutation = useRemoveMember({
    onError: (e) => setError(e.message),
  });

  const activeMembers = group.members.filter((m) => !m.left_at);

  return (
    <div>
      {showInvite && <InviteModal groupId={group.id} onClose={() => setShowInvite(false)} />}
      {showAddExternal && (
        <AddExternalModal groupId={group.id} onClose={() => setShowAddExternal(false)} />
      )}

      {error && <ErrorBanner msg={error} />}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>
          {activeMembers.length} membro{activeMembers.length !== 1 ? "s" : ""}
        </span>
        {isAdmin && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowInvite(true)}
              style={{
                background: "var(--amber)",
                color: "#3a2a08",
                border: "none",
                borderRadius: 9,
                padding: "7px 13px",
                fontSize: 13,
                fontWeight: 680,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              Convidar
            </button>
            {group.type === "EVENT" && (
              <button
                type="button"
                onClick={() => setShowAddExternal(true)}
                style={{
                  background: "transparent",
                  color: "var(--ink)",
                  border: "1.5px solid var(--line-strong)",
                  borderRadius: 9,
                  padding: "7px 13px",
                  fontSize: 13,
                  fontWeight: 650,
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Adicionar externo
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {activeMembers.map((m) => {
          const isExternal = !m.user_id;
          const isMe = m.user_id === userId;
          const name = memberName(m);
          return (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: isExternal ? "var(--surface-2)" : "var(--amber)",
                  color: isExternal ? "var(--ink-faint)" : "#3a2a08",
                  display: "grid",
                  placeItems: "center",
                  fontWeight: 700,
                  fontSize: 14,
                  flexShrink: 0,
                  fontFamily: "var(--font-display)",
                }}
              >
                {isExternal ? "?" : name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 650, fontSize: 14, color: "var(--ink)" }}>
                  {name}{" "}
                  {isMe && (
                    <span style={{ color: "var(--ink-faint)", fontWeight: 400, fontSize: 12 }}>
                      (você)
                    </span>
                  )}
                </div>
                {!isExternal && m.user && (
                  <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
                    @{m.user.username}
                  </div>
                )}
                {isExternal && m.external_contact && (
                  <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
                    {m.external_contact}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {isExternal && (
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 650,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: "var(--surface-2)",
                      color: "var(--ink-faint)",
                    }}
                  >
                    Externo
                  </span>
                )}
                {m.role === "ADMIN" && (
                  <span
                    style={{
                      fontSize: 11.5,
                      fontWeight: 650,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: "rgba(232,162,61,.14)",
                      color: "var(--amber-deep)",
                    }}
                  >
                    Admin
                  </span>
                )}
                {isAdmin && !isMe && (
                  <button
                    type="button"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate({ groupId: group.id, memberId: m.id })}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--ink-faint)",
                      fontSize: 14,
                      padding: 4,
                    }}
                    title="Remover membro"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CategoryBudgetsSection ───────────────────────────────────────────────────

function CategoryBudgetsSection({
  groupId,
  byCategory,
  month,
  year,
  canEdit,
}: {
  groupId: string;
  byCategory: {
    categoryId: string;
    categoryName: string;
    categoryIcon: string | null;
    totalExpense: number;
  }[];
  month: number;
  year: number;
  canEdit: boolean;
}) {
  const { data: budgets } = useCategoryBudgets(groupId, month, year);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editLimit, setEditLimit] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const createBudget = useCreateCategoryBudget({
    onSuccess: () => {
      setEditingCatId(null);
      setEditLimit("");
    },
    onError: (e) => setErrorMsg(e.message),
  });
  const updateBudget = useUpdateCategoryBudget({
    onSuccess: () => {
      setEditingCatId(null);
      setEditLimit("");
    },
    onError: (e) => setErrorMsg(e.message),
  });
  const deleteBudget = useDeleteCategoryBudget({
    onError: (e) => setErrorMsg(e.message),
  });

  const getBudget = (categoryId: string) =>
    (budgets as CategoryBudget[] | undefined)?.find((b) => b.category_id === categoryId);

  if (byCategory.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 650,
          color: "var(--ink-faint)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 10,
        }}
      >
        Por categoria
      </div>
      {errorMsg && <ErrorBanner msg={errorMsg} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {byCategory.map((cat) => {
          const budget = getBudget(cat.categoryId);
          const pct = budget
            ? Math.min((cat.totalExpense / Number(budget.limit_amount)) * 100, 100)
            : 0;
          const isOver = budget ? cat.totalExpense > Number(budget.limit_amount) : false;
          const barColor = !budget
            ? undefined
            : isOver
              ? "var(--coral)"
              : pct >= 80
                ? "var(--amber)"
                : "var(--teal)";
          const isEditing = editingCatId === cat.categoryId;

          return (
            <div
              key={cat.categoryId}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 13,
                padding: "12px 16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: budget ? 8 : 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {cat.categoryIcon && <span style={{ fontSize: 16 }}>{cat.categoryIcon}</span>}
                  <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>
                    {cat.categoryName}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: isOver ? "var(--coral)" : "var(--ink)",
                    }}
                  >
                    {fmtAmount(cat.totalExpense)}
                  </span>
                  {budget && (
                    <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                      / {fmtAmount(Number(budget.limit_amount))}
                    </span>
                  )}
                  {canEdit && !isEditing && (
                    <div style={{ display: "flex", gap: 2 }}>
                      {budget ? (
                        <>
                          <button
                            type="button"
                            title="Editar limite"
                            onClick={() => {
                              setEditingCatId(cat.categoryId);
                              setEditLimit(String(budget.limit_amount));
                            }}
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--ink-faint)",
                              fontSize: 13,
                              padding: "2px 4px",
                            }}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            title="Remover limite"
                            disabled={deleteBudget.isPending}
                            onClick={() => deleteBudget.mutate({ id: budget.id })}
                            style={{
                              background: "transparent",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--ink-faint)",
                              fontSize: 13,
                              padding: "2px 4px",
                            }}
                          >
                            🗑️
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCatId(cat.categoryId);
                            setEditLimit("");
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--ink-faint)",
                            fontSize: 12,
                            padding: "2px 4px",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          + Limite
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {budget && (
                <div
                  style={{
                    height: 5,
                    background: "var(--line)",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      background: barColor,
                      borderRadius: 3,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              )}
              {isEditing && canEdit && (
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginTop: 10,
                    alignItems: "center",
                  }}
                >
                  <input
                    type="number"
                    placeholder="Limite (R$)"
                    value={editLimit}
                    onChange={(e) => setEditLimit(e.target.value)}
                    // biome-ignore lint/a11y/noAutofocus: foco intencional ao abrir campo de limite
                    autoFocus
                    min="0.01"
                    step="0.01"
                    style={{ ...inputStyle, flex: 1, fontSize: 13, padding: "6px 10px" }}
                  />
                  <button
                    type="button"
                    disabled={
                      !editLimit ||
                      Number(editLimit) <= 0 ||
                      createBudget.isPending ||
                      updateBudget.isPending
                    }
                    onClick={() => {
                      const amount = Number(editLimit);
                      if (budget) {
                        updateBudget.mutate({ id: budget.id, limitAmount: amount });
                      } else {
                        createBudget.mutate({
                          groupId,
                          categoryId: cat.categoryId,
                          month,
                          year,
                          limitAmount: amount,
                        });
                      }
                    }}
                    style={{
                      background: "var(--amber)",
                      color: "#3a2a08",
                      border: "none",
                      borderRadius: 9,
                      padding: "6px 12px",
                      fontSize: 13,
                      fontWeight: 650,
                      cursor: "pointer",
                      fontFamily: "var(--font-body)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Salvar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCatId(null);
                      setEditLimit("");
                    }}
                    style={{
                      background: "transparent",
                      color: "var(--ink-faint)",
                      border: "1px solid var(--line-strong)",
                      borderRadius: 9,
                      padding: "6px 10px",
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── CustomCategoriesSection ──────────────────────────────────────────────────

function CustomCategoriesSection({ groupId }: { groupId: string }) {
  const { data: categories } = useCategoryList(groupId);
  const [errorMsg, setErrorMsg] = useState("");

  const deleteCategory = useDeleteCategory({
    onError: (e) => setErrorMsg(e.message),
  });

  const customCategories =
    (categories as CategoryItem[] | undefined)?.filter((c) => !c.is_system) ?? [];

  if (customCategories.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 650,
          color: "var(--ink-faint)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 10,
        }}
      >
        Categorias personalizadas
      </div>
      {errorMsg && <ErrorBanner msg={errorMsg} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {customCategories.map((cat) => (
          <div
            key={cat.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 14px",
              background: "var(--surface-alt)",
              borderRadius: 11,
            }}
          >
            <span style={{ fontSize: 13.5, color: "var(--ink)" }}>
              {cat.icon ? `${cat.icon} ` : ""}
              {cat.name}
            </span>
            <button
              type="button"
              disabled={deleteCategory.isPending}
              onClick={() => deleteCategory.mutate({ id: cat.id })}
              title="Arquivar categoria"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--ink-faint)",
                fontSize: 14,
                padding: "2px 6px",
              }}
            >
              🗑️
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PreviewTab ───────────────────────────────────────────────────────────────

function PreviewTab({ group }: { group: Group }) {
  const now = new Date();
  const isEvent = group.type === "EVENT";
  const [previewMonth, setPreviewMonth] = useState(now.getMonth() + 1);
  const [previewYear, setPreviewYear] = useState(now.getFullYear());

  const { data, isLoading } = useBalancePreview(
    group.id,
    isEvent ? undefined : previewMonth,
    isEvent ? undefined : previewYear,
  );

  const preview = data as BalancePreview | undefined;

  const currentBalance = group.balances.find(
    (b) => b.month === previewMonth && b.year === previewYear,
  );
  const isMonthOpenForBudget = !currentBalance || currentBalance.status === "OPEN";
  const canEditBudgets = !isEvent && group.status === "ACTIVE" && isMonthOpenForBudget;

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ height: 52, background: "var(--surface-2)", borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {!isEvent && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <span style={{ fontSize: 13.5, fontWeight: 650, color: "var(--ink-soft)" }}>
            Período:
          </span>
          <select
            style={{ ...selectStyle, width: "auto", fontSize: 13, padding: "6px 12px" }}
            value={previewMonth}
            onChange={(e) => setPreviewMonth(Number(e.target.value))}
          >
            {MONTH_NAMES.map((m, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: month index is stable and meaningful
              <option key={i} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <input
            style={{ ...inputStyle, width: 90, fontSize: 13, padding: "6px 12px" }}
            type="number"
            value={previewYear}
            onChange={(e) => setPreviewYear(Number(e.target.value))}
            min={2020}
          />
        </div>
      )}

      {preview && (
        <>
          <div
            style={{
              display: "flex",
              gap: 10,
              marginBottom: 20,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: 130,
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 13,
                padding: "14px 16px",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 4 }}>
                Despesas
              </div>
              <div style={{ fontWeight: 700, fontSize: 17, color: "var(--coral)" }}>
                {fmtAmount(preview.totalExpense)}
              </div>
            </div>
            <div
              style={{
                flex: 1,
                minWidth: 130,
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 13,
                padding: "14px 16px",
              }}
            >
              <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 4 }}>
                Receitas
              </div>
              <div style={{ fontWeight: 700, fontSize: 17, color: "var(--teal)" }}>
                {fmtAmount(preview.totalIncome)}
              </div>
            </div>
          </div>

          {(preview.byCategory ?? []).length > 0 && (
            <CategoryBudgetsSection
              groupId={group.id}
              byCategory={preview.byCategory ?? []}
              month={previewMonth}
              year={previewYear}
              canEdit={canEditBudgets}
            />
          )}

          {preview.netTransfers.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "40px 20px",
                color: "var(--ink-faint)",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 14,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <p style={{ margin: 0, fontSize: 14 }}>Nenhum repasse necessário neste período.</p>
            </div>
          ) : (
            <div>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 650,
                  color: "var(--ink-faint)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 10,
                }}
              >
                Repasses sugeridos (valores líquidos)
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {preview.netTransfers.map((t) => (
                  <div
                    key={`${t.fromMemberId}-${t.toMemberId}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      background: "var(--surface)",
                      border: "1px solid var(--line)",
                      borderRadius: 13,
                    }}
                  >
                    <div style={{ fontSize: 14, color: "var(--ink)" }}>
                      <span style={{ fontWeight: 650 }}>{t.fromName}</span>
                      <span style={{ color: "var(--ink-faint)", margin: "0 8px" }}>→</span>
                      <span style={{ fontWeight: 650 }}>{t.toName}</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>
                      {fmtAmount(t.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {preview.byMember.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div
                style={{
                  fontSize: 12.5,
                  fontWeight: 650,
                  color: "var(--ink-faint)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 10,
                }}
              >
                Saldo por membro
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {preview.byMember.map((m) => (
                  <div
                    key={m.memberId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      background: "var(--surface-alt)",
                      borderRadius: 11,
                    }}
                  >
                    <span style={{ fontSize: 13.5, color: "var(--ink)" }}>{m.name}</span>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: m.balance >= 0 ? "var(--teal-deep)" : "var(--coral)",
                      }}
                    >
                      {m.balance >= 0 ? "+" : ""}
                      {fmtAmount(m.balance)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <CustomCategoriesSection groupId={group.id} />
        </>
      )}
    </div>
  );
}

// ─── BalanceTab ───────────────────────────────────────────────────────────────

function BalanceTab({ group, isAdmin }: { group: Group; isAdmin: boolean }) {
  const now = new Date();
  const [closeMonth, setCloseMonth] = useState(now.getMonth() + 1);
  const [closeYear, setCloseYear] = useState(now.getFullYear());
  const [error, setError] = useState("");

  const { data: balances, isLoading } = useBalanceList(group.id);

  const closeMutation = useCloseBalance({
    onSuccess: () => setError(""),
    onError: (e) => setError(e.message),
  });

  if (isLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {[1, 2].map((i) => (
          <div key={i} style={{ height: 56, background: "var(--surface-2)", borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {error && <ErrorBanner msg={error} />}

      {isAdmin && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: "16px 18px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 650, color: "var(--ink)" }}>Fechar mês:</span>
          <select
            style={{ ...selectStyle, width: "auto", fontSize: 13, padding: "6px 12px" }}
            value={closeMonth}
            onChange={(e) => setCloseMonth(Number(e.target.value))}
          >
            {MONTH_NAMES.map((m, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: month index is stable and meaningful
              <option key={i} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <input
            style={{ ...inputStyle, width: 90, fontSize: 13, padding: "6px 12px" }}
            type="number"
            value={closeYear}
            onChange={(e) => setCloseYear(Number(e.target.value))}
            min={2020}
          />
          <button
            type="button"
            disabled={closeMutation.isPending}
            onClick={() =>
              closeMutation.mutate({ groupId: group.id, month: closeMonth, year: closeYear })
            }
            style={{
              background: closeMutation.isPending ? "var(--amber-soft)" : "var(--amber)",
              color: "#3a2a08",
              border: "none",
              borderRadius: 9,
              padding: "8px 16px",
              fontSize: 13.5,
              fontWeight: 680,
              cursor: closeMutation.isPending ? "not-allowed" : "pointer",
              fontFamily: "var(--font-body)",
            }}
          >
            {closeMutation.isPending ? "Fechando..." : "Fechar mês"}
          </button>
        </div>
      )}

      {!balances?.length ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--ink-faint)" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
          <p style={{ margin: 0 }}>Nenhum balanço registrado.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(balances as Balance[]).map((b) => (
            <div
              key={b.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 16px",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: 13,
              }}
            >
              <div>
                <div style={{ fontWeight: 650, fontSize: 14, color: "var(--ink)" }}>
                  {MONTH_NAMES[b.month - 1]} {b.year}
                </div>
                {b.closed_at && (
                  <div style={{ fontSize: 12.5, color: "var(--ink-faint)", marginTop: 2 }}>
                    Fechado em {fmtDate(b.closed_at)}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                {b.total_expense != null && (
                  <div style={{ fontWeight: 700, fontSize: 15, color: "var(--ink)" }}>
                    {fmtAmount(b.total_expense)}
                  </div>
                )}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 650,
                    padding: "2px 8px",
                    borderRadius: 6,
                    background:
                      b.status === "CLOSED" ? "rgba(63,167,160,.12)" : "rgba(111,103,87,.1)",
                    color: b.status === "CLOSED" ? "var(--teal-deep)" : "var(--ink-faint)",
                  }}
                >
                  {b.status === "CLOSED" ? "Fechado" : "Aberto"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── GroupPage ────────────────────────────────────────────────────────────────

type Tab = "accounts" | "transfers" | "members" | "balance" | "resumo";

export default function GroupPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<Tab>("accounts");
  const [copied, setCopied] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closeError, setCloseError] = useState("");
  const [showEditGroup, setShowEditGroup] = useState(false);

  const { data: group, isLoading, error, refetch: refetchGroup } = useGroup(params.id);

  const closeMutation = useCloseGroup({
    onSuccess: () => setShowCloseConfirm(false),
    onError: (e) => setCloseError(e.message),
  });

  if (isLoading) {
    return (
      <div style={{ padding: "40px 32px" }}>
        <div
          style={{
            height: 60,
            background: "var(--surface-2)",
            borderRadius: 14,
            marginBottom: 16,
            animation: "pulse 1.5s infinite",
          }}
        />
        <div style={{ height: 40, background: "var(--surface-2)", borderRadius: 10 }} />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div style={{ padding: "60px 32px", textAlign: "center", color: "var(--ink-faint)" }}>
        <div style={{ fontSize: 48 }}>🔍</div>
        <p>Grupo não encontrado.</p>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          style={{
            background: "var(--amber)",
            color: "#3a2a08",
            border: "none",
            borderRadius: 10,
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 680,
            cursor: "pointer",
            fontFamily: "var(--font-body)",
          }}
        >
          Voltar ao Dashboard
        </button>
      </div>
    );
  }

  const g = group as unknown as Group;
  const myMember = g.members.find((m) => m.user_id === user?.id && !m.left_at);
  const isAdmin = myMember?.role === "ADMIN";
  const isReadOnly = g.status === "CLOSED";

  const groupEmoji =
    g.type === "HOME" ? GROUP_EMOJI.HOME : (GROUP_EMOJI[g.event_type ?? "GENERAL"] ?? "📋");
  const memberTabLabel = g.type === "HOME" ? "Membros" : "Participantes";

  const tabs: { id: Tab; label: string }[] = [
    { id: "accounts", label: "Contas" },
    { id: "transfers", label: "Repasses" },
    { id: "members", label: memberTabLabel },
    ...(g.type === "HOME" ? [{ id: "balance" as Tab, label: "Balanço" }] : []),
    { id: "resumo", label: "Resumo" },
  ];

  const copyCode = async () => {
    await navigator.clipboard.writeText(g.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {showEditGroup && (
        <EditGroupModal
          group={g}
          onClose={() => setShowEditGroup(false)}
          onSuccess={() => void refetchGroup()}
        />
      )}
      {showCloseConfirm && (
        <ModalBackdrop onClose={() => setShowCloseConfirm(false)}>
          <ModalCard
            title="Encerrar grupo"
            onClose={() => setShowCloseConfirm(false)}
            maxWidth={400}
          >
            {closeError && <ErrorBanner msg={closeError} />}
            <p style={{ fontSize: 14.5, color: "var(--ink-soft)", marginTop: 0 }}>
              Tem certeza que deseja encerrar <strong>{g.name}</strong>? O grupo ficará em modo
              somente leitura.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowCloseConfirm(false)}
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "1.5px solid var(--line-strong)",
                  color: "var(--ink)",
                  fontFamily: "var(--font-body)",
                  fontWeight: 650,
                  fontSize: 14,
                  borderRadius: 11,
                  padding: "10px 16px",
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={closeMutation.isPending}
                onClick={() => closeMutation.mutate({ id: g.id })}
                style={{
                  flex: 1,
                  background: closeMutation.isPending ? "rgba(194,96,63,.5)" : "var(--coral)",
                  color: "#fff",
                  fontFamily: "var(--font-body)",
                  fontWeight: 680,
                  fontSize: 14,
                  border: "none",
                  borderRadius: 11,
                  padding: "10px 16px",
                  cursor: closeMutation.isPending ? "not-allowed" : "pointer",
                }}
              >
                {closeMutation.isPending ? "Encerrando..." : "Encerrar grupo"}
              </button>
            </div>
          </ModalCard>
        </ModalBackdrop>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "18px 32px 16px",
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "var(--bg-blur)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <span style={{ fontSize: 28 }}>{groupEmoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: 22,
                fontWeight: 800,
                letterSpacing: "-0.02em",
                color: "var(--ink)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {g.name}
            </h1>
            {isReadOnly && (
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 650,
                  padding: "3px 9px",
                  borderRadius: 7,
                  background: "rgba(194,96,63,.1)",
                  color: "var(--coral)",
                  flexShrink: 0,
                }}
              >
                Encerrado
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={copyCode}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 12.5,
              color: "var(--ink-faint)",
              padding: 0,
              fontFamily: "var(--font-mono)",
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            {g.code} {copied ? "✓ copiado" : "📋"}
          </button>
        </div>
        {isAdmin && !isReadOnly && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setShowEditGroup(true)}
              style={{
                background: "transparent",
                color: "var(--ink-soft)",
                border: "1.5px solid var(--line-strong)",
                borderRadius: 10,
                padding: "8px 15px",
                fontSize: 13,
                fontWeight: 650,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                whiteSpace: "nowrap",
              }}
            >
              Editar
            </button>
            {g.type === "EVENT" && (
              <button
                type="button"
                onClick={() => setShowCloseConfirm(true)}
                style={{
                  background: "transparent",
                  color: "var(--coral)",
                  border: "1.5px solid rgba(194,96,63,.4)",
                  borderRadius: 10,
                  padding: "8px 15px",
                  fontSize: 13,
                  fontWeight: 650,
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                  whiteSpace: "nowrap",
                }}
              >
                Encerrar grupo
              </button>
            )}
          </div>
        )}
      </div>

      {isReadOnly && (
        <div
          style={{
            padding: "10px 32px",
            background: "rgba(194,96,63,.07)",
            borderBottom: "1px solid rgba(194,96,63,.15)",
            fontSize: 13.5,
            color: "var(--coral)",
            textAlign: "center",
          }}
        >
          Este grupo foi encerrado e está em modo somente leitura.
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 2,
          padding: "0 32px",
          borderBottom: "1px solid var(--line)",
          background: "var(--surface-alt)",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: "none",
              border: "none",
              borderBottom:
                activeTab === tab.id ? "2px solid var(--amber-deep)" : "2px solid transparent",
              color: activeTab === tab.id ? "var(--ink)" : "var(--ink-soft)",
              fontFamily: "var(--font-body)",
              fontWeight: activeTab === tab.id ? 700 : 560,
              fontSize: 14,
              padding: "14px 16px 12px",
              cursor: "pointer",
              transition: "color .12s, border-color .12s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "24px 32px 60px" }}>
        {activeTab === "accounts" && <AccountsTab group={g} isReadOnly={isReadOnly} />}
        {activeTab === "transfers" && <TransfersTab group={g} userId={user?.id} />}
        {activeTab === "members" && <MembersTab group={g} isAdmin={isAdmin} userId={user?.id} />}
        {activeTab === "balance" && g.type === "HOME" && <BalanceTab group={g} isAdmin={isAdmin} />}
        {activeTab === "resumo" && <PreviewTab group={g} />}
      </div>
    </>
  );
}
