/* ---------- Login UI — Supabase Auth (Google OAuth + email/password) ----------
   Pantalla de login/registro tras el Language Gate. Dos vías: Google OAuth
   (redirect) o email+password (signUp / signInWithPassword). Si la nube está
   apagada (sin credenciales), "continuar sin cuenta" permite usar la app
   100% offline. El login NUNCA bloquea: es opcional por diseño.
   TODOS los textos de la interfaz viajan por `t` (native_language del gate). */
import { useState } from "react";
import { Sprout, ChevronRight, Loader2, LogIn, CloudOff, Mail, UserPlus } from "lucide-react";
import { signInWithGoogle, signInEmail, signUpEmail, isCloudEnabled, cloudDisabledReason } from "../lib/supabaseClient.js";

export default function Login({ onSkip, onDone, styles, t = (k) => k }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState("google"); // "google" | "email"
  const [isSignup, setIsSignup] = useState(false); // email: login vs registro
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const cloud = isCloudEnabled();

  const handleGoogle = async () => {
    setBusy(true);
    setError("");
    try {
      await signInWithGoogle(); // redirige a Google y vuelve a /auth/callback
      // el redirect recarga la app; onDone se llama desde App al detectar la sesión
    } catch (e) {
      setError(`${t("No pude iniciar sesión")}: ${e.message || e}`);
      setBusy(false);
    }
  };

  const handleEmail = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (isSignup) {
        const { needsConfirm } = await signUpEmail(email.trim(), password);
        if (needsConfirm) {
          setNotice(t("Cuenta creada — revisa tu correo para confirmarla y luego inicia sesión."));
          setIsSignup(false); // pasar a login tras confirmar
        } else {
          onDone?.(); // sesión inmediata
        }
      } else {
        await signInEmail(email.trim(), password);
        onDone?.(); // sesión lista — App la detecta con onAuthChange
      }
    } catch (e) {
      const msg = String(e.message || e);
      // credenciales inválidas en login → sugerir registro (primera vez)
      if (!isSignup && /invalid login credentials|user not found/i.test(msg)) {
        setError(t("No hay cuenta con ese email — crea una abajo."));
      } else {
        setError(`${t("No pude iniciar sesión")}: ${msg}`);
      }
      setBusy(false);
    }
  };

  return (
    <div style={styles.app}>
      <div style={styles.onboardWrap}>
        <Sprout size={30} color="#6FBF8B" strokeWidth={1.4} />
        <h1 style={styles.title}>Roots</h1>
        <p style={styles.sectionBody}>
          {t("Tu mapa de vocabulario, creciendo como raíces. Inicia sesión para guardarlo en la nube y continuar en cualquier dispositivo — o continúa sin cuenta.")}
        </p>

        {cloud ? (
          <>
            {mode === "google" ? (
              <>
                <button style={styles.learnBtn} onClick={handleGoogle} disabled={busy}>
                  {busy ? <Loader2 size={16} className="spin" /> : <LogIn size={16} />}
                  {busy ? t("Conectando…") : t("Continuar con Google")}
                </button>
                <button style={styles.tab} onClick={() => setMode("email")}>
                  <Mail size={13} style={{ verticalAlign: "-2px" }} /> {t("Usar email y contraseña")}
                </button>
              </>
            ) : (
              <>
                <p style={styles.formHint}>{isSignup ? t("Crea tu cuenta (email + contraseña):") : t("Inicia sesión con tu email:")}</p>
                <input
                  style={styles.input}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  autoComplete="email"
                  disabled={busy}
                />
                <input
                  style={styles.input}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("contraseña (mín. 6 caracteres)")}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  onKeyDown={(e) => { if (e.key === "Enter" && !busy) handleEmail(); }}
                  disabled={busy}
                />
                <button style={styles.learnBtn} onClick={handleEmail} disabled={busy || !email.trim() || !password}>
                  {busy ? <Loader2 size={16} className="spin" /> : isSignup ? <UserPlus size={16} /> : <LogIn size={16} />}
                  {busy ? t("Conectando…") : isSignup ? t("Crear cuenta") : t("Iniciar sesión")}
                </button>
                <button style={styles.tab} onClick={() => { setIsSignup(!isSignup); setError(""); setNotice(""); }}>
                  {isSignup ? t("Ya tengo cuenta — iniciar sesión") : <><UserPlus size={13} style={{ verticalAlign: "-2px" }} /> {t("No tengo cuenta — crear una")}</>}
                </button>
                <button style={styles.tab} onClick={() => { setMode("google"); setError(""); setNotice(""); }}>
                  ← {t("Volver a Google")}
                </button>
              </>
            )}
          </>
        ) : (
          <div style={styles.lockedBox}>
            <div style={styles.lockedInner}>
              <CloudOff size={16} />
              <span>{t("Login no disponible")}: {cloudDisabledReason()}</span>
            </div>
          </div>
        )}

        <button style={styles.tab} onClick={onSkip}>
          {t("Continuar sin cuenta")} <ChevronRight size={13} style={{ verticalAlign: "-2px" }} />
        </button>

        {notice && <p style={{ ...styles.formHint, color: "#6FBF8B" }}>{notice}</p>}
        {error && <p style={styles.genError}>{error}</p>}
        <p style={styles.formHint}>
          {t("Sin cuenta, tu progreso se guarda solo en este navegador (localStorage).")}
        </p>
      </div>
    </div>
  );
}
