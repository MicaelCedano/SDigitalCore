import type { Metadata } from "next";
export const metadata: Metadata = { title: "RMA / Garantías" };
export default function Page() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 20, textAlign: "center" }}>
      <span style={{ fontSize: "3.5rem" }}>🛡️</span>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#f472b6", margin: 0 }}>RMA / Garantías</h1>
      <p style={{ color: "var(--text-secondary)", margin: 0, maxWidth: 380 }}>Casos de garantía, diagnóstico y resoluciones.</p>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 100, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
        🚧 Se construye en <strong style={{ color: "var(--text-secondary)" }}>Fase 11</strong>
      </div>
    </div>
  );
}
