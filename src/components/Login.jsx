/* ---------- Login UI — Supabase Auth (Google OAuth) ----------
   Pantalla previa al onboarding. Si la nube está apagada (sin credenciales),
   el botón de "continuar sin cuenta" permite usar la app 100% offline.
   El login NUNCA bloquea: es opcional por diseño. */
import { useState } from "react";
import { Sprout, ChevronRight, Loader2, LogIn, CloudOff } from "lucide-react";
import { signInWithGoogle, isCloudEnabled, cloudDisabledReason } from "../lib/supabaseClient.js";

export default function Login({ onSkip, onDone, styles }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const cloud = isCloudEnabled();

  const handleGoogle = async () => {
    setBusy(true);
    setError("");
    try {
      await signInWithGoogle(); // redirige a Google y vuelve a /auth/callback
      // el redirect recarga la app; onDone se llama desde App al detectar la sesión
    } catch (e) {
      setError(`No pude iniciar sesión: ${e.message || e}`);
      setBusy(false);
    }
  };

  return (
    <div style={styles.app}>
      <div style={styles.onboardWrap}>
        <Sprout size={30} color="#6FBF8B" strokeWidth={1.4} />
        <h1 style={styles.title}>Roots</h1>
        <p style={styles.sectionBody}>
          Tu mapa de vocabulario, creciendo como raíces. Inicia sesión para guardarlo
          en la nube y continuar en cualquier dispositivo — o continúa sin cuenta.
        </p>

        {cloud ? (
          <button style={styles.learnBtn} onClick={handleGoogle} disabled={busy}>
            {busy ? <Loader2 size={16} className="spin" /> : <LogIn size={16} />}
            {busy ? "Conectando…" : "Continuar con Google"}
          </button>
        ) : (
          <div style={styles.lockedBox}>
            <div style={styles.lockedInner}>
              <CloudOff size={16} />
              <span>Login no disponible: {cloudDisabledReason()}</span>
            </div>
          </div>
        )}

        <button style={styles.tab} onClick={onSkip}>
          Continuar sin cuenta <ChevronRight size={13} style={{ verticalAlign: "-2px" }} />
        </button>

        {error && <p style={styles.genError}>{error}</p>}
        <p style={styles.formHint}>
          Sin cuenta, tu progreso se guarda solo en este navegador (localStorage).
        </p>
      </div>
    </div>
  );
}
