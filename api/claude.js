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
  const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
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
    25000
  );
  const data = await r.json();
  if (!r.ok) {
    const err = new Error(data?.error?.message || `Groq error ${r.status}`);
    err.status = r.status;
    err.data = data;
    throw err;
  }
  return data?.choices?.[0]?.message?.content || "";
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  try {
    const text = await callGemini(prompt);
    return res.status(200).json({ content: [{ type: "text", text }] });
  } catch (geminiErr) {
    console.error("Gemini failed, trying Groq fallback:", geminiErr.message);
    if (!process.env.GROQ_API_KEY) {
      return res.status(geminiErr.status || 500).json(geminiErr.data || { error: { message: geminiErr.message } });
    }
    try {
      const text = await callGroq(prompt);
      return res.status(200).json({ content: [{ type: "text", text }] });
    } catch (groqErr) {
      console.error("Groq fallback also failed:", groqErr.message);
      return res.status(502).json({ error: { message: `Both providers failed. Gemini: ${geminiErr.message} — Groq: ${groqErr.message}` } });
    }
  }
}
