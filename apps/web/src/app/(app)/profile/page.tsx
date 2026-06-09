"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuthStore } from "@/store/auth";

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

const CURRENCIES = [
  { code: "BRL", label: "Real Brasileiro (BRL)" },
  { code: "USD", label: "Dólar Americano (USD)" },
  { code: "EUR", label: "Euro (EUR)" },
  { code: "GBP", label: "Libra Esterlina (GBP)" },
  { code: "ARS", label: "Peso Argentino (ARS)" },
];

export default function ProfilePage() {
  const { data: me } = trpc.auth.me.useQuery();
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const token = useAuthStore((s) => s.token);

  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [currency, setCurrency] = useState("BRL");
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (me) {
      setName(me.name ?? "");
      setAvatar(me.avatar ?? "");
      setCurrency(me.defaultCurrency ?? "BRL");
    }
  }, [me]);

  const updateMutation = trpc.auth.updateProfile.useMutation({
    onSuccess: (data) => {
      setProfileMsg({ type: "success", text: "Perfil atualizado com sucesso." });
      if (user && token) {
        setAuth({ ...user, name: data.name }, token);
      }
    },
    onError: (e) => setProfileMsg({ type: "error", text: e.message }),
  });

  const changePwMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      setPwMsg({ type: "success", text: "Senha alterada com sucesso." });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    },
    onError: (e) => setPwMsg({ type: "error", text: e.message }),
  });

  const handleProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileMsg(null);
    updateMutation.mutate({
      name: name || undefined,
      avatar: avatar || null,
      defaultCurrency: currency || undefined,
    });
  };

  const handlePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwMsg({ type: "error", text: "As senhas não coincidem." });
      return;
    }
    changePwMutation.mutate({ currentPassword: currentPw, newPassword: newPw });
  };

  const sectionStyle: React.CSSProperties = {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: 18,
    padding: 28,
    display: "flex",
    flexDirection: "column",
    gap: 18,
    maxWidth: 540,
  };

  const feedbackStyle = (type: "success" | "error"): React.CSSProperties => ({
    background: type === "success" ? "rgba(63,167,160,.12)" : "rgba(194,96,63,.1)",
    border: `1px solid ${type === "success" ? "rgba(63,167,160,.3)" : "rgba(194,96,63,.3)"}`,
    borderRadius: 10,
    padding: "10px 14px",
    fontSize: 13.5,
    color: type === "success" ? "var(--teal-deep)" : "var(--coral)",
  });

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
            Perfil
          </h1>
          <div style={{ marginTop: 3, fontSize: 13.5, color: "var(--ink-soft)" }}>
            Gerencie seus dados e preferências
          </div>
        </div>
      </div>

      <div style={{ padding: "28px 32px 60px", display: "flex", flexDirection: "column", gap: 24 }}>
        <section style={sectionStyle}>
          <h2
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 750,
              fontFamily: "var(--font-display)",
              color: "var(--ink)",
            }}
          >
            Dados pessoais
          </h2>

          {profileMsg && <div style={feedbackStyle(profileMsg.type)}>{profileMsg.text}</div>}

          <form
            onSubmit={handleProfile}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="profile-name" style={labelStyle}>
                Nome
              </label>
              <input
                id="profile-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="profile-avatar" style={labelStyle}>
                Avatar (URL de imagem)
              </label>
              <input
                id="profile-avatar"
                type="url"
                value={avatar}
                onChange={(e) => setAvatar(e.target.value)}
                placeholder="https://exemplo.com/foto.jpg"
                style={inputStyle}
              />
              {avatar && (
                // biome-ignore lint/performance/noImgElement: avatar is a user-supplied URL, Next.js Image requires domain allowlist
                <img
                  src={avatar}
                  alt="Preview do avatar"
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "2px solid var(--line-strong)",
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="profile-currency" style={labelStyle}>
                Moeda padrão
              </label>
              <select
                id="profile-currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{ ...inputStyle, appearance: "none" }}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                style={{
                  background: updateMutation.isPending ? "var(--amber-soft)" : "var(--amber)",
                  color: "#3a2a08",
                  border: "none",
                  borderRadius: 11,
                  padding: "10px 22px",
                  fontSize: 14,
                  fontWeight: 680,
                  fontFamily: "var(--font-body)",
                  cursor: updateMutation.isPending ? "not-allowed" : "pointer",
                }}
              >
                {updateMutation.isPending ? "Salvando..." : "Salvar alterações"}
              </button>
              {me && (
                <span style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>@{me.username}</span>
              )}
            </div>
          </form>
        </section>

        <section style={sectionStyle}>
          <h2
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 750,
              fontFamily: "var(--font-display)",
              color: "var(--ink)",
            }}
          >
            Alterar senha
          </h2>

          {pwMsg && <div style={feedbackStyle(pwMsg.type)}>{pwMsg.text}</div>}

          <form
            onSubmit={handlePassword}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="current-pw" style={labelStyle}>
                Senha atual
              </label>
              <input
                id="current-pw"
                type="password"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="new-pw" style={labelStyle}>
                Nova senha
              </label>
              <input
                id="new-pw"
                type="password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                minLength={8}
                required
                style={inputStyle}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label htmlFor="confirm-pw" style={labelStyle}>
                Confirmar nova senha
              </label>
              <input
                id="confirm-pw"
                type="password"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={changePwMutation.isPending}
              style={{
                background: changePwMutation.isPending ? "rgba(46,128,121,.5)" : "var(--teal)",
                color: "#fff",
                border: "none",
                borderRadius: 11,
                padding: "10px 22px",
                fontSize: 14,
                fontWeight: 680,
                fontFamily: "var(--font-body)",
                cursor: changePwMutation.isPending ? "not-allowed" : "pointer",
                alignSelf: "flex-start",
              }}
            >
              {changePwMutation.isPending ? "Alterando..." : "Alterar senha"}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}
