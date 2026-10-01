/* ---------- Capa de servicio Supabase (Auth + persistencia en la nube) ----------
   Cliente ÚNICO de la app. Se construye desde las variables VITE_ de entorno;
   si no hay URL configurada, la app funciona 100% offline (localStorage) —
   degradación elegante, nunca crashea.

   SEGURIDAD:
   - Solo la anon/publishable key (sb_publishable_…) va al cliente. Con RLS
     activo (ver supabase/schema.sql) cada usuario solo lee/escribe SU data.
   - La secret key (sb_secret_…) es SOLO server-side: nunca VITE_, nunca en el
     bundle público. Si se expuso en un chat/repo → ROTARLA en el dashboard. */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY || "";

// URL de redirect para OAuth: en producción la app despliega en Vercel; en
// dev, localhost. Deben estar permitidas en Dashboard → Authentication → URL Configuration.
export const AUTH_REDIRECT_URL =
  typeof window !== "undefined" && /localhost|127\.0\.0\.1/.test(window.location.origin)
    ? `${window.location.origin}/auth/callback`
    : "https://roots-app-gamma.vercel.app";

// null si no hay credenciales — todos los callers verifican isCloudEnabled()
export const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;

export function isCloudEnabled() {
  return !!supabase;
}

// Motivo por el que la nube está apagada (para mostrar en Ajustes)
export function cloudDisabledReason() {
  if (!SUPABASE_URL && !SUPABASE_KEY) return "Falta VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el entorno.";
  if (!SUPABASE_URL) return "Falta VITE_SUPABASE_URL (Project URL, formato https://<ref>.supabase.co).";
  if (!SUPABASE_KEY) return "Falta VITE_SUPABASE_ANON_KEY (anon/publishable key).";
  return null;
}

/* ---------- Google OAuth ---------- */
// Redirige al consent screen de Google; vuelve a AUTH_REDIRECT_URL con la sesión.
export async function signInWithGoogle() {
  if (!supabase) throw new Error(cloudDisabledReason() || "Supabase no configurado.");
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: AUTH_REDIRECT_URL },
  });
  if (error) throw error;
}

/* ---------- Email + password (alternativa a Google OAuth) ---------- */
// Registro: crea el usuario (el trigger handle_new_user auto-crea su profile).
// Si "Confirm email" está activo en Supabase, session viene null y el usuario
// debe confirmar desde su correo — el caller lo comunica.
export async function signUpEmail(email, password) {
  if (!supabase) throw new Error(cloudDisabledReason() || "Supabase no configurado.");
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return { session: data?.session || null, user: data?.user || null, needsConfirm: !data?.session };
}

// Login con email+password ya registrado.
export async function signInEmail(email, password) {
  if (!supabase) throw new Error(cloudDisabledReason() || "Supabase no configurado.");
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { session: data?.session || null, user: data?.user || null };
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

/* ---------- Sesión actual (null si no hay) ---------- */
export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session || null;
}

// Suscripción a cambios de sesión (login OAuth, logout, refresh de token).
// Devuelve { subscription } para unsubscribe; null sin nube.
export function onAuthChange(cb) {
  if (!supabase) return { data: { subscription: null } };
  return supabase.auth.onAuthStateChange((event, session) => cb(event, session));
}

/* ---------- Sincronización del mapa mental / SRS / racha ----------
   Esquema (supabase/schema.sql):
     profiles  — 1 fila por usuario: nivel, cefr, target_language, streak, progression
     words     — nodos de palabras del mapa (1 fila por palabra por usuario)
     edges     — aristas (conexiones word↔word y word↔pattern)
     srs_cards — estado de repetición espaciada por palabra
   Todo con RLS: user_id = auth.uid(). */
export async function pushProfile(userId, data) {
  if (!supabase) return;
  const row = {
    id: userId,
    level: data.level ?? null,
    cefr: data.cefr ?? null,
    target_language: data.targetLanguage ?? "en",
    streak: data.progression?.streak ?? null,
    progression: data.progression ?? null,
    onboarded: !!data.onboarded,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("profiles").upsert(row);
  if (error) throw error;
}

export async function pushWords(userId, nodes) {
  if (!supabase) return;
  const rows = Object.values(nodes || {})
    .filter((n) => n?.en)
    .map((n) => ({
      user_id: userId,
      word_id: n.id,
      en: n.en,
      def: n.def ?? "",
      def_es: n.defEs ?? "",
      cat: n.cat ?? "",
      pos: n.pos ?? null,
      kind: n.kind ?? "word",
      cefr: n.cefr ?? null,
      data: n, // documento completo (imágenes, ejemplos, etc.)
      updated_at: new Date().toISOString(),
    }));
  if (!rows.length) return;
  const { error } = await supabase.from("words").upsert(rows, { onConflict: "user_id,word_id" });
  if (error) throw error;
}

export async function pushEdges(userId, edges) {
  if (!supabase) return;
  const rows = (edges || []).slice(0, 2000).map((e, i) => ({
    user_id: userId,
    edge_key: `${e.source}::${e.target}::${e.rel || "link"}::${i}`,
    source: e.source,
    target: e.target,
    rel: e.rel ?? "link",
    sentence: e.sentence ?? "",
    weight: e.weight ?? 0.5,
    updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return;
  const { error } = await supabase.from("edges").upsert(rows, { onConflict: "user_id,edge_key" });
  if (error) throw error;
}

export async function pushSrsCards(userId, srs) {
  if (!supabase) return;
  const rows = Object.entries(srs || {}).map(([key, c]) => ({
    user_id: userId,
    card_key: key,
    interval: c.interval ?? 1,
    ease: c.ease ?? 2.5,
    reps: c.reps ?? 0,
    due: new Date(c.due ?? Date.now()).toISOString(),
    payload: c,
    updated_at: new Date().toISOString(),
  }));
  if (!rows.length) return;
  const { error } = await supabase.from("srs_cards").upsert(rows, { onConflict: "user_id,card_key" });
  if (error) throw error;
}

// Sincronización completa (llamada tras cambios grandes: onboarding, practice, save word)
export async function syncAllToCloud(userId, data) {
  if (!supabase) return;
  await pushProfile(userId, data);
  await pushWords(userId, data.nodes);
  await pushEdges(userId, data.edges);
  await pushSrsCards(userId, data.srs);
  await pushSrsCards(userId, data.patternSrs);
}

// Descarga la nube → data local (al iniciar sesión en un dispositivo nuevo)
export async function pullAllFromCloud(userId) {
  if (!supabase) return null;
  const out = { words: [], edges: [], srs: {}, profiles: null };
  const [prof, w, e, s] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("words").select("*").eq("user_id", userId),
    supabase.from("edges").select("*").eq("user_id", userId),
    supabase.from("srs_cards").select("*").eq("user_id", userId),
  ]);
  out.profiles = prof.data || null;
  out.words = w.data || [];
  out.edges = e.data || [];
  for (const row of s.data || []) out.srs[row.card_key] = row.payload || { interval: row.interval, ease: row.ease, reps: row.reps, due: new Date(row.due).getTime() };
  return out;
}
