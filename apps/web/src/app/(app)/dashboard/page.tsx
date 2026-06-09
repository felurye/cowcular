"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";

type EventType = "TRIP" | "BBQ" | "GIFT" | "FUNDRAISER" | "GENERAL";
type GroupType = "HOME" | "EVENT";
type ClosingMode = "AUTO" | "MANUAL";

interface GroupMember {
  id: string;
  userId: string | null;
  role: "ADMIN" | "MEMBER";
}

interface Group {
  id: string;
  name: string;
  type: GroupType;
  eventType: EventType | null;
  code: string;
  members: GroupMember[];
}

const GROUP_EMOJI: Record<string, string> = {
  HOME: "🏠",
  TRIP: "✈️",
  BBQ: "🍖",
  GIFT: "🎁",
  FUNDRAISER: "💰",
  GENERAL: "📋",
};

const EVENT_LABEL: Record<string, string> = {
  TRIP: "Viagem",
  BBQ: "Churrasco / Bar",
  GIFT: "Presente coletivo",
  FUNDRAISER: "Vaquinha",
  GENERAL: "Despesas gerais",
};

function getGroupEmoji(type: GroupType, eventType: EventType | null) {
  if (type === "HOME") return GROUP_EMOJI.HOME;
  return GROUP_EMOJI[eventType ?? "GENERAL"] ?? "📋";
}

function GroupCard({ group }: { group: Group }) {
  const [hovered, setHovered] = useState(false);
  const subtitle =
    group.type === "HOME" ? "Lar" : (EVENT_LABEL[group.eventType ?? "GENERAL"] ?? "Grupo avulso");
  const emoji = getGroupEmoji(group.type, group.eventType);

  return (
    <a
      href={`/groups/${group.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        background: "var(--surface)",
        border: `1px solid ${hovered ? "var(--line-strong)" : "var(--line)"}`,
        borderRadius: 18,
        padding: 20,
        textDecoration: "none",
        cursor: "pointer",
        transition: "transform .15s, box-shadow .15s, border-color .15s",
        boxShadow: hovered ? "0 8px 24px -12px rgba(40,30,10,.22)" : "0 1px 0 rgba(40,30,10,.03)",
        transform: hovered ? "translateY(-2px)" : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 13,
            background: "var(--surface-alt)",
            display: "grid",
            placeItems: "center",
            fontSize: 24,
            flexShrink: 0,
          }}
        >
          {emoji}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: 15.5,
              color: "var(--ink)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {group.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                background: group.type === "HOME" ? "rgba(63,167,160,.16)" : "rgba(232,162,61,.14)",
                color: group.type === "HOME" ? "var(--teal-deep)" : "var(--amber-deep)",
                fontSize: 11.5,
                fontWeight: 650,
                padding: "3px 9px",
                borderRadius: 8,
              }}
            >
              {subtitle}
            </span>
          </div>
        </div>
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: "var(--ink-faint)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>
          {group.members.length} membro{group.members.length !== 1 ? "s" : ""}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
            letterSpacing: ".04em",
            color: "var(--ink-faint)",
          }}
        >
          {group.code}
        </span>
      </div>
    </a>
  );
}

const selectStyle: React.CSSProperties = {
  border: "1px solid var(--line-strong)",
  borderRadius: 11,
  padding: "10px 14px",
  fontSize: 14,
  fontFamily: "var(--font-body)",
  color: "var(--ink)",
  background: "var(--surface)",
  width: "100%",
  outline: "none",
  appearance: "none",
};

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

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--ink-soft)",
};

function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const [groupType, setGroupType] = useState<GroupType>("HOME");
  const [name, setName] = useState("");
  const [eventType, setEventType] = useState<EventType>("GENERAL");
  const [closingMode, setClosingMode] = useState<ClosingMode>("MANUAL");
  const [error, setError] = useState("");
  const utils = trpc.useUtils();

  const createMutation = trpc.groups.create.useMutation({
    onSuccess: () => {
      void utils.groups.list.invalidate();
      onClose();
    },
    onError: (err) => setError(err.message),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    createMutation.mutate({
      name,
      type: groupType,
      eventType: groupType === "EVENT" ? eventType : undefined,
      closingMode: groupType === "HOME" ? closingMode : undefined,
    });
  };

  return (
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
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 20,
          padding: 28,
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 24px 60px -16px rgba(40,30,10,.3)",
        }}
      >
        <h2
          style={{
            margin: "0 0 20px",
            fontSize: 20,
            fontWeight: 800,
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.01em",
            color: "var(--ink)",
          }}
        >
          Novo grupo
        </h2>

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

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Type toggle */}
          <div
            style={{
              display: "flex",
              background: "var(--surface-2)",
              borderRadius: 11,
              padding: 3,
              gap: 2,
            }}
          >
            {(["HOME", "EVENT"] as GroupType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setGroupType(t)}
                style={{
                  flex: 1,
                  border: "none",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13.5,
                  fontWeight: 650,
                  fontFamily: "var(--font-body)",
                  cursor: "pointer",
                  background: groupType === t ? "var(--surface)" : "transparent",
                  color: groupType === t ? "var(--ink)" : "var(--ink-soft)",
                  boxShadow: groupType === t ? "0 1px 3px rgba(40,30,10,.12)" : "none",
                  transition: "all .15s",
                }}
              >
                {t === "HOME" ? "🏠 Lar" : "🎉 Grupo Avulso"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="group-name" style={labelStyle}>
              Nome
            </label>
            <input
              id="group-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={groupType === "HOME" ? "Casa do João" : "Viagem para SP"}
              required
              style={inputStyle}
            />
          </div>

          {groupType === "EVENT" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="event-type" style={labelStyle}>
                Tipo
              </label>
              <select
                id="event-type"
                value={eventType}
                onChange={(e) => setEventType(e.target.value as EventType)}
                style={selectStyle}
              >
                <option value="TRIP">✈️ Viagem</option>
                <option value="BBQ">🍖 Churrasco / Bar</option>
                <option value="GIFT">🎁 Presente Coletivo</option>
                <option value="FUNDRAISER">💰 Vaquinha</option>
                <option value="GENERAL">📋 Despesas Gerais</option>
              </select>
            </div>
          )}

          {groupType === "HOME" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="closing-mode" style={labelStyle}>
                Fechamento mensal
              </label>
              <select
                id="closing-mode"
                value={closingMode}
                onChange={(e) => setClosingMode(e.target.value as ClosingMode)}
                style={selectStyle}
              >
                <option value="MANUAL">Manual - admin aprova</option>
                <option value="AUTO">Automático - vira no dia 1</option>
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
                transition: "background .15s",
              }}
            >
              {createMutation.isPending ? "Criando..." : "Criar grupo"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: groups, isLoading } = trpc.groups.list.useQuery();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <>
      {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} />}

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
            Dashboard
          </h1>
          <div style={{ marginTop: 3, fontSize: 13.5, color: "var(--ink-soft)" }}>
            Seus grupos financeiros
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "var(--amber)",
            color: "#3a2a08",
            border: "none",
            padding: "10px 17px",
            fontSize: 14,
            fontWeight: 680,
            borderRadius: 11,
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            whiteSpace: "nowrap",
            boxShadow: "0 1px 0 rgba(120,80,10,.15)",
          }}
        >
          ＋ Novo grupo
        </button>
      </div>

      {/* Content */}
      <div style={{ padding: "24px 32px 60px" }}>
        {isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  background: "var(--surface-2)",
                  borderRadius: 18,
                  height: 112,
                  animation: "pulse 1.5s infinite",
                }}
              />
            ))}
          </div>
        ) : groups?.length === 0 ? (
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
            <span style={{ fontSize: 52 }}>🐄</span>
            <p style={{ fontSize: 15, margin: 0, color: "var(--ink-soft)" }}>Nenhum grupo ainda.</p>
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              style={{
                background: "var(--amber)",
                color: "#3a2a08",
                border: "none",
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 680,
                borderRadius: 11,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                marginTop: 4,
              }}
            >
              Criar o primeiro grupo
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 16,
            }}
          >
            {groups?.map((group) => (
              <GroupCard key={group.id} group={group} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
