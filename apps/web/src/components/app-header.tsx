"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";

export function AppHeader() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();

  const handleLogout = () => {
    logout();
    // biome-ignore lint/suspicious/noDocumentCookie: Cookie Store API not available in all environments
    document.cookie = "auth_token=; path=/; max-age=0";
    router.push("/login");
  };

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-zinc-900">
          <span>🐄</span>
          <span>Cowcular</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-600">{user?.name}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-sm text-zinc-500 hover:text-zinc-800 transition-colors"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
