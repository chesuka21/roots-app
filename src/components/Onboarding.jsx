import { useState } from "react";
import { Sprout, X, Check, ChevronRight } from "lucide-react";
import { SUPPORTED_LANGUAGES, languageLabel } from "../data/translations.js";
import { CEFR_ORDER } from "../data/patterns-cefr.js";
import { QUIZ_LENGTH, SELF_TO_RUNG, nextRung, pickQuizQuestion, quizQuestionText, PRESET_INTERESTS } from "../App.jsx";

export default function Onboarding({ onFinish, styles, t = (k) => k, uiLang = "es", onNativeLangChange }) {
  // Textos de la interfaz traducidos con `t` (native_language del usuario);
  // el quiz usa quizQuestionText(q, uiLang) para sus instrucciones.
  // onNativeLangChange: propaga el idioma elegido AL ESTADO DE APP AL INSTANTE
  // (así `t` reacciona y TODOS los pasos siguientes se traducen).
  const [step, setStep] = useState("profile"); // "profile" | "languages" | "interests" | "self" | "quiz" | "result"
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [nativeLanguage, setNativeLanguage] = useState("es");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [interests, setInterests] = useState([]);
  const [selfReport, setSelfReport] = useState(null);
  const [quizIdx, setQuizIdx] = useState(0);
  const [rung, setRung] = useState(null); // rung CEFR actual de la escalera adaptativa
  const [asked, setAsked] = useState([]); // preguntas ya mostradas (no repetir)
  const [currentQ, setCurrentQ] = useState(null);
  const [picked, setPicked] = useState(null);
  const [finalLevel, setFinalLevel] = useState(null);
  const [finalCefr, setFinalCefr] = useState(null);

  const profileValid = name.trim().length > 0; // nombre obligatorio; edad/género opcionales
  const STEP_TITLES = { profile: "Perfil", languages: "Idiomas", interests: "Intereses", level: "Nivel" };
  const stepNum = { profile: 1, languages: 2, interests: 3, self: 4, quiz: 4, result: 4 }[step] || 1;

  const startQuiz = (lvl) => {
    const startRung = SELF_TO_RUNG[lvl] || "A1";
    const q = pickQuizQuestion(startRung, []);
    setSelfReport(lvl);
    setRung(startRung);
    setAsked(q ? [q.q] : []);
    setCurrentQ(q);
    setQuizIdx(0);
    setStep("quiz");
  };

  const answer = (i) => {
    if (!currentQ) return;
    setPicked(i);
    setTimeout(() => {
      const correct = i === currentQ.correct;
      const nextIdx = quizIdx + 1;
      if (nextIdx >= QUIZ_LENGTH) {
        // Fin de la escalera: el rung final ES el CEFR real del usuario.
        setFinalCefr(rung);
        setFinalLevel(rung); // retro-compat: el bloque del header usa rungs CEFR
        setStep("result");
        setPicked(null);
        return;
      }
      // Adaptativo: correcto → sube de rung, error → baja.
      const nextR = nextRung(rung, correct);
      const q = pickQuizQuestion(nextR, asked);
      setRung(nextR);
      setAsked((a) => (q ? [...a, q.q] : a));
      setCurrentQ(q);
      setQuizIdx(nextIdx);
      setPicked(null);
    }, 350);
  };

  const toggleInterest = (p) => {
    setInterests((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  };

  // Indicador de progreso de pasos (1..4)
  const ProgressDots = () => (
    <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 2 }}>
      {[1, 2, 3, 4].map((n) => (
        <span key={n} style={{
          width: n === stepNum ? 18 : 7, height: 7, borderRadius: 4,
          background: n === stepNum ? "#6FBF8B" : n < stepNum ? "#3d504f" : "#2a343c",
          transition: "all 0.25s ease",
        }} />
      ))}
    </div>
  );

  return (
    <div style={styles.app}>
      <div style={styles.onboardWrap}>
        <Sprout size={30} color="#6FBF8B" strokeWidth={1.4} />
        <h1 style={styles.title}>Roots</h1>
        <ProgressDots />
        <p style={{ ...styles.formHint, marginTop: 2 }}>{t("Paso")} {stepNum} {t("de 4")} — {stepNum === 4 ? t("Nivel") : t(STEP_TITLES[step])}</p>

        {/* ── Paso 1: Perfil general (nombre, edad, género) ── */}
        {step === "profile" && (
          <>
            <p style={styles.sectionBody}>{t("¡Hola! Cuéntanos un poco sobre ti (tu nombre es lo único obligatorio).")}</p>
            <label style={styles.label}>{t("Nombre o apodo *")}</label>
            <input style={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Nombre o apodo *") === "Nombre o apodo *" ? "e.g. Alex, Sam" : t("Nombre o apodo *")} autoComplete="given-name" />
            <label style={styles.label}>{t("Edad")}</label>
            <input style={styles.input} type="number" min={5} max={99} value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 24" />
            <label style={styles.label}>{t("Género")}</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["Femenino", "Masculino", "No binario", "Prefiero no decirlo"].map((g) => (
                <button key={g} style={gender === g ? styles.patternChipActive : styles.patternChip} onClick={() => setGender(g)}>{g}</button>
              ))}
            </div>
            <button style={styles.learnBtn} disabled={!profileValid} onClick={() => setStep("languages")}>
              Continuar <ChevronRight size={16} />
            </button>
          </>
        )}

        {/* ── Paso 2: Idiomas (nativo + objetivo) ── */}
        {step === "languages" && (
          <>
            <p style={styles.sectionBody}>{t("¿Qué idioma hablas y cuál quieres aprender?")}</p>
            <label style={styles.label}>{t("Idioma nativo")}</label>
            <select style={styles.input} value={nativeLanguage} onChange={(e) => { setNativeLanguage(e.target.value); onNativeLangChange?.(e.target.value); }}>
              <option value="es">{languageLabel("es")}</option>
              <option value="en">{languageLabel("en")}</option>
              <option value="fr">{languageLabel("fr")}</option>
              <option value="de">{languageLabel("de")}</option>
              <option value="pt">{languageLabel("pt")}</option>
            </select>
            <label style={styles.label}>{t("Idioma objetivo (a aprender)")}</label>
            <select style={styles.input} value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)}>
              <option value="en">{languageLabel("en")} ({t("recomendado")})</option>
              <option value="fr">{languageLabel("fr")}</option>
              <option value="de">{languageLabel("de")}</option>
              <option value="pt">{languageLabel("pt")}</option>
            </select>
            <p style={styles.formHint}>{t("Por ahora el contenido está optimizado para inglés — los demás idiomas llegarán pronto.")}</p>
            <button style={styles.learnBtn} onClick={() => setStep("interests")}>
              Continuar <ChevronRight size={16} />
            </button>
            <button style={styles.tab} onClick={() => setStep("profile")}>{t("Atrás")}</button>
          </>
        )}

        {/* ── Paso 3: Intereses y objetivos (multi-selección) ── */}
        {step === "interests" && (
          <>
            <p style={styles.sectionBody}>{t("Elige tus gustos — la IA los usa para recomendarte vocabulario útil. (Opcional, puedes elegir varios.)")}</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              {PRESET_INTERESTS.map((p) => (
                <button key={p} style={interests.includes(p) ? styles.patternChipActive : styles.patternChip} onClick={() => toggleInterest(p)}>{t(p)}</button>
              ))}
            </div>
            <label style={styles.label}>{t("¿Algún objetivo personal? (trabajo, estudios, viaje…)")}</label>
            <input
              style={styles.input}
              value={interests.includes("__job__") ? "" : undefined}
              onChange={() => {}}
              placeholder="e.g. aprobar un examen, trabajar en tech"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.target.value.trim()) {
                  const v = e.target.value.trim();
                  setInterests((cur) => (cur.includes(v) ? cur : [...cur, v]));
                  e.target.value = "";
                }
              }}
            />
            <button style={styles.learnBtn} disabled={interests.length === 0} onClick={() => setStep("self")}>
              Continuar <ChevronRight size={16} />
            </button>
            <button style={styles.tab} onClick={() => setStep("languages")}>{t("Atrás")}</button>
          </>
        )}

        {/* ── Paso 4: Nivel y diagnóstico (test adaptativo o manual) ── */}
        {step === "self" && (
          <>
            <p style={styles.sectionBody}>{t("¿Cómo describirías tu nivel de inglés ahora?")}</p>
            {["beginner", "intermediate", "advanced"].map((lvl) => (
              <button key={lvl} style={styles.onboardOption} onClick={() => startQuiz(lvl)}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {lvl === "beginner" ? <Sprout size={15} color="#6FBF8B" /> : lvl === "intermediate" ? <Waves size={15} color="#D9A441" /> : <Layers size={15} color="#8CC9D9" />}
                  {lvl === "beginner" ? t("Beginner — just starting out") : lvl === "intermediate" ? t("Intermediate — I get by") : t("Advanced — pretty comfortable")}
                </span>
              </button>
            ))}
            <p style={{ ...styles.formHint, marginTop: 8 }}>{t("O responde el test adaptativo de 5 preguntas — o elige tu nivel manualmente después.")}</p>
            <button style={styles.tab} onClick={() => setStep("interests")}>{t("Atrás")}</button>
          </>
        )}

        {step === "quiz" && (
          <>
            <p style={styles.formHint}>{t("Nivelación adaptativa — pregunta")} {quizIdx + 1} {t("of")} {QUIZ_LENGTH} · {t("nivel")} {rung}</p>
            <p style={styles.sectionBody}>{quizQuestionText(currentQ, uiLang)}</p>
            {(currentQ?.options || []).map((opt, i) => (
              <button
                key={i}
                style={picked === i ? styles.onboardOptionPicked : styles.onboardOption}
                onClick={() => picked === null && answer(i)}
              >
                {opt}
              </button>
            ))}
          </>
        )}

        {step === "result" && (
          <>
            <p style={styles.sectionBody}>
              {t("Based on the quiz, you're at")} <b>{finalCefr || finalLevel}</b>
            </p>
            <p style={styles.formHint}>
              {["A1", "A2"].includes(finalCefr)
                ? t("Spanish translations will show by default — you can turn them off anytime.")
                : ["B1", "B2"].includes(finalCefr)
                ? t("Translations will be hidden but one tap away when you need them.")
                : t("The app will stay 100% English — no translations shown.")}
            </p>
            <label style={styles.label}>{t("Not right? Pick your sub-level manually:")}</label>
            {CEFR_ORDER.map((c) => (
              <button
                key={c}
                style={(finalCefr || finalLevel) === c ? styles.onboardOptionPicked : styles.onboardOption}
                onClick={() => { setFinalCefr(c); setFinalLevel(c); }}
              >
                {c}
              </button>
            ))}
            <button style={styles.learnBtn} onClick={() => setStep("done")}>
              Continue <ChevronRight size={16} />
            </button>
          </>
        )}

        {step === "done" && (() => {
          // Fin del flujo: onFinish con el perfil completo (paso 1-4)
          const interestsFinal = [...interests.filter((i) => i !== "__job__")];
          const jobText = interestsFinal.filter((i) => !PRESET_INTERESTS.some((p) => p.toLowerCase() === i.toLowerCase())).join(", ");
          return (
            <>
              <p style={styles.sectionBody}>
                ¡Listo, {name.trim() || "listo"}! Tu nivel: <b>{finalCefr || finalLevel}</b> · objetivo: <b>{targetLanguage === "en" ? "Inglés" : targetLanguage}</b>
              </p>
              <button
                style={styles.learnBtn}
                onClick={() => onFinish(finalLevel, finalCefr, {
                  name: name.trim(),
                  age: age ? Number(age) : null,
                  gender: gender || null,
                  native_language: nativeLanguage,
                  interests: interestsFinal,
                  job: jobText,
                }, targetLanguage)}
              >
                Empezar a aprender <ChevronRight size={16} />
              </button>
            </>
          );
        })()}
      </div>
    </div>
  );
}

