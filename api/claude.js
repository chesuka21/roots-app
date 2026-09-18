// Vercel serverless — proxy rápido de IA.
// FIX v2 (velocidad): Groq 8B primero (responde en 0.6-2s), JSON mode,
// timeouts cortos para no chocar con el límite de 10s de Vercel Hobby.
// Gemini solo como fallback si Groq falla. La ruta sigue siendo
// /api/claude para no tocar el cliente.
//
// CACHÉ COMPARTIDA (ahorro de tokens): cada respuesta de la IA se guarda por
// hash del prompt en data/ai-cache.json (or "excel" del servidor). Si otro
// usuario pide lo mismo, se devuelve desde cache sin gastar un solo token.
// - En local / host persistente: se escribe en el repo (data/ai-cache.json).
// - En Vercel serverless (FS de solo lectura): cae a /tmp por instancia.
//   Para caché real compartida entre TODOS los usuarios en producción hace
//   falta un KV (p. ej. Upstash gratis): ver comentario al final.

import { createHash } from "crypto";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

const REPO_CACHE = path.join(process.cwd(), "data", "ai-cache.json");
const TMP_CACHE = "/tmp/roots-ai-cache.json";
const cacheKey = (p) => createHash("sha256").update(String(p)).digest("hex");

function loadCache() {
  const merged = {};
  for (const f of [REPO_CACHE, TMP_CACHE]) {
    try { if (existsSync(f)) Object.assign(merged, JSON.parse(readFileSync(f, "utf8"))); }
    catch { /* ignorar archivo corrupto */ }
  }
  return merged;
}
function persistCache(key, value) {
  // En Vercel prod el FS del repo es solo lectura → se va a /tmp (por instancia).
  // En local/host persistente → data/ai-cache.json (compartido real).
  const target = process.env.VERCEL ? TMP_CACHE : REPO_CACHE;
  try {
    const obj = loadCache();
    obj[key] = value;
    if (target === REPO_CACHE) mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(obj));
  } catch { /* sin permiso de escritura — la caché sigue funcionando de solo lectura */ }
}

async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function cleanJson(text) {
  return String(text || "").replace(/```json|```/g, "").trim();
}

async function callGroq(prompt, maxTokens) {
  // Orden: el más rápido y barato primero. GROQ_MODEL puede forzarlo desde Vercel.
  // IMPORTANTE (ago-2026): Groq retiró llama-3.1-8b-instant y llama-3.3-70b-versatile
  // el 16/08/2026. Los reemplazos oficiales son openai/gpt-oss-20b (8B) y
  // openai/gpt-oss-120b (70B). No uses los viejos: devuelven "does not exist".
  const candidates = [
      process.env.GROQ_MODEL,
      "openai/gpt-oss-20b",
      "openai/gpt-oss-120b",
    ]
      .filter(Boolean)
      // Filtra modelos retirados por Groq (ago-2026): si GROQ_MODEL quedó apuntando
      // a uno muerto, no malgastemos un request intentándolo.
      .filter((m) => !/llama-3\.1-8b-instant|llama-3\.3-70b-versatile|llama-4-scout-17b|qwen3-32b/i.test(m))
      // dedupe (por si GROQ_MODEL ya es uno de los defaults)
      .filter((m, i, arr) => arr.indexOf(m) === i);

  let lastErr;
  for (const model of candidates) {
    try {
      const r = await fetchWithTimeout(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2, // respuestas deterministas = menos tokens + más rápido
            max_tokens: Math.min(maxTokens || 400, 1200), // cap duro: tus prompts no necesitan más
            response_format: { type: "json_object" }, // Groq devuelve JSON directo, sin rodeos
          }),
        },
        9000 // 9s: justo bajo el límite de 10s de Vercel Hobby — da margen para responder
      );
      const data = await r.json();
      if (!r.ok) {
        lastErr = new Error(
          data?.error?.message || `Groq error ${r.status} (model: ${model})`
        );
        // 429 / rate-limit / decommissioned → probar siguiente modelo de una
        continue;
      }
      const text = data?.choices?.[0]?.message?.content || "";
      if (text) return cleanJson(text);
      lastErr = new Error(`Groq empty response (model: ${model})`);
    } catch (e) {
      lastErr = e.name === "AbortError" ? new Error("Groq timeout (8s)") : e;
    }
  }
  throw lastErr || new Error("No Groq model worked");
}

async function callGemini(prompt, maxTokens) {
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const r = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt + "\n\nReturn ONLY valid JSON." }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: Math.min(maxTokens || 400, 1200) },
      }),
    },
    9000 // Gemini también bajo el límite de Vercel Hobby
  );
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error?.message || `Gemini error ${r.status}`);
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text).join("");
  return cleanJson(text);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const { prompt, max_tokens, force } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });
  // `force`: "groq" | "gemini" — el frontend lo usa para reintentar un JSON
  // malformado con OTRO proveedor (piensa distinto y suele formatear mejor).
  if (force && force !== "groq" && force !== "gemini") {
      return res.status(400).json({ error: { message: `Unknown provider: ${force}` } });
    }

    // Caché compartida: si ya resolvimos este prompt, devolvemos la respuesta
    // guardada (0 tokens). Se omite en reintentos con proveedor forzado.
    const key = cacheKey(prompt);
    if (!force) {
      const hit = loadCache()[key];
      if (hit) {
        res.setHeader("X-AI-Cache", "hit");
        res.setHeader("X-AI-Ms", "0");
        return res.status(200).json({ content: [{ type: "text", text: hit }] });
      }
    }
    res.setHeader("X-AI-Cache", "miss");

    const t0 = Date.now();
    const ok = (text, provider) => {
      if (!force) persistCache(key, text);
      res.setHeader("X-AI-Provider", provider);
      res.setHeader("X-AI-Ms", String(Date.now() - t0));
      return res.status(200).json({ content: [{ type: "text", text }] });
    };
  const tryGroq = async () => ok(await callGroq(prompt, max_tokens), "groq");
  const tryGemini = async () => ok(await callGemini(prompt, max_tokens), "gemini");

  // Proveedor forzado: solo ese (usado en reintentos de JSON inválido)
  if (force === "groq") {
    if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: { message: "GROQ_API_KEY no configurada" } });
    try { return await tryGroq(); }
    catch (e) { return res.status(502).json({ error: { message: `Groq falló: ${e.message}` } }); }
  }
  if (force === "gemini") {
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: { message: "GEMINI_API_KEY no configurada (solo Groq disponible)" } });
    try { return await tryGemini(); }
    catch (e) { return res.status(502).json({ error: { message: e.message } }); }
  }

  // 1) Groq primero (rápido). 2) Gemini fallback solo si Groq falla.
  // Secuencial — no race con stagger, el race duplicaba consumo de tokens.
  if (process.env.GROQ_API_KEY) {
    try {
      return await tryGroq();
    } catch (e) {
      console.error("Groq failed, trying Gemini:", e.message);
      if (!process.env.GEMINI_API_KEY) {
        return res.status(502).json({ error: { message: `Groq falló: ${e.message}` } });
      }
    }
  }
  if (process.env.GEMINI_API_KEY) {
    try {
      return await tryGemini();
    } catch (e) {
      console.error("Gemini failed:", e.message);
      return res.status(502).json({ error: { message: e.message } });
    }
  }
  return res.status(500).json({ error: { message: "No AI provider configured (GROQ_API_KEY / GEMINI_API_KEY)" } });
}
