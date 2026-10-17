/* ---------- Capa de servicio IA (Gemini via serverless) ----------
   Servicio ÚNICO para las llamadas a Gemini: cache, reparación de JSON,
   reintento multi-proveedor. Separado del render (Clean Architecture). */

const AI_CACHE_KEY = "roots-ai-cache-v2"; // v2: la v1 se envenenó con respuestas truncadas
const aiMemCache = new Map();
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function aiCacheKey(prompt) { return `${hashStr(prompt)}:${prompt.length}`; }
function aiCacheGet(prompt) {
  const key = aiCacheKey(prompt);
  if (aiMemCache.has(key)) return aiMemCache.get(key);
  try {
    const raw = localStorage.getItem(AI_CACHE_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj && obj[key]) {
        aiMemCache.set(key, obj[key]);
        return obj[key];
      }
    }
  } catch (e) { /* sin cache — seguir a red */ }
  return null;
}
function aiCacheSet(prompt, value) {
  const key = aiCacheKey(prompt);
  aiMemCache.set(key, value);
  try {
    const raw = localStorage.getItem(AI_CACHE_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    obj[key] = value;
    const keys = Object.keys(obj);
    if (keys.length > 200) delete obj[keys[0]];
    localStorage.setItem(AI_CACHE_KEY, JSON.stringify(obj));
  } catch (e) { /* storage lleno — ignorar */ }
}

async function callClaude(prompt, max_tokens, attempt = 1, skipCache = false, force = null) {
  const ck = force ? `${prompt}|force:${force}` : prompt;
  const hit = skipCache ? null : aiCacheGet(ck);
  if (hit) return hit;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  let response;
  try {
    response = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, max_tokens: Math.min(max_tokens || 400, 1200), ...(force ? { force } : {}) }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") throw new Error("La IA tardó demasiado (>25s) — intenta de nuevo.");
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 800)); // reintento rápido si falla la red
      return callClaude(prompt, max_tokens, attempt + 1, skipCache, force);
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const msg = data?.error?.message || data?.error || `AI request failed (${response.status})`;
    throw new Error(msg);
  }
  if (!data) throw new Error("El servidor no respondió JSON — revisa tu conexión o el deploy.");
  const text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  const clean = text.replace(/```json|```/g, "").trim();
  if (!skipCache) aiCacheSet(ck, clean);
  return clean;
}

function repairJson(t) {
  let s = String(t || "").replace(/```json|```/g, "").trim();
  // Sanitizador principal: extraer el primer objeto/array JSON balanceado del texto.
  // La IA suele envolver el JSON en prosa ("Here is the JSON: {...}") — el match
  // regex lo recupera aunque haya texto antes/después o fences sueltos.
  const jsonMatch = s.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch) s = jsonMatch[0];
  else {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) s = s.slice(start, end + 1);
  }
  s = s.replace(/,\s*([}\]])/g, "$1"); // comas colgantes
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""); // controles literales
  s = s.replace(/\n/g, " "); // saltos de línea literales dentro de strings
  return s;
}

export function extractJson(text) {
  const t = String(text || "").trim();
  try { return JSON.parse(t); } catch (e) { /* intentar reparación abajo */ }
  try { return JSON.parse(repairJson(t)); } catch (e) { /* reintentar fuera */ }
  // último intento: arreglo brackets/braces desbalanceados (la IA a veces no los cierra)
  let s = repairJson(t);
  // strings abiertos: si quedó un string sin cerrar (respuesta cortada a mitad),
  // lo cerramos antes de balancear llaves — {"list": ["x", "y  →  {"list": ["x", "y"]}
  const quoteCount = (s.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 === 1) s += '"';
  const braceCount = (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
  if (braceCount > 0) s += "}".repeat(braceCount);
  const bracketCount = (s.match(/\[/g) || []).length - (s.match(/\]/g) || []).length;
  if (bracketCount > 0) s += "]".repeat(bracketCount);
  try { return JSON.parse(s); } catch (e) { /* nada más que hacer */ }
  // variante: cerrar en orden inverso (strings → brackets → braces)
  let s2 = repairJson(t);
  if ((s2.match(/(?<!\\)"/g) || []).length % 2 === 1) s2 += '"';
  if (bracketCount > 0) s2 += "]".repeat(bracketCount);
  if (braceCount > 0) s2 += "}".repeat(braceCount);
  try { return JSON.parse(s2); } catch (e) { /* nada más que hacer */ }
  throw new Error("La IA devolvió un formato inválido — intenta de nuevo.");
}

const STRICT_JSON = `\n\nSTRICT OUTPUT RULES: respond with ONLY valid JSON (no markdown, no commentary). Never put double-quote characters (") inside any string value — use single quotes (') if you must quote a word. Close every bracket and brace.`;

// Llamada JSON con reintento automático (3 rondas × multi-proveedor).
// Nunca lanza el error crudo al usuario en el primer intento: cada fallo de
// parseo re-pide con regla estricta y/o proveedor distinto antes de rendirse.
export async function callClaudeJson(prompt, max_tokens) {
  let lastErr;
  for (let round = 0; round < 3; round++) {
    try {
      if (round === 0) return extractJson(await callClaude(prompt, max_tokens));
      if (round === 1) return extractJson(await callClaude(prompt + STRICT_JSON, max_tokens, 1, true));
      // ronda final: proveedor alternativo (Gemini formatea distinto y suele acertar)
      try {
        return extractJson(await callClaude(prompt + STRICT_JSON, max_tokens, 1, true, "gemini"));
      } catch (e3) {
        if (/quota|429|resource/i.test(e3.message)) {
          return extractJson(await callClaude(prompt + STRICT_JSON, max_tokens, 1, true, "openrouter"));
        }
        throw e3;
      }
    } catch (e) {
      lastErr = e;
      if (/quota|429/.test(e.message) && round < 2) await new Promise((r) => setTimeout(r, 600)); // pausa corta ante rate-limit
    }
  }
  throw lastErr || new Error("La IA devolvió un formato inválido — intenta de nuevo.");
}
