import { ErrorBoundary } from "@/components/error-boundary";
import { BottomNav, Sidebar } from "@/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "var(--bg)" }}>
      <Sidebar />
      <div
        id="main-scroll"
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflowY: "auto",
        }}
      >
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
      <BottomNav />
    </div>
  );
}
