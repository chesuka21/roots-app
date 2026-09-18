// Vercel serverless — diagnóstico de latencia. Golpea los 3 providers en
// paralelo (1 token cada uno) y devuelve tiempos reales, para ver dónde se
// atora la app: si en el modelo o en la red/Vercel.
async function t0fetch(url, options, ms = 9000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { ...options, signal: c.signal }); }
  finally { clearTimeout(t); }
}

export default async function handler(req, res) {
  const t0 = Date.now();
  const out = {};

  // Groq — 1 token
  if (process.env.GROQ_API_KEY) {
    const t = Date.now();
    try {
      await t0fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({ model: "openai/gpt-oss-20b", messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
      });
      out.groq_ms = Date.now() - t;
    } catch (e) { out.groq_error = e.message; }
  }

  // OpenRouter — 1 token
  if (process.env.OPENROUTER_API_KEY) {
    const t = Date.now();
    try {
      await t0fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
        body: JSON.stringify({ model: "z-ai/glm-5.2:free", messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
      });
      out.openrouter_ms = Date.now() - t;
    } catch (e) { out.openrouter_error = e.message; }
  }

  // Gemini — 1 token
  if (process.env.GEMINI_API_KEY) {
    const t = Date.now();
    try {
      await t0fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "hi" }] }], generationConfig: { maxOutputTokens: 1 } }),
      });
      out.gemini_ms = Date.now() - t;
    } catch (e) { out.gemini_error = e.message; }
  }
  out.total_ms = Date.now() - t0;
  res.status(200).json(out);
}
