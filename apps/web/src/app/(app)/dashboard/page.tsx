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

const GROUP_ICONS: Record<string, string> = {
  HOME: "🏠",
  TRIP: "✈️",
  BBQ: "🍖",
  GIFT: "🎁",
  FUNDRAISER: "💰",
  GENERAL: "📋",
};

function getGroupIcon(type: GroupType, eventType: EventType | null): string {
  if (type === "HOME") return GROUP_ICONS.HOME;
  return GROUP_ICONS[eventType ?? "GENERAL"] ?? GROUP_ICONS.GENERAL;
}

function GroupCard({ group }: { group: Group }) {
  return (
    <a
      href={`/groups/${group.id}`}
      className="bg-white rounded-xl border border-zinc-200 p-5 hover:border-amber-300 hover:shadow-sm transition-all flex flex-col gap-3"
    >
      <div className="flex items-center gap-3">
        <span className="text-3xl">{getGroupIcon(group.type, group.eventType)}</span>
        <div>
          <p className="font-semibold text-zinc-900">{group.name}</p>
          <p className="text-xs text-zinc-500">{group.type === "HOME" ? "Lar" : "Grupo Avulso"}</p>
        </div>
      </div>
      <p className="text-xs text-zinc-400">
        {group.members.length} membro{group.members.length !== 1 ? "s" : ""}
      </p>
    </a>
  );
}

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
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xl w-full max-w-sm p-6">
        <h2 className="font-bold text-lg text-zinc-900 mb-4">Novo grupo</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            {(["HOME", "EVENT"] as GroupType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setGroupType(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  groupType === t
                    ? "bg-amber-500 text-white border-amber-500"
                    : "bg-white text-zinc-700 border-zinc-300 hover:border-amber-300"
                }`}
              >
                {t === "HOME" ? "🏠 Lar" : "🎉 Grupo Avulso"}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="group-name" className="text-sm font-medium text-zinc-700">
              Nome
            </label>
            <input
              id="group-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={groupType === "HOME" ? "Casa do João" : "Viagem para SP"}
              required
              className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          {groupType === "EVENT" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="event-type" className="text-sm font-medium text-zinc-700">
                Tipo
              </label>
              <select
                id="event-type"
                value={eventType}
                onChange={(e) => setEventType(e.target.value as EventType)}
                className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
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
            <div className="flex flex-col gap-1.5">
              <label htmlFor="closing-mode" className="text-sm font-medium text-zinc-700">
                Fechamento mensal
              </label>
              <select
                id="closing-mode"
                value={closingMode}
                onChange={(e) => setClosingMode(e.target.value as ClosingMode)}
                className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="MANUAL">Manual - admin aprova</option>
                <option value="AUTO">Automático - vira no dia 1</option>
              </select>
            </div>
          )}
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-zinc-300 text-zinc-700 rounded-lg py-2.5 text-sm hover:bg-zinc-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              {createMutation.isPending ? "Criando..." : "Criar"}
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-zinc-900">Meus grupos</h1>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg px-4 py-2 transition-colors"
        >
          + Novo grupo
        </button>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-zinc-100 rounded-xl h-28 animate-pulse" />
          ))}
        </div>
      ) : groups?.length === 0 ? (
        <div className="text-center py-16 text-zinc-400">
          <span className="text-5xl">🐄</span>
          <p className="mt-3">Nenhum grupo ainda. Crie o primeiro!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups?.map((group) => (
            <GroupCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </>
  );
}
