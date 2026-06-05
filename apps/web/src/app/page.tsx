import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-6xl">🐄</span>
        <h1 className="text-4xl font-bold tracking-tight">Cowcular</h1>
        <p className="text-zinc-500 text-lg max-w-sm">
          Controle financeiro compartilhado para casais, lares e grupos.
        </p>
      </div>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-lg bg-zinc-900 px-6 py-2.5 text-white font-medium hover:bg-zinc-700 transition-colors"
        >
          Entrar
        </Link>
        <Link
          href="/register"
          className="rounded-lg border border-zinc-200 px-6 py-2.5 font-medium hover:bg-zinc-50 transition-colors"
        >
          Criar conta
        </Link>
      </div>
    </main>
  );
}
