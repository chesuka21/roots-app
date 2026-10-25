/* ---------- LevelUpQuizModal — examen de certificación CEFR ----------
   Se desbloquea al cumplir los 3 hitos del nivel actual (checkLevelUpEligibility).
   8 preguntas EXCLUSIVAMENTE del nivel objetivo (estructuras + vocabulario del
   salto), orden aleatorio. El % mínimo lo define la tabla estricta por nivel
   (75% A2, 80% B1/B2, 85% C1/C2). Instrucciones en native_language (t() +
   quizQuestionText), preguntas evaluadas en target_language (en inglés).
   Al aprobar: sube `cefr`, +bonus XP de la tabla, confeti, y los generadores
   (Patterns/Suggest) leen `data.cefr` → contenido del nuevo nivel al instante.
   Al fallar: levelUpFailLock — reintento tras completar una sesión de repaso. */

import { useMemo, useState } from "react";
import { GraduationCap, X, Check, ChevronRight, PartyPopper, Loader2, Lock } from "lucide-react";
import { bankFor, quizQuestionText } from "../data/quiz.js";
import { CEFR_ORDER, cefrIndex } from "../data/patterns-cefr.js";

export default function LevelUpQuizModal({ data, styles, t = (k) => k, onClose, onPass, uiLang = "es", onFail }) {
  const currentCefr = data?.cefr || "A1";
  const nextIdx = Math.min(CEFR_ORDER.length - 1, cefrIndex(currentCefr) + 1);
  const nextLevel = CEFR_ORDER[nextIdx];
  // passScore/bonusXp vienen del caller (App los lee de checkLevelUpEligibility)
  const passScore = data?.levelUp?.passScore ?? 0.8;
  const bonusXp = data?.levelUp?.bonusXp ?? 200;
  const [stage, setStage] = useState("intro"); // intro | quiz | result
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  /* ── Selección: 8 preguntas EXCLUSIVAS del nivel objetivo (en el idioma que
        se estudia: target_language), orden aleatorio ── */
  const questions = useMemo(() => {
    const pool = [...bankFor(data?.targetLanguage || "en", nextLevel)];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 8);
  }, [nextLevel, data?.targetLanguage]);

  const total = questions.length;
  const needed = Math.max(1, Math.ceil(total * passScore));
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
    onPass({ fromLevel: currentCefr, toLevel: nextLevel, score, total, bonusXp });
  };
  /* Fallar: activa el lock — el reintento se desbloquea tras una sesión de repaso. */
  const finishFail = () => {
    onFail?.({ fromLevel: currentCefr, toLevel: nextLevel, score, total });
    onClose();
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
                    {t("Ahora estás en")} <b>{nextLevel}</b>. +{bonusXp} XP
                  </p>
                </div>
                <div style={styles.confettiWrap} aria-hidden="true">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <span key={i} className="roots-confetti-piece" style={{ left: `${(i * 4.3) % 100}%`, animationDelay: `${(i % 8) * 0.12}s`, background: ["#6FBF8B", "#D9A441", "#8CC9D9", "#C98CC9"][i % 4] }} />
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
                    {t("Necesitabas")} {needed}/{total}. {t("Reintento bloqueado hasta completar una sesión de repaso.")}
                  </p>
                </div>
                <button style={styles.tab} onClick={finishFail}>
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
