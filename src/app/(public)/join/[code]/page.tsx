"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useFindGroupByCode, useJoinGroup } from "@/hooks/use-groups";
import { useAuthStore } from "@/store/auth";

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

type GroupResult = {
  id: string;
  name: string;
  type: string;
  event_type: string | null;
  code: string;
  _count: { members: number };
};

export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [joinError, setJoinError] = useState("");

  const { data: rawGroup, isLoading } = useFindGroupByCode(params.code);
  const group = rawGroup as GroupResult | undefined;

  const joinMutation = useJoinGroup({
    onSuccess: (data) => router.push(`/groups/${data.groupId}`),
    onError: (err) => setJoinError(err.message),
  });

  if (isLoading) {
    return (
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center", color: "var(--ink-faint)" }}>
        Carregando...
      </div>
    );
  }

  if (!group) {
    return (
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 18,
            padding: 32,
            textAlign: "center",
            boxShadow: "0 2px 12px -4px rgba(40,30,10,.08)",
          }}
        >
          <span style={{ fontSize: 48 }}>🔍</span>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 20,
              color: "var(--ink)",
              margin: "12px 0 8px",
            }}
          >
            Grupo não encontrado
          </h2>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 20px" }}>
            O código{" "}
            <code style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{params.code}</code> não
            corresponde a nenhum grupo ativo.
          </p>
          <a
            href="/dashboard"
            style={{
              color: "var(--amber-deep)",
              fontWeight: 600,
              textDecoration: "none",
              fontSize: 14,
            }}
          >
            Ir para o Dashboard
          </a>
        </div>
      </div>
    );
  }

  const emoji =
    group.type === "HOME" ? GROUP_EMOJI.HOME : (GROUP_EMOJI[group.event_type ?? "GENERAL"] ?? "📋");
  const typeLabel =
    group.type === "HOME" ? "Lar" : (EVENT_LABEL[group.event_type ?? "GENERAL"] ?? "Grupo avulso");

  return (
    <div style={{ width: "100%", maxWidth: 380 }}>
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginBottom: 6,
          }}
        >
          <Image
            src="/cow.png"
            width={30}
            height={30}
            alt="Cowcular"
            style={{ objectFit: "contain", height: "auto" }}
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
      </div>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 18,
          padding: 28,
          boxShadow: "0 2px 12px -4px rgba(40,30,10,.08)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 52, marginBottom: 10 }}>{emoji}</div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 22,
              color: "var(--ink)",
              margin: "0 0 8px",
            }}
          >
            {group.name}
          </h1>
          <span
            style={{
              display: "inline-block",
              fontSize: 12.5,
              fontWeight: 650,
              padding: "3px 10px",
              borderRadius: 8,
              background: group.type === "HOME" ? "rgba(63,167,160,.16)" : "rgba(232,162,61,.14)",
              color: group.type === "HOME" ? "var(--teal-deep)" : "var(--amber-deep)",
            }}
          >
            {typeLabel}
          </span>
          <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--ink-faint)" }}>
            {group._count.members} membro{group._count.members !== 1 ? "s" : ""}
          </p>
        </div>

        {joinError && (
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
            {joinError}
          </div>
        )}

        {joinMutation.isSuccess ? (
          <div
            style={{
              textAlign: "center",
              padding: 12,
              color: "var(--teal-deep)",
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            Você entrou no grupo! Redirecionando...
          </div>
        ) : user ? (
          <button
            type="button"
            disabled={joinMutation.isPending}
            onClick={() => {
              setJoinError("");
              joinMutation.mutate({ code: params.code });
            }}
            style={{
              width: "100%",
              background: joinMutation.isPending ? "var(--amber-soft)" : "var(--amber)",
              color: "#3a2a08",
              border: "none",
              borderRadius: 11,
              padding: "12px 20px",
              fontSize: 15,
              fontWeight: 680,
              fontFamily: "var(--font-body)",
              cursor: joinMutation.isPending ? "not-allowed" : "pointer",
            }}
          >
            {joinMutation.isPending ? "Entrando..." : "Entrar no grupo"}
          </button>
        ) : (
          <div>
            <p
              style={{
                textAlign: "center",
                fontSize: 13.5,
                color: "var(--ink-soft)",
                margin: "0 0 14px",
              }}
            >
              Você precisa estar logado para entrar neste grupo.
            </p>
            <a
              href={`/login?redirect=/join/${params.code}`}
              style={{
                display: "block",
                background: "var(--amber)",
                color: "#3a2a08",
                textDecoration: "none",
                borderRadius: 11,
                padding: "12px 20px",
                fontSize: 15,
                fontWeight: 680,
                fontFamily: "var(--font-body)",
                textAlign: "center",
              }}
            >
              Entrar / Criar conta
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
