import { ImageResponse } from "next/og";

export const alt = "Smart Learning Ledger";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Shared card for social previews. Translated titles live in the page metadata, not in this image. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#0f172a",
          color: "#f8fafc",
          padding: "72px",
        }}
      >
        <div style={{ fontSize: 28, letterSpacing: "0.08em", color: "#a5b4fc" }}>SMART LEARNING LEDGER</div>
        <div style={{ marginTop: 24, fontSize: 64, fontWeight: 700, lineHeight: 1.1, maxWidth: 900 }}>
          Evolve how you learn, work and lead
        </div>
        <div style={{ marginTop: 28, fontSize: 28, color: "#cbd5e1" }}>Summaries, diagrams and quizzes, with exact citations.</div>
      </div>
    ),
    { ...size },
  );
}
