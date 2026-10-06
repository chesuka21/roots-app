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
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  s = s.replace(/,\s*([}\]])/g, "$1");
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  s = s.replace(/\n/g, " ");
  return s;
}

export function extractJson(text) {
  const t = String(text || "").trim();
  try { return JSON.parse(t); } catch (e) { /* intentar reparación abajo */ }
  try { return JSON.parse(repairJson(t)); } catch (e) { /* reintentar fuera */ }
  let s = repairJson(t);
  const braceCount = (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
  if (braceCount > 0) s += "}".repeat(braceCount);
  const bracketCount = (s.match(/\[/g) || []).length - (s.match(/\]/g) || []).length;
  if (bracketCount > 0) s += "]".repeat(bracketCount);
  try { return JSON.parse(s); } catch (e) { /* nada más que hacer */ }
  throw new Error("La IA devolvió un formato inválido — intenta de nuevo.");
}

const STRICT_JSON = `\n\nSTRICT OUTPUT RULES: respond with ONLY valid JSON (no markdown, no commentary). Never put double-quote characters (") inside any string value — use single quotes (') if you must quote a word. Close every bracket and brace.`;

// Llamada JSON con fallback multi-proveedor (Groq → OpenRouter → Gemini)
export async function callClaudeJson(prompt, max_tokens) {
  try {
    return extractJson(await callClaude(prompt, max_tokens));
  } catch (e1) {
    try {
      return extractJson(await callClaude(prompt + STRICT_JSON, max_tokens, 1, true));
    } catch (e2) {
      try {
        return extractJson(await callClaude(prompt + STRICT_JSON, max_tokens, 1, true, "gemini"));
      } catch (e3) {
        if (/quota|429|resource/i.test(e3.message)) return extractJson(await callClaude(prompt + STRICT_JSON, max_tokens, 1, true, "openrouter"));
        throw e3;
      }
    }
  }
}
