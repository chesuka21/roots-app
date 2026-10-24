/* ---------- LanguageSwitcher — selector rápido de curso (estilo Duolingo) ----------
   Dropdown con banderas en el Header: cambia el target_language activo,
   agrega nuevos cursos al perfil (sin cerrar sesión ni borrar datos) y muestra
   la bandera del curso actual. La gamificación (racha/XP) es GLOBAL: no toca
   progression. Al cambiar a un curso nuevo sin nivel → lanza quiz de nivelación
   (App lo maneja con onboardedForLang). */

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Check } from "lucide-react";
import { COURSES, courseOf } from "../data/translations.js";

export default function LanguageSwitcher({ data, styles, t = (k) => k, onSelect, onAddCourse }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = courseOf(data?.targetLanguage || "en");
  const courses = data?.courses || ["en"];

  // cerrar al hacer clic fuera
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const available = COURSES.filter((c) => !courses.includes(c.code));

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        style={{
          ...styles.cloudBadge,
          background: "rgba(140,201,217,0.08)",
        }}
        onClick={() => setOpen((v) => !v)}
        title={t("Cambiar idioma de estudio")}
      >
        <span style={{ fontSize: 14 }}>{active.flag}</span>
        <span>{active.label}</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "110%", right: 0, zIndex: 60,
            background: "#1c2530", border: "1px solid #2f3b42", borderRadius: 10,
            padding: 6, minWidth: 190, boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          }}
        >
          <p style={{ margin: "2px 8px 6px", fontSize: 10.5, color: "#5a6763", fontFamily: "ui-monospace, monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>
            {t("Mis cursos")}
          </p>
          {COURSES.filter((c) => courses.includes(c.code)).map((c) => (
            <button
              key={c.code}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                background: c.code === active.code ? "rgba(111,191,139,0.12)" : "transparent",
                border: "none", color: c.code === active.code ? "#9fd9b8" : "#b7c2be",
                padding: "8px 10px", borderRadius: 7, cursor: "pointer", fontSize: 13.5,
                textAlign: "left", fontFamily: "inherit",
              }}
              onClick={() => { onSelect(c.code); setOpen(false); }}
            >
              <span style={{ fontSize: 16 }}>{c.flag}</span>
              <span style={{ flex: 1 }}>{c.label}</span>
              {c.code === active.code && <Check size={14} color="#6FBF8B" />}
            </button>
          ))}

          {available.length > 0 && (
            <>
              <div style={{ borderTop: "1px solid #2f3b42", margin: "6px 0" }} />
              <p style={{ margin: "2px 8px 6px", fontSize: 10.5, color: "#5a6763", fontFamily: "ui-monospace, monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {t("Agregar curso")}
              </p>
              {available.map((c) => (
                <button
                  key={c.code}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, width: "100%",
                    background: "transparent", border: "none", color: "#8CC9D9",
                    padding: "8px 10px", borderRadius: 7, cursor: "pointer", fontSize: 13.5,
                    textAlign: "left", fontFamily: "inherit",
                  }}
                  onClick={() => { onAddCourse(c.code); setOpen(false); }}
                >
                  <span style={{ fontSize: 16 }}>{c.flag}</span>
                  <span style={{ flex: 1 }}>{c.label}</span>
                  <Plus size={13} color="#8CC9D9" />
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
