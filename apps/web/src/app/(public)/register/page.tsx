"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

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

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError("Username deve conter apenas letras, números e underscores.");
      return;
    }
    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/auth/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email, name, password }),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "E-mail ou username já em uso.");
        return;
      }
      setSuccess(true);
    } catch {
      setError("Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            marginBottom: 28,
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
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 18,
            padding: 28,
            boxShadow: "0 2px 12px -4px rgba(40,30,10,.08)",
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
          <h1
            style={{
              margin: "0 0 8px",
              fontSize: 22,
              fontWeight: 800,
              fontFamily: "var(--font-display)",
              color: "var(--ink)",
            }}
          >
            Conta criada!
          </h1>
          <p style={{ fontSize: 14, color: "var(--ink-soft)", margin: "0 0 20px" }}>
            Sua conta foi criada com sucesso. Faça login para continuar.
          </p>
          <Link
            href="/login"
            style={{
              display: "block",
              background: "var(--amber)",
              color: "#3a2a08",
              fontWeight: 680,
              fontSize: 14.5,
              borderRadius: 11,
              padding: "11px 20px",
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            Ir para o login
          </Link>
        </div>
      </div>
    );
  }

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
          Criar conta
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

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="name" style={labelStyle}>
              Nome
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="João Silva"
              required
              style={inputStyle}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="username" style={labelStyle}>
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="joao_silva"
              required
              style={inputStyle}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="email" style={labelStyle}>
              E-mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="joao@exemplo.com"
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
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor="confirmPassword" style={labelStyle}>
              Confirmar senha
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {loading ? "Criando conta..." : "Criar conta"}
          </button>
          <p style={{ textAlign: "center", fontSize: 13.5, color: "var(--ink-soft)", margin: 0 }}>
            Já tem conta?{" "}
            <Link
              href="/login"
              style={{ color: "var(--amber-deep)", fontWeight: 600, textDecoration: "none" }}
            >
              Entrar
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
