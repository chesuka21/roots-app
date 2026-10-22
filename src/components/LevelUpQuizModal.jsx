/* ---------- LevelUpQuizModal — examen de certificación CEFR ----------
   Se desbloquea al cumplir los 3 hitos del nivel actual (levelMilestones.js).
   8 preguntas mezcladas del nivel ACTUAL y el nivel ASPIRANTE (60/40), con
   orden aleatorio. ≥80% aprueba: sube `cefr`, +200 XP, confeti, y los
   generadores (Patterns/Suggest) leen `data.cefr` → contenido del nuevo nivel
   disponible de inmediato. Fallar no penaliza: se puede repetir otro día. */

import { useMemo, useState } from "react";
import { GraduationCap, X, Check, ChevronRight, PartyPopper, Loader2 } from "lucide-react";
import { QUIZ_BANK, quizQuestionText } from "../data/quiz.js";
import { CEFR_ORDER, cefrIndex } from "../data/patterns-cefr.js";
import { LEVELUP_PASS_SCORE, LEVELUP_BONUS_XP } from "../data/levelMilestones.js";

export default function LevelUpQuizModal({ data, styles, t = (k) => k, onClose, onPass, uiLang = "es" }) {
  const currentCefr = data?.cefr || "A1";
  const nextIdx = Math.min(CEFR_ORDER.length - 1, cefrIndex(currentCefr) + 1);
  const nextLevel = CEFR_ORDER[nextIdx];
  const [stage, setStage] = useState("intro"); // intro | quiz | result
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false); // terminó las 8 preguntas

  /* ── Selección de preguntas: 5 del nivel objetivo + 3 del actual, mezcladas ── */
  const questions = useMemo(() => {
    const pick = (level, n, exclude) => {
      const pool = [...(QUIZ_BANK[level] || [])].filter((q) => !exclude.includes(q.q));
      // shuffle determinista por sesión
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      return pool.slice(0, n);
    };
    const hard = pick(nextLevel, 5, []);
    const easy = pick(currentCefr, 3, hard.map((q) => q.q));
    return [...hard, ...easy]
      .sort(() => Math.random() - 0.5)
      .slice(0, 8);
  }, [currentCefr, nextLevel]);

  const total = questions.length;
  const needed = Math.ceil(total * LEVELUP_PASS_SCORE); // 8 → 7 correctas (87.5%) — conservador
  const passed = score >= needed;

  const answer = (i) => {
    if (picked !== null) return; // ya respondió
    setPicked(i);
    const correct = i === questions[idx].correct;
    if (correct) setScore((s) => s + 1);
  };
  const advance = () => {
    if (idx + 1 >= total) {
      setDone(true);
      setStage("result");
      return;
    }
    setIdx((i) => i + 1);
    setPicked(null);
  };

  /* Aprobar: el caller actualiza cefr/XP en App (estado + Supabase). */
  const finishPass = () => {
    onPass({ fromLevel: currentCefr, toLevel: nextLevel, score, total, bonusXp: LEVELUP_BONUS_XP });
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modalCard, maxWidth: 560, width: "92%" }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.wordHeaderRow}>
          <h2 style={styles.sectionTitle}>
            <GraduationCap size={20} color="#d9a441" style={{ verticalAlign: "-4px", marginRight: 7 }} />
            {t("Examen de ascenso")} — {currentCefr} → {nextLevel}
          </h2>
          <button style={styles.iconBtn} onClick={onClose} title={t("Cerrar")}>
            <X size={16} />
          </button>
        </div>

        {stage === "intro" && (
          <>
            <p style={styles.sectionBody}>
              {t("Demuestra que dominas el nivel actual y estás listo para el siguiente. 8 preguntas, necesitas acertar al menos")} {needed}/{total} ({Math.round(LEVELUP_PASS_SCORE * 100)}%).
            </p>
            <ul style={{ margin: "8px 0 14px", paddingLeft: 20, color: "#b7c2be", fontSize: 13.5, lineHeight: 1.7 }}>
              <li>{t("Preguntas del nivel actual y del siguiente, mezcladas.")}</li>
              <li>{t("Si apruebas: subes de nivel, +200 XP y acceso a patrones y sugerencias del nuevo nivel.")}</li>
              <li>{t("Si no apruebas, nada se pierde — puedes repetirlo cuando quieras.")}</li>
            </ul>
            <button style={styles.learnBtn} onClick={() => setStage("quiz")}>
              {t("Comenzar examen")} <ChevronRight size={16} />
            </button>
          </>
        )}

        {stage === "quiz" && (
          <>
            <p style={styles.formHint}>
              {t("Pregunta")} {idx + 1}/{total} · {t("acertadas")}: {score}
            </p>
            <p style={styles.sectionBody}>{quizQuestionText(questions[idx], uiLang)}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "10px 0 14px" }}>
              {questions[idx].options.map((opt, i) => {
                const isCorrect = i === questions[idx].correct;
                const isPicked = picked === i;
                const showState = picked !== null;
                return (
                  <button
                    key={i}
                    onClick={() => answer(i)}
                    style={{
                      ...styles.onboardOption,
                      ...(showState && isCorrect ? { border: "1px solid #6FBF8B", background: "rgba(111,191,139,0.12)", color: "#9fd9b8" } : {}),
                      ...(showState && isPicked && !isCorrect ? { border: "1px solid #d98c8c", background: "rgba(217,140,140,0.1)", color: "#d98c8c" } : {}),
                    }}
                  >
                    {showState && isCorrect && <Check size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />}
                    {opt}
                  </button>
                );
              })}
            </div>
            {picked !== null && (
              <button style={styles.learnBtn} onClick={advance}>
                {idx + 1 >= total ? t("Ver resultado") : t("Siguiente")} <ChevronRight size={15} />
              </button>
            )}
          </>
        )}

        {stage === "result" && (
          <>
            {passed ? (
              <>
                <div style={{ textAlign: "center", margin: "14px 0" }}>
                  <PartyPopper size={44} color="#d9a441" />
                  <p style={{ ...styles.progressNum, margin: "10px 0 4px", color: "#6FBF8B" }}>
                    {score}/{total} — {t("¡Aprobado!")}
                  </p>
                  <p style={styles.sectionBody}>
                    {t("Ahora estás en")} <b>{nextLevel}</b>. +{LEVELUP_BONUS_XP} XP
                  </p>
                </div>
                <div style={styles.confettiWrap} aria-hidden="true">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <span key={i} className="confetti-piece" style={{ left: `${(i * 4.3) % 100}%`, animationDelay: `${(i % 8) * 0.12}s`, background: ["#6FBF8B", "#D9A441", "#8CC9D9", "#C98CC9"][i % 4] }} />
                  ))}
                </div>
                <button style={styles.learnBtn} onClick={finishPass}>
                  {t("Continuar en")} {nextLevel} <ChevronRight size={16} />
                </button>
              </>
            ) : (
              <>
                <div style={{ textAlign: "center", margin: "14px 0" }}>
                  <p style={{ ...styles.progressNum, margin: "10px 0 4px", color: "#d98c8c" }}>
                    {score}/{total} — {t("Aún no")}
                  </p>
                  <p style={styles.sectionBody}>
                    {t("Necesitabas")} {needed}/{total}. {t("Repasa tus palabras y vuelve a intentarlo cuando quieras — no pierdes nada.")}
                  </p>
                </div>
                <button style={styles.tab} onClick={onClose}>
                  {t("Cerrar")}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
