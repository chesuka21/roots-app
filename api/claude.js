// Vercel serverless function — proxies AI requests, racing multiple
// providers instead of trying them one after another. Whichever key(s) you
// set (GROQ_API_KEY, GEMINI_API_KEY) are used automatically; more can be
// added later by adding another entry to PROVIDERS below. Neither key ever
// reaches the browser. Route is still called /api/claude to match the
// existing client code; every provider's reply gets reshaped into the same
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
  if (!r.ok) throw new Error(data?.error?.message || `Gemini error ${r.status}`);
  return (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text).join("");
}

async function callGroq(prompt) {
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
        continue;
      }
      return data?.choices?.[0]?.message?.content || "";
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("No Groq model candidates worked");
}

// Add more providers here later — just give each a name, an env var that
// must be set for it to be considered, and its call function.
const PROVIDERS = [
  { name: "Groq", envKey: "GROQ_API_KEY", fn: callGroq },
  { name: "Gemini", envKey: "GEMINI_API_KEY", fn: callGemini },
].filter((p) => !!process.env[p.envKey]);

// Races all configured providers. The fastest one goes immediately; any
// others start automatically after `staggerMs` if the first hasn't answered
// yet, so a slow provider never blocks the others — first success wins.
function raceProviders(prompt, providers, staggerMs = 5000) {
  return new Promise((resolve, reject) => {
    if (providers.length === 0) {
      reject(new Error("No AI provider is configured (missing GROQ_API_KEY / GEMINI_API_KEY)"));
      return;
    }
    let settled = false;
    let pendingCount = providers.length;
    const errors = [];

    providers.forEach((p, i) => {
      setTimeout(() => {
        if (settled) return;
        p.fn(prompt)
          .then((text) => {
            if (!settled) {
              settled = true;
              resolve({ text, provider: p.name });
            }
          })
          .catch((e) => {
            errors.push(`${p.name}: ${e.message}`);
            pendingCount -= 1;
            if (pendingCount === 0 && !settled) {
              reject(new Error(errors.join(" — ")));
            }
          });
      }, i * staggerMs);
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { prompt } = req.body || {};
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  try {
    const { text, provider } = await raceProviders(prompt, PROVIDERS);
    res.setHeader("X-AI-Provider", provider); // handy for checking which one answered, via Network tab
    return res.status(200).json({ content: [{ type: "text", text }] });
  } catch (e) {
    console.error("All providers failed:", e.message);
    return res.status(502).json({ error: { message: e.message } });
  }
}
