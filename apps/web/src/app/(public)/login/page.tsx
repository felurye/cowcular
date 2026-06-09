"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthStore } from "@/store/auth";

type CookieStoreInstance = {
  set: (name: string, value: string, opts: Record<string, unknown>) => Promise<void>;
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
      // Salva cookie para o middleware (7 dias)
      if ("cookieStore" in window) {
        await (window.cookieStore as CookieStoreInstance).set("auth_token", data.token, {
          path: "/",
          maxAge: 604800,
          sameSite: "lax",
        });
      }
      router.push("/dashboard");
    } catch {
      setError("Erro ao conectar com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <span className="text-5xl">🐄</span>
        <h1 className="text-2xl font-bold mt-3 text-zinc-900">Entrar no Cowcular</h1>
      </div>
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-zinc-200 shadow-sm p-6 flex flex-col gap-4"
      >
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="identifier" className="text-sm font-medium text-zinc-700">
            E-mail ou username
          </label>
          <input
            id="identifier"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="joao ou joao@exemplo.com"
            required
            className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-zinc-700">
            Senha
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white font-medium rounded-lg py-2.5 transition-colors"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
        <p className="text-center text-sm text-zinc-500">
          Não tem conta?{" "}
          <Link href="/register" className="text-amber-600 hover:underline font-medium">
            Criar conta
          </Link>
        </p>
      </form>
    </div>
  );
}
