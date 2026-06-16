"use client";

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: "12px",
              color: "var(--text-muted, #888)",
            }}
          >
            <span style={{ fontSize: "2rem" }}>!</span>
            <p style={{ margin: 0, fontWeight: 600 }}>Algo deu errado</p>
            <p style={{ margin: 0, fontSize: "0.85rem" }}>
              {this.state.error?.message ?? "Erro desconhecido"}
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                padding: "6px 16px",
                borderRadius: "6px",
                border: "1px solid var(--border, #ccc)",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              Tentar novamente
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
