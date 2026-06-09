"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthStore } from "@/store/auth";

type CookieStoreInstance = {
  set: (name: string, value: string, opts: Record<string, unknown>) => Promise<void>;
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
  transition: "border-color .15s",
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--ink-soft)",
};

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/auth/login`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password }),
        },
      );
      const data = (await res.json()) as {
        token?: string;
        user?: { id: string; username: string; name: string; email: string };
        error?: string;
      };
      if (!res.ok || !data.user || !data.token) {
        setError(data.error ?? "Credenciais inválidas.");
        return;
      }
      setAuth(data.user, data.token);
      if ("cookieStore" in window) {
        await (window.cookieStore as CookieStoreInstance).set("auth_token", data.token, {
          path: "/",
          maxAge: 604800,
          sameSite: "lax",
        });
      }
      const redirectTo = new URLSearchParams(window.location.search).get("redirect");
      router.push(redirectTo?.startsWith("/") ? redirectTo : "/dashboard");
    } catch {
      setError("Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: 380 }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <Image
            src="/cow.png"
            width={40}
            height={40}
            alt="Cowcular"
            style={{ objectFit: "contain" }}
          />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: 28,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
            }}
          >
            cow<span style={{ color: "var(--amber-deep)" }}>cular</span>
          </span>
        </div>
        <p style={{ fontSize: 14.5, color: "var(--ink-soft)", margin: 0 }}>
          Controle financeiro compartilhado
        </p>
      </div>

      {/* Card */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 18,
          padding: 28,
          boxShadow: "0 2px 12px -4px rgba(40,30,10,.08)",
        }}
      >
        <h1
          style={{
            margin: "0 0 20px",
            fontSize: 20,
            fontWeight: 800,
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.01em",
            color: "var(--ink)",
          }}
        >
          Entrar
        </h1>

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
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="identifier" style={labelStyle}>
              E-mail ou username
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="joao ou joao@exemplo.com"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="password" style={labelStyle}>
              Senha
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: loading ? "var(--amber-soft)" : "var(--amber)",
              color: "#3a2a08",
              fontFamily: "var(--font-body)",
              fontWeight: 680,
              fontSize: 14.5,
              border: "none",
              borderRadius: 11,
              padding: "11px 20px",
              width: "100%",
              cursor: loading ? "not-allowed" : "pointer",
              marginTop: 4,
              transition: "background .15s",
            }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>

          <p style={{ textAlign: "center", fontSize: 13.5, color: "var(--ink-soft)", margin: 0 }}>
            Não tem conta?{" "}
            <Link
              href="/register"
              style={{ color: "var(--amber-deep)", fontWeight: 600, textDecoration: "none" }}
            >
              Criar conta
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
