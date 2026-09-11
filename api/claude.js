// Vercel serverless — proxy rápido de IA.
// FIX v2 (velocidad): Groq 8B primero (responde en 0.6-2s), JSON mode,
// timeouts cortos para no chocar con el límite de 10s de Vercel Hobby.
// Gemini solo como fallback si Groq falla. La ruta sigue siendo
// /api/claude para no tocar el cliente.

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
  // NOTA: llama-3.3-70b-versatile daba errores de tokens/límites en el pasado,
  // por eso 8b-instant va primero ahora.
  const candidates = [
    process.env.GROQ_MODEL,
    "llama-3.1-8b-instant",
    "llama-3.3-70b-versatile",
  ].filter(Boolean);

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
        8000 // 8s: si no respondió, el modelo está caído — pasar al siguiente
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
    8000
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

  const t0 = Date.now();
  const ok = (text, provider) => {
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
