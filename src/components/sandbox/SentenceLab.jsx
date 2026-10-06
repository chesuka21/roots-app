/* ---------- Sentence Lab — playground de práctica libre ----------
   Escribe oraciones libres y recibe: a) corrección gramatical, b) formas
   más naturales/nativas de decirlo, c) explicación breve EN SU idioma nativo.
   100% vía Gemini (server-side /api/claude) — sin reglas locales roídas. */
import { useState } from "react";
import { FlaskConical, Loader2, Sparkles, Check, ChevronRight } from "lucide-react";
import { translate } from "../../data/translations.js";
import { callClaudeJson } from "../../lib/ai.js";

export default function SentenceLab({ styles, uiLang = "es", targetLanguage = "en" }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const t = (k) => translate(k, uiLang);
  const nativeName = { es: "Español", en: "English", fr: "Français", de: "Deutsch", pt: "Português" }[uiLang] || "Spanish";

  const check = async () => {
    const sentence = text.trim();
    if (!sentence) return;
    setBusy(true);
    setResult(null);
    const prompt = `An English learner wrote this sentence freely (they are at any level): "${sentence}".

Return ONLY valid JSON, no markdown fences:
{"correct": true or false, "corrected": "...", "natural": "...", "note": "..."}

Rules:
- "correct": true if the sentence is already natural and grammatically fine as written.
- "corrected": the most natural, correct version of THEIR sentence (keep their meaning; repeat unchanged if already correct).
- "natural": a more native-sounding way to say the same idea, if one exists (slightly more idiomatic); otherwise repeat "corrected".
- "note": brief, encouraging feedback in ${nativeName} (the learner's native language) — 1-2 short sentences explaining the key fix or confirming it was already correct. Example format: "Good! 'I like...' would need the -ing form: 'I like walking.' Keep it up!" — but written entirely in ${nativeName}.
- Use neutral generic names in examples only when needed (Alex, Sam, Jordan) or pronouns — NEVER the learner's real name or nickname.
- Never use double-quote characters (") inside any value — use single quotes (') instead.`;
    try {
      const res = await callClaudeJson(prompt, 400);
      setResult(res);
    } catch (e) {
      setResult({ correct: false, corrected: sentence, natural: sentence, note: `No pude corregirlo ahora: ${e.message || e}` });
    }
    setBusy(false);
  };

  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>
        <FlaskConical size={18} color="#9fd9b8" style={{ verticalAlign: "-3px", marginRight: 7 }} />
        {t("Sentence Lab")}
      </h2>
      <p style={styles.sectionBody}>
        {t("Escribe cualquier oración libre en inglés — te la corrijo, la hago más natural y te explico el ajuste en tu idioma.")}
      </p>
      <input
        style={styles.input}
        value={text}
        onChange={(e) => { setText(e.target.value); setResult(null); }}
        placeholder={t("Escribe tu oración libre…")}
        onKeyDown={(e) => { if (e.key === "Enter") check(); }}
        disabled={busy}
      />
      <button style={styles.genBtn} onClick={check} disabled={busy || !text.trim()}>
        {busy ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
        {busy ? t("Evaluando…") : t("Check my sentence")}
      </button>
      {result && (
        <div style={styles.exampleBox}>
          {result.correct ? (
            <p style={{ ...styles.exampleEn, color: "#6FBF8B" }}>✓ {t("Suena natural.")}</p>
          ) : (
            <>
              <p style={{ ...styles.exampleEn, marginBottom: 4 }}>{result.corrected}</p>
              {result.natural && result.natural !== result.corrected && (
                <p style={{ ...styles.exampleEn, fontSize: 13.5, color: "#8CC9D9" }}>
                  {t("Más natural:")} {result.natural}
                </p>
              )}
            </>
          )}
          <p style={styles.bridgeNote}>{result.note}</p>
          {result.correct || result.corrected ? (
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <button style={styles.learnBtnRowBtn} onClick={() => { setText(""); setResult(null); }}>
                {t("Next exercise")} <ChevronRight size={15} />
              </button>
            </div>
          ) : null}
        </div>
      )}
      <p style={styles.formHint}>{t("Las oraciones que practicas aquí también entran al mapa si tocas la palabra que añades.")}</p>
    </div>
  );
}
