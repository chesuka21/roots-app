/* ---------- Language Gate — selector de idioma de interfaz AL INICIO DE TODO ----------
   Primera pantalla (antes del Login/Onboarding): el usuario elige su idioma
   nativo y la función t() reacciona AL INSTANTE — Login, Onboarding y toda
   la app aparecen en el idioma elegido. Se guarda en el estado (y en el
   perfil de Supabase via native_language) para no preguntar de nuevo. */
import { Sprout } from "lucide-react";
import { SUPPORTED_LANGUAGES, languageLabel } from "../data/translations.js";

export default function LanguageGate({ styles, current, onPick, onContinue }) {
  return (
    <div style={styles.app}>
      <div style={styles.onboardWrap}>
        <Sprout size={30} color="#6FBF8B" strokeWidth={1.4} />
        <h1 style={styles.title}>Roots</h1>
        <p style={styles.sectionBody}>
          {current === "fr"
            ? "Choisis ta langue pour commencer."
            : current === "de"
            ? "Wähle deine Sprache, um zu beginnen."
            : current === "pt"
            ? "Escolha seu idioma para começar."
            : current === "en"
            ? "Pick your language to begin."
            : "Elige tu idioma para empezar."}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
          {SUPPORTED_LANGUAGES.map((code) => (
            <button
              key={code}
              style={current === code ? styles.onboardOptionPicked : styles.onboardOption}
              onClick={() => onPick?.(code)}
            >
              {languageLabel(code)}
            </button>
          ))}
        </div>
        {current && (
          <button style={styles.learnBtn} onClick={onContinue}>
            {current === "fr" ? "Continuer" : current === "de" ? "Weiter" : current === "pt" ? "Continuar" : current === "en" ? "Continue" : "Continuar"}
          </button>
        )}
        <p style={styles.formHint}>
          {current === "fr"
            ? "Tu pourras la changer à tout moment dans les réglages."
            : current === "de"
            ? "Du kannst sie jederzeit in den Einstellungen ändern."
            : current === "pt"
            ? "Você pode mudá-la a qualquer momento nos ajustes."
            : current === "en"
            ? "You can change it anytime in Settings."
            : "Puedes cambiarla cuando quieras en Ajustes."}
        </p>
      </div>
    </div>
  );
}
