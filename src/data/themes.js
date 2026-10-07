/* ---------- Temas de la app (Dark Slate / Midnight / OLED / Light) ----------
   El usuario los elige en Ajustes; persistidos en `data.theme`.
   El objeto `styles` consume `THEMES[theme]` en App.jsx. */
export const THEMES = {
  slate: {
    id: "slate",
    name: "Dark Slate",
    background: "radial-gradient(1200px 500px at 50% -120px, #1d2f2a 0%, #12181b 55%), radial-gradient(900px 400px at 100% 100%, #14202b 0%, transparent 60%), #12181b",
    headerBg: "rgba(111,191,139,0.045)",
    headerBorder: "#23362f",
    sectionBg: "#12181b",
    cardBg: "#1a2228",
    cardBorder: "#2f3b42",
    text: "#eae4d8",
    dim: "#b7c2be",
    faint: "#5a6763",
    accent: "#6FBF8B",
  },
  midnight: {
    id: "midnight",
    name: "Midnight",
    background: "radial-gradient(1200px 500px at 50% -120px, #0f1633 0%, #0a0f1f 55%), radial-gradient(900px 400px at 100% 100%, #141433 0%, transparent 60%), #0a0f1f",
    headerBg: "rgba(140,201,217,0.06)",
    headerBorder: "#1e2d3d",
    sectionBg: "#0d1320",
    cardBg: "#1a2133",
    cardBorder: "#2d3b52",
    text: "#e8eef8",
    dim: "#b8c4d6",
    faint: "#5a6a82",
    accent: "#8CC9D9",
  },
  oled: {
    id: "oled",
    name: "OLED (black)",
    background: "#000000",
    headerBg: "rgba(111,191,139,0.08)",
    headerBorder: "#1a1a1a",
    sectionBg: "#000000",
    cardBg: "#0a0a0a",
    cardBorder: "#222222",
    text: "#ffffff",
    dim: "#c0c0c0",
    faint: "#666666",
    accent: "#6FBF8B",
  },
  light: {
    id: "light",
    name: "Light",
    background: "radial-gradient(1200px 500px at 50% -120px, #f5f8f5 0%, #eef2f0 55%), radial-gradient(900px 400px at 100% 100%, #e8edf0 0%, transparent 60%), #eef2f0",
    headerBg: "rgba(111,191,139,0.08)",
    headerBorder: "#c8d3ce",
    sectionBg: "#f5f8f5",
    cardBg: "#ffffff",
    cardBorder: "#d0d8d4",
    text: "#1a2a28",
    dim: "#5a6a66",
    faint: "#9ca8a4",
    accent: "#4d8a5e",
  },
};

const THEME_KEYS = ["slate", "midnight", "oled", "light"];
export function themeNameOf(id) {
  return THEMES[id]?.name || "Dark Slate";
}
