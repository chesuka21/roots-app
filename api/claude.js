// Vercel serverless function — proxies AI requests to Google Gemini first,
// falling back to Groq automatically if Gemini errors or times out (its
// free tier gets congested sometimes). Neither key ever reaches the
// browser. Route is still called /api/claude to match the existing client
// code; both providers' replies get reshaped into the same
// {content:[{type:"text", text}]} format so nothing else has to change.

async function withTimeout(promise, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await promise(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(prompt) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  const r = await withTimeout(
    (signal) =>
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          signal,
        }
      ),
    25000
  );
  const data = await r.json();
  if (!r.ok) {
    const err = new Error(data?.error?.message || `Gemini error ${r.status}`);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  const text = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text).join("");
  return text;
}

async function callGroq(prompt) {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set");
  // Groq's lineup changes over time and a hardcoded name can go stale, so try
  // a short list of currently-common models in order instead of betting on
  // just one. GROQ_MODEL (if set) always goes first.
  const candidates = [
    process.env.GROQ_MODEL,
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
    "gemma2-9b-it",
  ].filter(Boolean);

  let lastErr;
  for (const model of candidates) {
    try {
      const r = await withTimeout(
        (signal) =>
          fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }] }),
            signal,
          }),
        20000
      );
      const data = await r.json();
      if (!r.ok) {
        lastErr = new Error(data?.error?.message || `Groq error ${r.status} (model: ${model})`);
        continue; // try the next candidate model
      }
      return data?.choices?.[0]?.message?.content || "";
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("No Groq model candidates worked");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  // Groq's free tier is much faster than Gemini's when Gemini is congested,
  // so it goes first whenever it's configured; Gemini is the fallback.
  const primary = process.env.GROQ_API_KEY ? callGroq : callGemini;
  const fallback = process.env.GROQ_API_KEY ? callGemini : callGroq;
  const primaryName = process.env.GROQ_API_KEY ? "Groq" : "Gemini";
  const fallbackName = process.env.GROQ_API_KEY ? "Gemini" : "Groq";

  try {
    const text = await primary(prompt);
    return res.status(200).json({ content: [{ type: "text", text }] });
  } catch (primaryErr) {
    console.error(`${primaryName} failed, trying ${fallbackName} fallback:`, primaryErr.message);
    try {
      const text = await fallback(prompt);
      return res.status(200).json({ content: [{ type: "text", text }] });
    } catch (fallbackErr) {
      console.error(`${fallbackName} fallback also failed:`, fallbackErr.message);
      return res.status(502).json({
        error: { message: `Both providers failed. ${primaryName}: ${primaryErr.message} — ${fallbackName}: ${fallbackErr.message}` },
      });
    }
  }
}
