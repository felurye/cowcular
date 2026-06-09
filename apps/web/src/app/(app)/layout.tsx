import { AppHeader } from "@/components/app-header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <AppHeader />
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
