/* ---------- AddLanguageModal — agregar un curso nuevo (flujo corto) ----------
   Para usuarios YA onboarded: solo 2 pasos, SIN repetir nombre/edad/género/
   idioma nativo/intereses (se reutilizan del perfil existente):
   Paso 1: elegir el nuevo target_language (tarjetas con bandera).
   Paso 2: nivel inicial A1-C2 o Test de Ubicación Rápido (quiz adaptativo).
   Al confirmar: crea langData[nuevo] y activa el curso.                    */

import { useMemo, useState } from "react";
import { X, Check, GraduationCap, ClipboardList } from "lucide-react";
import { COURSES, courseOf } from "../data/translations.js";
import { CEFR_ORDER } from "../data/patterns-cefr.js";
import { bankFor, quizQuestionText } from "../data/quiz.js";

const PLACEMENT_LENGTH = 5; // test de ubicación rápido

export default function AddLanguageModal({ data, styles, t = (k) => k, uiLang = "es", onClose, onConfirm }) {
  const [step, setStep] = useState(1); // 1: idioma | 2: nivel
  const [lang, setLang] = useState(null);
  const [mode, setMode] = useState("select"); // select | placement | result
  const [qIdx, setQIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [picked, setPicked] = useState(null);

  const existing = data?.courses || [data?.targetLanguage || "en"];
  const available = COURSES.filter((c) => !existing.includes(c.code));
  const course = lang ? courseOf(lang) : null;

  /* Test de ubicación: 5 preguntas mezcladas A1→B1 del nuevo idioma (rung final = CEFR) */
  const placementQs = useMemo(() => {
    if (mode !== "placement") return [];
    const rungs = ["A1", "A1", "A2", "B1", "B1"];
    return rungs
      .map((r) => {
        const pool = bankFor(lang, r);
        return pool[Math.floor(Math.random() * pool.length)];
      })
      .filter(Boolean);
  }, [mode]);

  const answerPlacement = (i) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === placementQs[qIdx]?.correct) setCorrect((c) => c + 1);
  };
  const advancePlacement = () => {
    if (qIdx + 1 >= placementQs.length) {
      setMode("result");
      return;
    }
    setQIdx((i) => i + 1);
    setPicked(null);
  };
  /* Score → CEFR: 0-1 → A1 · 2-3 → A2 · 4-5 → B1 */
  const placementCefr = () => {
    if (correct >= 4) return "B1";
    if (correct >= 2) return "A2";
    return "A1";
  };

  const confirm = (cefrFinal, levelFinal) => {
    onConfirm({ langCode: lang, cefr: cefrFinal, level: levelFinal });
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modalCard, maxWidth: 520, width: "92%" }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.wordHeaderRow}>
          <h2 style={styles.sectionTitle}>
            {course ? <span style={{ marginRight: 7 }}>{course.flag}</span> : "🌍"} {t("Agregar curso")}
          </h2>
          <button style={styles.iconBtn} onClick={onClose} title={t("Cerrar")}>
            <X size={16} />
          </button>
        </div>

        {/* ── PASO 1: elegir idioma ── */}
        {step === 1 && (
          <>
            <p style={styles.sectionBody}>{t("Elige el idioma que quieres aprender — tu perfil ya está listo.")}</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "10px 0" }}>
              {available.map((c) => (
                <button
                  key={c.code}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    background: lang === c.code ? "rgba(111,191,139,0.12)" : "rgba(255,255,255,0.02)",
                    border: lang === c.code ? "1px solid #6FBF8B" : "1px solid #2f3b42",
                    borderRadius: 10, padding: "12px 14px", cursor: "pointer", textAlign: "left",
                  }}
                  onClick={() => setLang(c.code)}
                >
                  <span style={{ fontSize: 24 }}>{c.flag}</span>
                  <span style={{ color: "#eae4d8", fontSize: 14, fontWeight: 600 }}>{c.label}</span>
                  {lang === c.code && <Check size={15} color="#6FBF8B" style={{ marginLeft: "auto" }} />}
                </button>
              ))}
              {available.length === 0 && (
                <p style={styles.formHint}>{t("Ya tienes todos los idiomas disponibles en tu perfil.")}</p>
              )}
            </div>
            <button
              style={{ ...styles.learnBtn, opacity: lang ? 1 : 0.5 }}
              disabled={!lang}
              onClick={() => setStep(2)}
            >
              {t("Continuar")} <ChevronRightInline />
            </button>
          </>
        )}

        {/* ── PASO 2: nivel inicial o test de ubicación ── */}
        {step === 2 && mode === "select" && (
          <>
            <p style={styles.sectionBody}>
              {t("¿Cuál es tu nivel actual en")} {course?.label}? {t("Si no estás seguro, haz el test de ubicación de 5 preguntas.")}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0" }}>
              {CEFR_ORDER.map((c) => (
                <button
                  key={c}
                  style={styles.onboardOption}
                  onClick={() => confirm(c, c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <button
              style={{ ...styles.tab, marginTop: 8 }}
              onClick={() => { setMode("placement"); setQIdx(0); setCorrect(0); setPicked(null); }}
            >
              <ClipboardList size={14} style={{ verticalAlign: "-2px" }} /> {t("Test de Ubicación Rápido")}
            </button>
          </>
        )}

        {/* Test de ubicación */}
        {step === 2 && mode === "placement" && (
          <>
            <p style={styles.formHint}>
              {t("Pregunta")} {qIdx + 1}/{placementQs.length}
            </p>
            <p style={styles.sectionBody}>{quizQuestionText(placementQs[qIdx], uiLang)}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "10px 0" }}>
              {placementQs[qIdx].options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => answerPlacement(i)}
                  style={{
                    ...styles.onboardOption,
                    ...(picked !== null && i === placementQs[qIdx].correct ? { border: "1px solid #6FBF8B", background: "rgba(111,191,139,0.12)", color: "#9fd9b8" } : {}),
                    ...(picked === i && i !== placementQs[qIdx].correct ? { border: "1px solid #d98c8c", color: "#d98c8c" } : {}),
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
            {picked !== null && (
              <button style={styles.learnBtn} onClick={advancePlacement}>
                {qIdx + 1 >= placementQs.length ? t("Ver resultado") : t("Siguiente")}
              </button>
            )}
          </>
        )}

        {/* Resultado del test de ubicación */}
        {step === 2 && mode === "result" && (
          <>
            <div style={{ textAlign: "center", margin: "14px 0" }}>
              <GraduationCap size={40} color="#d9a441" />
              <p style={{ ...styles.progressNum, margin: "10px 0 4px", color: "#6FBF8B" }}>
                {correct}/{placementQs.length}
              </p>
              <p style={styles.sectionBody}>
                {t("Tu nivel en")} {course?.label}: <b>{placementCefr()}</b>
              </p>
            </div>
            <button style={styles.learnBtn} onClick={() => confirm(placementCefr(), placementCefr())}>
              {t("Comenzar")} {course?.label} <ChevronRightInline />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ChevronRightInline() {
  return <span style={{ marginLeft: 4 }}>›</span>;
}
