import type { Metadata } from "next";

export const metadata: Metadata = { title: "Inventario" };

export default function InventarioPage() {
  return <ModulePlaceholder name="Inventario" fase={5} color="#818cf8" emoji="📦" description="Alta de equipos, IMEIs, búsqueda y estados." />;
}

function ModulePlaceholder({ name, fase, color, emoji, description }: { name: string; fase: number; color: string; emoji: string; description: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 20, textAlign: "center" }}>
      <span style={{ fontSize: "3.5rem" }}>{emoji}</span>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: color, margin: 0 }}>{name}</h1>
      <p style={{ color: "var(--text-secondary)", margin: 0, maxWidth: 380 }}>{description}</p>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 100, fontSize: "0.8125rem", color: "var(--text-muted)" }}>
        🚧 Se construye en <strong style={{ color: "var(--text-secondary)" }}>Fase {fase}</strong>
      </div>
    </div>
  );
}
