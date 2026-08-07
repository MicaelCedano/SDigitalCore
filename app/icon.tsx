import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #5750f1 0%, #3b82f6 100%)",
          borderRadius: "8px",
          color: "white",
          fontSize: "18px",
          fontWeight: 900,
          fontFamily: "system-ui, sans-serif",
          boxShadow: "0 2px 4px rgba(87, 80, 241, 0.4)",
        }}
      >
        S
      </div>
    ),
    {
      ...size,
    }
  );
}
