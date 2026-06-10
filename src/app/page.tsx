"use client";

import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: "32px 16px",
        gap: 0,
      }}
    >
      {/* Hero */}
      <div
        style={{
          textAlign: "center",
          maxWidth: 460,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Image
          src="/cow.png"
          width={80}
          height={80}
          alt="Cowcular"
          style={{ objectFit: "contain", height: "auto" }}
          priority
        />
        <h1
          style={{
            margin: 0,
            fontSize: 44,
            fontWeight: 900,
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.03em",
            color: "var(--ink)",
            lineHeight: 1.08,
          }}
        >
          cow<span style={{ color: "var(--amber)" }}>cular</span>
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 17,
            color: "var(--ink-soft)",
            lineHeight: 1.55,
            maxWidth: 360,
          }}
        >
          Controle financeiro compartilhado para casais, lares e grupos.
        </p>

        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <Link
            href="/login"
            style={{
              background: "var(--amber)",
              color: "#3a2a08",
              fontWeight: 700,
              fontSize: 15,
              fontFamily: "var(--font-body)",
              padding: "12px 24px",
              borderRadius: 12,
              textDecoration: "none",
              boxShadow: "0 1px 0 rgba(120,80,10,.18)",
            }}
          >
            Entrar
          </Link>
          <Link
            href="/register"
            style={{
              border: "1.5px solid var(--line-strong)",
              color: "var(--ink)",
              fontWeight: 650,
              fontSize: 15,
              fontFamily: "var(--font-body)",
              padding: "12px 24px",
              borderRadius: 12,
              textDecoration: "none",
              background: "var(--surface)",
            }}
          >
            Criar conta
          </Link>
        </div>
      </div>

      {/* Feature pills */}
      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          justifyContent: "center",
          marginTop: 52,
        }}
      >
        {[
          { icon: "🏠", text: "Grupos domésticos" },
          { icon: "✈️", text: "Despesas de viagem" },
          { icon: "⚖️", text: "Divisão inteligente" },
          { icon: "📊", text: "Relatórios mensais" },
        ].map(({ icon, text }) => (
          <div
            key={text}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: 100,
              padding: "8px 14px",
              fontSize: 13.5,
              color: "var(--ink-soft)",
              fontWeight: 550,
            }}
          >
            <span>{icon}</span>
            <span>{text}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
