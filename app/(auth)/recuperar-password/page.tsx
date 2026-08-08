import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
};

export default function RecuperarPasswordPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <h1
          style={{
            fontSize: "1.5rem",
            fontWeight: 700,
            marginBottom: 12,
            color: "var(--text-primary)",
          }}
        >
          Recuperar contraseña
        </h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
          Esta función se implementará en Fase 3.
        </p>
        <a
          href="/login"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "var(--accent)",
            fontSize: "0.875rem",
          }}
        >
          ← Volver al login
        </a>
      </div>
    </main>
  );
}
