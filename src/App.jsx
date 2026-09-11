import { useState, useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { Sprout, X, Check, ChevronRight, Plus, Sparkles, Loader2, Layers, BookOpen, Utensils, Smile, Briefcase, TreePine, Shapes, Volume2, Pencil, Trash2 } from "lucide-react";

/* ---------- AI + image helpers — call our own /api/* serverless
   functions (see /api/claude.js and /api/pexels.js) so the Groq/Gemini and
   Unsplash API keys stay on the server and never reach the browser. ---------- */
/* Cache de respuestas IA en memoria + localStorage: si ya pediste "deadline",
   no se gasta otro request ni otros tokens. Clave para velocidad y costo. */
const AI_CACHE_KEY = "roots-ai-cache-v1";
const aiMemCache = new Map();
function aiCacheGet(key) {
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
function aiCacheSet(key, value) {
  aiMemCache.set(key, value);
  try {
    const raw = localStorage.getItem(AI_CACHE_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    obj[key] = value;
    // cap simple: max ~200 entradas para no llenar localStorage
    const keys = Object.keys(obj);
    if (keys.length > 200) delete obj[keys[0]];
    localStorage.setItem(AI_CACHE_KEY, JSON.stringify(obj));
  } catch (e) { /* storage lleno — ignorar */ }
}
async function callClaude(prompt, max_tokens, attempt = 1) {
  // v2 velocidad: backend responde en <8s (límite Vercel Hobby 10s).
  // Un solo reintento rápido en error de red; sin esperas de 45s ni 3 reintentos.
  const cacheKey = prompt.slice(0, 200);
  const hit = aiCacheGet(cacheKey);
  if (hit) return hit;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  let response;
  try {
    response = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, max_tokens: Math.min(max_tokens || 400, 600) }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === "AbortError") throw new Error("La IA tardó demasiado (>12s) — intenta de nuevo.");
    // un solo reintento en fallo de red
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 800));
      return callClaude(prompt, max_tokens, attempt + 1);
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
  const data = await response.json();
  if (!response.ok) {
    const msg = data?.error?.message || data?.error || `AI request failed (${response.status})`;
    throw new Error(msg);
  }
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  const clean = text.replace(/```json|```/g, "").trim();
  aiCacheSet(cacheKey, clean);
  return clean;
}

const IMAGE_QUERY_STOPWORDS = new Set([
  "a", "an", "the", "to", "of", "when", "who", "that", "which", "with", "for", "and", "or",
  "is", "are", "was", "were", "in", "on", "at", "by", "from", "this", "it", "its", "you",
  "your", "their", "they", "he", "she", "we", "i", "do", "does", "did", "be", "been", "being",
  "have", "has", "had", "can", "could", "will", "would", "should", "not", "no", "so", "if",
  "as", "about", "into", "over", "after", "before", "between", "up", "down", "out", "than",
]);
function keywordsFromDefinition(definition, max = 4) {
  if (!definition) return "";
  return definition
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w && !IMAGE_QUERY_STOPWORDS.has(w))
    .slice(0, max)
    .join(" ");
}

async function findImages(word, category, definition) {
  // Search on more than the bare word so ambiguous or abstract words land on
  // the right sense — e.g. "meeting" alone could be anything, but "meeting
  // time people gather talk" (word + category + definition keywords) points
  // straight at the office/gathering meaning described in its definition.
  const parts = [word, category, keywordsFromDefinition(definition)].filter(Boolean);
  const query = parts.join(" ");
  try {
    const res = await fetch(`/api/pexels?q=${encodeURIComponent(query)}`);
    const data = await res.json();
    return data.images || [];
  } catch (e) {
    return [];
  }
}

async function analyzeIdiom(input) {
  const prompt = `Someone learning English is asking about an idiom or everyday expression. It might be in Spanish, English, or a mix. Their input:
"${input}"

Return ONLY valid JSON, no markdown fences, no extra text, in exactly this shape:
{"idiom": "...", "literal": "...", "meaning": "...", "meaningEs": "...", "spanishEquivalent": "..."}

Rules:
- "idiom": the natural English idiom or expression with the same meaning (e.g. "cost an arm and a leg").
- "literal": what "idiom" would mean word-for-word if translated literally into Spanish, to show why it sounds strange (e.g. "costar un brazo y una pierna"). Keep it short.
- "meaning": a simple English explanation of what the idiom actually means, under 16 words.
- "meaningEs": Spanish translation of that meaning.
- "spanishEquivalent": the natural Spanish idiom that expresses the same idea (e.g. "costar un ojo de la cara"), if a good one exists; otherwise an empty string.`;
  const clean = await callClaude(prompt, 400);
  return JSON.parse(clean);
}

let cachedVoice = null;
function pickBestVoice() {
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  // Prefer higher-quality engines when the browser offers them — these sound
  // noticeably less robotic than the default system voice.
  const preferredNames = ["Google US English", "Samantha", "Microsoft Aria", "Microsoft Jenny"];
  cachedVoice =
    voices.find((v) => preferredNames.includes(v.name)) ||
    voices.find((v) => v.lang === "en-US" && /Google|Natural|Neural/i.test(v.name)) ||
    voices.find((v) => v.lang === "en-US") ||
    null;
  return cachedVoice;
}
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => { cachedVoice = null; };
}

function speakWithBrowser(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickBestVoice();
  if (voice) utter.voice = voice;
  utter.lang = "en-US";
  utter.rate = 0.9;
  window.speechSynthesis.speak(utter);
}

let currentAudio = null;
function stopAudio() {
  try {
    if (currentAudio) { currentAudio.pause(); currentAudio.src = ""; }
  } catch (e) { /* ignorar */ }
  currentAudio = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}
// Cache de audios ya sintetizados (texto → blob URL): repetir una palabra
// no gasta otro request. Solo memoria (los MP3 no van a localStorage).
const audioCache = new Map();
async function playUrl(url) {
  stopAudio();
  const audio = new Audio(url);
  currentAudio = audio;
  audio.onended = () => { if (currentAudio === audio) currentAudio = null; };
  await audio.play();
}

async function speak(text, opts = {}) {
  // Orden v2: Edge TTS neural (gratis, natural) → VoiceRSS → navegador.
  // opts: { voice, rate } — rate -10..+10, default -5 (lento para aprender).
  const voice = opts.voice || "en-US-AriaNeural";
  const rate = opts.rate ?? -5;
  const cacheKey = `${voice}|${rate}|${text}`;
  if (audioCache.has(cacheKey)) {
    try { await playUrl(audioCache.get(cacheKey)); return; } catch (e) { /* cache rota — seguir a red */ }
  }
  // 1) Edge TTS neural
  try {
    const res = await fetch(`/api/edge-tts?text=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}&rate=${encodeURIComponent(rate)}`);
    if (res.ok) {
      const blob = await res.blob();
      if (blob.type.includes("audio") && blob.size > 0) {
        const url = URL.createObjectURL(blob);
        audioCache.set(cacheKey, url);
        await playUrl(url);
        return;
      }
    }
  } catch (e) {
    // caído o sin red — seguir al siguiente
  }
  // 2) VoiceRSS (si está configurado en el servidor)
  try {
    const res = await fetch(`/api/voicerss?text=${encodeURIComponent(text)}`);
    if (res.ok) {
      const blob = await res.blob();
      if (blob.type.includes("audio") && blob.size > 0) {
        const url = URL.createObjectURL(blob);
        audioCache.set(cacheKey, url);
        await playUrl(url);
        return;
      }
    }
  } catch (e) {
    // network hiccup — fall through to the browser voice below
  }
  // 3) Voz del navegador (robótica, pero gratis e instantánea)
  speakWithBrowser(text);
}

function ClickableDefinition({ text, onWordTap, style }) {
  // Splits the definition into tappable words, so tapping an unfamiliar one
  // inside it jumps straight to adding that word too.
  const parts = text.split(/(\s+)/);
  return (
    <p style={style}>
      {parts.map((part, i) => {
        if (/^\s+$/.test(part)) return part;
        const clean = part.replace(/[^a-zA-Z'-]/g, "");
        if (!clean) return part;
        return (
          <span key={i} style={{ cursor: "pointer", borderBottom: "1px dotted #4a5763" }} onClick={() => onWordTap(clean.toLowerCase())}>
            {part}
          </span>
        );
      })}
    </p>
  );
}

async function findWordForDescription(description) {
  const prompt = `Someone learning English is trying to find the right English word, OR the equivalent English idiom, for something. They wrote (may be in Spanish, English, or a mix):
"${description}"

If what they wrote is a casual saying or idiomatic expression (something that doesn't translate word-for-word — like "me costó un ojo de la cara"), find the natural ENGLISH IDIOM that native speakers actually use for the same idea (e.g. "cost an arm and a leg") — never a literal, word-for-word translation. If it's just a plain concept, find the matching English word instead.

Return ONLY valid JSON, no markdown fences, no extra text, in exactly this shape:
{"words": [{"word": "...", "why": "..."}]}

Rules:
- "words": 1 to 3 candidates, best match first.
- "word": the English word, phrase, or idiom itself — lowercase, no leading article, natural spacing (e.g. "cost an arm and a leg", not hyphenated or capitalized).
- "why": under 18 words — if it's an idiom, briefly explain what it actually means (not the literal words), so the learner understands it's figurative.
- If the description is already very specific, just return one strong match.`;
  const clean = await callClaude(prompt, 400);
  return JSON.parse(clean);
}

async function explainPhrase(phrase) {
  const prompt = `An English learner heard or read this phrase somewhere (a movie, a show, a conversation) and doesn't understand it:
"${phrase}"

Explain what it actually means in everyday use. If it's an idiom or slang, explain the figurative meaning, not a word-for-word breakdown.

Return ONLY valid JSON, no markdown fences, no extra text, in exactly this shape:
{"meaning": "...", "meaningEs": "...", "idiomatic": true or false}

Rules:
- "meaning": a short, plain English explanation, under 20 words.
- "meaningEs": the same explanation in natural Spanish, under 20 words.
- "idiomatic": true if this is a figurative/idiomatic expression, false if it's just a plain literal phrase.`;
  const clean = await callClaude(prompt, 400);
  return JSON.parse(clean);
}

async function suggestWordsForProfile(profile, existingWords) {
  const existingList = existingWords.map((w) => w.en).join(", ");
  const context = [profile.job && `works as / studies: ${profile.job}`, profile.interests && `interests: ${profile.interests}`]
    .filter(Boolean)
    .join("; ");
  const prompt = `Suggest useful English vocabulary for a learner with this background: ${context || "no background given"}.
Words they already have (don't repeat these): ${existingList || "(none yet)"}

Return ONLY valid JSON, no markdown fences, no extra text, in exactly this shape:
{"suggestions": [{"word": "...", "why": "..."}]}

Rules:
- "suggestions": exactly 5 words relevant to their job/interests, not already in their list.
- "word": lowercase, single common English word (no phrases).
- "why": under 10 words, why it's useful for them specifically.`;
  const clean = await callClaude(prompt, 500);
  return JSON.parse(clean);
}

async function generateWordDetails(word, existingWords) {
  const wordList = existingWords.map((w) => w.en).join(", ");
  const prompt = `New word: "${word}"
Existing words already in the learner's vocabulary network: ${wordList || "(none yet)"}

Return ONLY valid JSON, no markdown fences, no extra text, in exactly this shape:
{"correctedWord": "...", "definition": "...", "definitionEs": "...", "category": "...", "connections": [{"word": "<exact spelling of an existing word from the list above>", "sentence": "..."}]}

Rules:
- "correctedWord": if "${word}" is a single misspelled word, put the correctly-spelled real word here (e.g. "nephey" → "nephew"). If it's already correct, or if it's a multi-word idiom/expression (like "cost an arm and a leg"), repeat it unchanged — don't try to reduce a phrase down to one dictionary word.
- "definition": a simple English definition for a beginner English learner, under 14 words, using common everyday words, describing "correctedWord" (not the misspelled input). If "correctedWord" is an idiom or figurative expression, explain what it actually MEANS (the figurative sense), not what the individual words literally say. Do not reuse the word/phrase inside its own definition.
- "definitionEs": a Spanish translation of that same definition (natural Spanish, not word-for-word).
- "category": one short lowercase English topic word, like school, food, feelings, work, nature, travel, or health.
- "connections": pick between 2 and 5 words FROM THE EXISTING LIST ABOVE that "correctedWord" is naturally related to in meaning or everyday use — not just words that share a category. A word can relate to ideas from more than one topic (e.g. "shelf" fits both "home" and "school"). The more genuine connections you find, the better — a richly connected network helps the learner review old words while learning new ones. For each connection, write one short natural English sentence using both "correctedWord" and that existing word together, spelled correctly. Only return fewer than 2 if the existing list is very small or truly nothing relates well.`;

  const clean = await callClaude(prompt, 1000);
  return JSON.parse(clean);
}


/* ---------- Starter word graph (English only, simple definitions) ---------- */
const PALETTE = ["#8CA9C9", "#D98C5F", "#C98CC9", "#A9B16B", "#4FAE82", "#C9A15A", "#7BA9A0"];

const SEED_NODES = {
  study:    { def: "to spend time learning about something", defEs: "pasar tiempo aprendiendo algo", cat: "school" },
  math:     { def: "the subject that deals with numbers and shapes", defEs: "la materia que trata con números y formas", cat: "school" },
  exam:     { def: "a formal test of what you know", defEs: "una prueba formal de lo que sabés", cat: "school" },
  school:   { def: "a place where people go to learn", defEs: "un lugar donde la gente va a aprender", cat: "school" },
  teacher:  { def: "a person whose job is to help others learn", defEs: "una persona cuyo trabajo es ayudar a otros a aprender", cat: "school" },
  notebook: { def: "a small book used for writing notes", defEs: "un cuaderno pequeño para escribir apuntes", cat: "school" },

  kitchen:  { def: "a room where food is cooked", defEs: "una habitación donde se cocina comida", cat: "food" },
  recipe:   { def: "a set of steps for making a certain food", defEs: "un conjunto de pasos para preparar cierta comida", cat: "food" },
  flavor:   { def: "how food or drink tastes", defEs: "cómo sabe una comida o bebida", cat: "food" },
  hungry:   { def: "feeling like you need to eat", defEs: "sentir que necesitás comer", cat: "food" },

  happy:    { def: "feeling good or pleased", defEs: "sentirse bien o contento", cat: "feelings" },
  excited:  { def: "feeling very happy about something coming soon", defEs: "sentirse muy feliz por algo que va a pasar pronto", cat: "feelings" },
  stress:   { def: "a feeling of worry or pressure", defEs: "una sensación de preocupación o presión", cat: "feelings" },
  calm:     { def: "quiet and free of worry", defEs: "tranquilo y sin preocupaciones", cat: "feelings" },
  proud:    { def: "feeling good about something you did", defEs: "sentirse bien por algo que hiciste", cat: "feelings" },

  meeting:  { def: "a time when people gather to talk about work", defEs: "un momento en que la gente se reúne para hablar de trabajo", cat: "work" },
  deadline: { def: "the time by which something must be finished", defEs: "el momento límite en que algo debe estar terminado", cat: "work" },
  coworker: { def: "a person you work with", defEs: "una persona con la que trabajás", cat: "work" },
  salary:   { def: "the money a person earns from a job", defEs: "el dinero que una persona gana en un trabajo", cat: "work" },

  tree:     { def: "a tall plant with a trunk and branches", defEs: "una planta alta con tronco y ramas", cat: "nature" },
  forest:   { def: "a large area covered with trees", defEs: "un área grande cubierta de árboles", cat: "nature" },
  river:    { def: "a long body of water that flows across land", defEs: "una extensión larga de agua que fluye por la tierra", cat: "nature" },
  root:     { def: "the part of a plant that grows under the ground", defEs: "la parte de una planta que crece bajo tierra", cat: "nature" },
};

const SEED_EDGES = [
  { a: "study", b: "math", s: "She studies math every night after dinner." },
  { a: "study", b: "exam", s: "He studies hard before every exam." },
  { a: "study", b: "school", s: "Students study many subjects at school." },
  { a: "school", b: "teacher", s: "The teacher works at a small school." },
  { a: "school", b: "notebook", s: "She brings a notebook to school every day." },
  { a: "exam", b: "stress", s: "The exam gave him a lot of stress." },
  { a: "teacher", b: "proud", s: "The teacher was proud of her students." },
  { a: "kitchen", b: "recipe", s: "He tried a new recipe in the kitchen." },
  { a: "recipe", b: "flavor", s: "This recipe gives the dish a strong flavor." },
  { a: "flavor", b: "hungry", s: "The flavor made her even more hungry." },
  { a: "kitchen", b: "hungry", s: "I always get hungry near the kitchen." },
  { a: "happy", b: "excited", s: "She was happy and excited about the trip." },
  { a: "excited", b: "proud", s: "He felt excited and proud on his first day." },
  { a: "stress", b: "calm", s: "A walk outside turned her stress into calm." },
  { a: "calm", b: "river", s: "The river was calm in the early morning." },
  { a: "meeting", b: "deadline", s: "They discussed the deadline in the meeting." },
  { a: "deadline", b: "stress", s: "A tight deadline can cause a lot of stress." },
  { a: "meeting", b: "coworker", s: "A coworker joined the meeting late." },
  { a: "coworker", b: "salary", s: "My coworker asked for a higher salary." },
  { a: "proud", b: "salary", s: "He felt proud after his first salary." },
  { a: "tree", b: "forest", s: "One tree stood taller than the rest of the forest." },
  { a: "forest", b: "river", s: "A river runs through the middle of the forest." },
  { a: "tree", b: "root", s: "The tree's root grew deep into the ground." },
  { a: "root", b: "study", s: "Learning a word's root helps you study faster." },
];

/* Bundled fallback icons — shown only until real photos load in (or for a
   word Pexels genuinely has nothing for). No network needed for these. */
const CATEGORY_ICONS = {
  school: BookOpen,
  food: Utensils,
  feelings: Smile,
  work: Briefcase,
  nature: TreePine,
};
function CategoryIcon({ cat, size = 30, color = "#4a5763" }) {
  const Icon = CATEGORY_ICONS[cat] || Shapes;
  return <Icon size={size} color={color} strokeWidth={1.4} />;
}

/* ---------- Simple SM-2-style spaced repetition (same idea Anki uses) ---------- */
const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_REVIEW_CAP = 20; // like Anki's daily limit — keeps a big backlog from turning into 100 cards in one sitting
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
function initSrs() {
  return { interval: 1, ease: 2.5, reps: 0, due: Date.now() + DAY_MS };
}
function nextSrs(card, grade) {
  // grade: "again" | "hard" | "good" | "easy"
  let { interval, ease, reps } = card;
  if (grade === "again") {
    interval = 1;
    ease = Math.max(1.3, ease - 0.2);
    reps = 0;
  } else {
    if (grade === "hard") { interval = Math.max(1, interval * 1.2); ease = Math.max(1.3, ease - 0.15); }
    else if (grade === "good") { interval = Math.max(1, interval * ease); }
    else if (grade === "easy") { interval = Math.max(1, interval * ease * 1.3); ease = ease + 0.15; }
    reps = reps + 1;
  }
  return { interval, ease, reps, due: Date.now() + interval * DAY_MS };
}

async function checkSentence(word, sentence) {
  const prompt = `A beginner English learner wrote this sentence using the word "${word}":
"${sentence}"

Return ONLY valid JSON, no markdown fences, no extra text, in exactly this shape:
{"correct": true or false, "corrected": "...", "note": "..."}

Rules:
- "correct": true if the sentence is natural and grammatically fine as written, false otherwise.
- "corrected": the most natural correct version of the sentence (if it was already correct, repeat it unchanged).
- "note": one short, encouraging sentence in simple English explaining what changed and why (or confirming it was correct). Under 20 words.`;
  const clean = await callClaude(prompt, 500);
  return JSON.parse(clean);
}

async function checkConnectionSentence(word, connectedWord, sentence) {
  const prompt = `A beginner English learner is trying to unlock the new word "${word}" by connecting it to a word they already know: "${connectedWord}".
They wrote this sentence, trying to use both words naturally together:
"${sentence}"

Return ONLY valid JSON, no markdown fences, no extra text, in exactly this shape:
{"usesBoth": true or false, "correct": true or false, "corrected": "...", "note": "..."}

Rules:
- "usesBoth": true only if the sentence actually contains both "${word}" and "${connectedWord}" (or a natural form of each, like plurals or verb tenses).
- "correct": true if the sentence is natural and grammatically fine as written.
- "corrected": the most natural correct sentence that still uses both words (if it was already correct, repeat it unchanged). If "usesBoth" is false, write a good example sentence using both words instead, so they see what it should look like.
- "note": one short, encouraging sentence in simple English — if they missed one of the words, gently say so; otherwise explain what changed or confirm it was correct. Under 20 words.`;
  const clean = await callClaude(prompt, 500);
  return JSON.parse(clean);
}


const STORAGE_KEY = "vocab-data";

function buildGraphData() {
  const nodes = {};
  Object.entries(SEED_NODES).forEach(([id, n]) => {
    nodes[id] = { id, en: id, def: n.def, defEs: n.defEs || "", cat: n.cat, images: [], standalone: n.def, userExamples: [] };
  });
  const edges = SEED_EDGES.map((e) => ({ source: e.a, target: e.b, sentence: e.s }));
  const srs = { study: initSrs() };
  return { nodes, edges, learned: ["study"], srs, level: null, profile: null, onboarded: false };
}

/* ---------- Placement quiz (fixed questions — no AI calls needed) ---------- */
/* Each tier has 3 questions matched to that tier's difficulty. The tier shown
   is picked from the self-report; the score within it can then nudge the
   final level up or down by one step. */
const QUIZ_TIERS = {
  beginner: [
    { q: "I ___ a book every night before bed.", options: ["reads", "read", "reading", "to read"], correct: 1 },
    { q: "What is the opposite of \"happy\"?", options: ["sad", "hungry", "tired", "fast"], correct: 0 },
    { q: "Choose the correct sentence.", options: ["She don't like coffee.", "She doesn't like coffee.", "She not like coffee.", "She isn't like coffee."], correct: 1 },
  ],
  intermediate: [
    { q: "I ___ to the store yesterday.", options: ["go", "goes", "went", "going"], correct: 2 },
    { q: "Choose the correct sentence.", options: ["I have been living here since 3 years.", "I have been living here for 3 years.", "I am living here since 3 years.", "I live here since 3 years."], correct: 1 },
    { q: "By the time we arrived, the movie ___.", options: ["already started", "has already started", "had already started", "was already starting"], correct: 2 },
  ],
  advanced: [
    { q: "Choose the correct sentence.", options: ["If I would have known, I would have called.", "If I had known, I would have called.", "If I knew, I would have called.", "If I have known, I would call."], correct: 1 },
    { q: "The company's profits have ___ significantly this year.", options: ["rose", "raised", "risen", "rising"], correct: 2 },
    { q: "Choose the sentence with correct usage.", options: ["I wish I would have more time.", "I wish I had more time.", "I wish I have more time.", "I wish I would had more time."], correct: 1 },
  ],
};
const TIER_ORDER = ["beginner", "intermediate", "advanced"];

function adjustedLevel(startLevel, score) {
  const idx = TIER_ORDER.indexOf(startLevel);
  if (score <= 1) return TIER_ORDER[Math.max(0, idx - 1)]; // struggled — one step down
  if (score === 3) return TIER_ORDER[Math.min(TIER_ORDER.length - 1, idx + 1)]; // aced it — one step up
  return startLevel; // 2/3 — about right
}

function Onboarding({ onFinish }) {
  const [step, setStep] = useState("self"); // "self" | "quiz" | "result" | "profile"
  const [selfReport, setSelfReport] = useState(null);
  const [quizIdx, setQuizIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);
  const [finalLevel, setFinalLevel] = useState(null);
  const [job, setJob] = useState("");
  const [interests, setInterests] = useState("");
  const quizSet = selfReport ? QUIZ_TIERS[selfReport] : [];

  const answer = (i) => {
    setPicked(i);
    setTimeout(() => {
      const correct = i === quizSet[quizIdx].correct;
      const newScore = score + (correct ? 1 : 0);
      setScore(newScore);
      setPicked(null);
      if (quizIdx + 1 >= quizSet.length) {
        setFinalLevel(adjustedLevel(selfReport, newScore));
        setStep("result");
      } else {
        setQuizIdx(quizIdx + 1);
      }
    }, 350);
  };

  return (
    <div style={styles.app}>
      <div style={styles.onboardWrap}>
        <Sprout size={30} color="#6FBF8B" strokeWidth={1.4} />
        <h1 style={styles.title}>Roots</h1>

        {step === "self" && (
          <>
            <p style={styles.sectionBody}>How would you describe your English level right now?</p>
            {["beginner", "intermediate", "advanced"].map((lvl) => (
              <button key={lvl} style={styles.onboardOption} onClick={() => { setSelfReport(lvl); setStep("quiz"); }}>
                {lvl === "beginner" ? "Beginner — just starting out" : lvl === "intermediate" ? "Intermediate — I get by" : "Advanced — pretty comfortable"}
              </button>
            ))}
          </>
        )}

        {step === "quiz" && (
          <>
            <p style={styles.formHint}>Quick check ({selfReport} level) — question {quizIdx + 1} of {quizSet.length}</p>
            <p style={styles.sectionBody}>{quizSet[quizIdx].q}</p>
            {quizSet[quizIdx].options.map((opt, i) => (
              <button
                key={i}
                style={picked === i ? styles.onboardOptionPicked : styles.onboardOption}
                onClick={() => picked === null && answer(i)}
              >
                {opt}
              </button>
            ))}
          </>
        )}

        {step === "result" && (
          <>
            <p style={styles.sectionBody}>
              Based on the quiz, you're at <b>{finalLevel}</b>
              {selfReport && selfReport !== finalLevel ? ` (adjusted from your guess of ${selfReport}).` : "."}
            </p>
            <p style={styles.formHint}>
              {finalLevel === "beginner"
                ? "Spanish translations will show by default — you can turn them off anytime."
                : finalLevel === "intermediate"
                ? "Translations will be hidden but one tap away when you need them."
                : "The app will stay 100% English — no translations shown."}
            </p>
            <label style={styles.label}>Not right? Pick your level manually:</label>
            {["beginner", "intermediate", "advanced"].map((lvl) => (
              <button
                key={lvl}
                style={finalLevel === lvl ? styles.onboardOptionPicked : styles.onboardOption}
                onClick={() => setFinalLevel(lvl)}
              >
                {lvl}
              </button>
            ))}
            <button style={styles.learnBtn} onClick={() => setStep("profile")}>
              Continue <ChevronRight size={16} />
            </button>
          </>
        )}

        {step === "profile" && (
          <>
            <p style={styles.sectionBody}>
              One more thing — this helps tailor word suggestions to you (a chef and a lawyer don't need the same vocabulary). Everything here is optional.
            </p>
            <label style={styles.label}>What do you do? (job, field of study, etc.)</label>
            <input style={styles.input} value={job} onChange={(e) => setJob(e.target.value)} placeholder="e.g. chef, law student, nurse" />
            <label style={styles.label}>Interests or hobbies</label>
            <input style={styles.input} value={interests} onChange={(e) => setInterests(e.target.value)} placeholder="e.g. cooking, soccer, video games" />
            <button style={styles.learnBtn} onClick={() => onFinish(finalLevel, { job: job.trim(), interests: interests.trim() })}>
              Start learning <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ---------- Component ---------- */
const SpinCSS = () => (
  <style>{`.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
);

export default function VocabGraph() {
  const [data, setData] = useState(null); // {nodes, edges, learned}
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("map");
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [form, setForm] = useState({ word: "", def: "", defEs: "", literal: "", cat: "", connections: [], sentence: "", images: [], imgInput: "" });
  const [manualLink, setManualLink] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [lookupText, setLookupText] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResults, setLookupResults] = useState(null);
  const [phraseText, setPhraseText] = useState("");
  const [phraseBusy, setPhraseBusy] = useState(false);
  const [phraseResult, setPhraseResult] = useState(null);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const [suggestResults, setSuggestResults] = useState(null);
  const [idiomText, setIdiomText] = useState("");
  const [idiomBusy, setIdiomBusy] = useState(false);
  const [idiomResult, setIdiomResult] = useState(null);
  const [sentenceInput, setSentenceInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [reviewActive, setReviewActive] = useState(false);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [reviewPos, setReviewPos] = useState(0);
  const [reviewSentence, setReviewSentence] = useState("");
  const [reviewChecking, setReviewChecking] = useState(false);
  const [reviewCheckResult, setReviewCheckResult] = useState(null);
  const [nextReviewInfo, setNextReviewInfo] = useState(null);
  const [exampleIdx, setExampleIdx] = useState(0);
  const [savedExample, setSavedExample] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [editingWord, setEditingWord] = useState(false);
  const [editForm, setEditForm] = useState({ en: "", def: "", defEs: "", cat: "" });
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  useEffect(() => {
    setSentenceInput("");
    setCheckResult(null);
    setExampleIdx(0);
    setSavedExample(false);
    setShowTranslation(false);
    setEditingWord(false);
    setDeleteConfirm(false);
  }, [selected]);
  const svgRef = useRef(null);
  const simRef = useRef(null);
  const dimsRef = useRef({ w: 800, h: 820 }); // taller than wide, so the map actually fills a phone screen instead of leaving dead space below it
  const [, forceTick] = useState(0);
  const catColorsRef = useRef({});

  /* load persisted data — this is now a real browser localStorage, per visitor's browser */
  useEffect(() => {
    let initial = buildGraphData();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.nodes) initial = parsed;
      }
    } catch (e) {
      /* first visit — use starter set */
    }
    setData(initial);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || !data) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      /* storage full or unavailable — ignore */
    }
  }, [data, loaded]);

  const colorFor = (cat) => {
    if (!catColorsRef.current[cat]) {
      const used = Object.values(catColorsRef.current);
      const next = PALETTE.find((c) => !used.includes(c)) || PALETTE[used.length % PALETTE.length];
      catColorsRef.current[cat] = next;
    }
    return catColorsRef.current[cat];
  };

  /* (re)build simulation whenever the node/edge SET changes (not on every drag tick) */
  const nodeCountRef = useRef(0);
  useEffect(() => {
    if (!data) return;
    const ids = Object.keys(data.nodes);
    if (simRef.current && ids.length === nodeCountRef.current) return; // same graph shape, skip rebuild
    nodeCountRef.current = ids.length;

    const w = dimsRef.current.w, h = dimsRef.current.h;
    const prevPos = {};
    if (simRef.current) simRef.current.nodeData.forEach((n) => (prevPos[n.id] = { x: n.x, y: n.y }));

    const nodeData = ids.map((id) => ({
      ...data.nodes[id],
      x: prevPos[id]?.x ?? w / 2 + (Math.random() - 0.5) * 40,
      y: prevPos[id]?.y ?? h / 2 + (Math.random() - 0.5) * 40,
    }));
    const linkData = data.edges.map((e) => ({ ...e }));

    if (simRef.current) simRef.current.sim.stop();

    const sim = d3
      .forceSimulation(nodeData)
      .force("link", d3.forceLink(linkData).id((d) => d.id).distance(78).strength(0.55))
      .force("charge", d3.forceManyBody().strength(-160))
      .force("center", d3.forceCenter(w / 2, h / 2))
      .force("collide", d3.forceCollide(30))
      .alphaDecay(0.02)
      .on("tick", () => forceTick((n) => n + 1));

    simRef.current = { sim, nodeData, linkData };
  }, [data]);

  const learnedSet = new Set(data?.learned || []);

  const status = useCallback(
    (id) => {
      if (!data) return "new";
      if (learnedSet.has(id)) return "learned";
      const isSuggested = data.edges.some(
        (e) => (e.source === id && learnedSet.has(e.target)) || (e.target === id && learnedSet.has(e.source))
      );
      return isSuggested ? "suggested" : "new";
    },
    [data]
  );

  const [imgSearching, setImgSearching] = useState(false);
  const searchImagesForNode = async (id, word, category, definition) => {
    setImgSearching(true);
    const images = await findImages(word, category, definition);
    if (images.length) {
      setData((prev) => ({ ...prev, nodes: { ...prev.nodes, [id]: { ...prev.nodes[id], images } } }));
    }
    setImgSearching(false);
  };

  const markLearned = (id) => {
    setData((prev) => ({
      ...prev,
      learned: [...new Set([...prev.learned, id])],
      srs: { ...prev.srs, [id]: prev.srs?.[id] || initSrs() },
    }));
  };

  const gradeReview = (id, grade) => {
    const updated = nextSrs(data.srs?.[id] || initSrs(), grade);
    setData((prev) => {
      const today = todayKey();
      const prevCount = prev.reviewedToday?.date === today ? prev.reviewedToday.count : 0;
      return {
        ...prev,
        srs: { ...prev.srs, [id]: updated },
        reviewedToday: { date: today, count: prevCount + 1 },
      };
    });
    return updated;
  };

  const nextReviewCard = () => {
    const next = reviewPos + 1;
    if (next >= reviewQueue.length) {
      setReviewActive(false);
    } else {
      setReviewPos(next);
      setExampleIdx(0);
      setReviewSentence("");
      setReviewChecking(false);
      setReviewCheckResult(null);
      setShowTranslation(false);
      setNextReviewInfo(null);
    }
  };

  const bridgesFor = (id) => {
    if (!data) return [];
    return data.edges
      .filter((e) => e.source === id || e.target === id)
      .map((e) => ({ sentence: e.sentence, other: e.source === id ? e.target : e.source }));
  };

  // your own checked/corrected sentences, shown first — they're what you
  // actually practiced with, ahead of the system's pre-written examples
  const allExamplesFor = (id) => {
    const node = data?.nodes?.[id];
    const mine = (node?.userExamples || []).map((s) => ({ sentence: s, other: null, mine: true }));
    const system = bridgesFor(id);
    // Beginners get every pre-written connecting sentence as scaffolding;
    // intermediate/advanced only get ONE as a reference — the rest has to
    // come from the learner's own writing.
    const systemLimited = data?.level === "beginner" ? system : system.slice(0, 1);
    const combined = [...mine, ...systemLimited];
    return combined.length ? combined : [{ sentence: node?.standalone, other: null }];
  };

  const addUserExample = (id, sentence) => {
    const clean = sentence.trim();
    if (!clean) return;
    setData((prev) => {
      const node = prev.nodes[id];
      if (!node) return prev;
      if ((node.userExamples || []).includes(clean)) return prev; // no duplicates
      return {
        ...prev,
        nodes: { ...prev.nodes, [id]: { ...node, userExamples: [...(node.userExamples || []), clean] } },
      };
    });
  };

  const removeUserExample = (id, sentence) => {
    setData((prev) => {
      const node = prev.nodes[id];
      if (!node) return prev;
      return {
        ...prev,
        nodes: { ...prev.nodes, [id]: { ...node, userExamples: (node.userExamples || []).filter((s) => s !== sentence) } },
      };
    });
    setExampleIdx(0);
  };

  const saveWordEdit = (id, updates) => {
    setData((prev) => {
      const node = prev.nodes[id];
      if (!node) return prev;
      return { ...prev, nodes: { ...prev.nodes, [id]: { ...node, ...updates } } };
    });
  };

  const deleteWord = (id) => {
    setData((prev) => {
      const nodes = { ...prev.nodes };
      delete nodes[id];
      const edges = prev.edges.filter((e) => e.source !== id && e.target !== id);
      const learned = prev.learned.filter((w) => w !== id);
      const srs = { ...prev.srs };
      delete srs[id];
      return { ...prev, nodes, edges, learned, srs };
    });
    setSelected(null);
  };

  // (individual node dragging removed — panning/zooming the whole canvas instead)

  /* --- pan & zoom, implemented directly with pointer/wheel events ---
     (swapped out d3-zoom: it depends on the DOM node already being mounted
     when its setup effect runs, which made it fragile here — this version
     tracks pointers by hand and has no such timing dependency) */
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const pointersRef = useRef(new Map());
  const panStartRef = useRef(null);
  const pinchDistRef = useRef(null);
  const tapRef = useRef(null); // { nodeId, x, y, moved }

  const clampK = (k) => Math.min(3.5, Math.max(0.4, k));
  const anchor = { x: dimsRef.current.w / 2, y: dimsRef.current.h / 2 };

  const zoomBy = (factor) => {
    setTransform((t) => {
      const newK = clampK(t.k * factor);
      const contentX = (anchor.x - t.x) / t.k;
      const contentY = (anchor.y - t.y) / t.k;
      return { x: anchor.x - contentX * newK, y: anchor.y - contentY * newK, k: newK };
    });
  };
  const resetZoom = () => setTransform({ x: 0, y: 0, k: 1 });

  const onSvgPointerDown = (e) => {
    e.preventDefault(); // stop the browser from starting a native text-selection drag on <text> nodes
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 1) {
      panStartRef.current = { x: e.clientX, y: e.clientY, tx: transformRef.current.x, ty: transformRef.current.y };
      const nodeEl = e.target.closest && e.target.closest("[data-node-id]");
      tapRef.current = { nodeId: nodeEl ? nodeEl.getAttribute("data-node-id") : null, x: e.clientX, y: e.clientY, moved: false };
    } else if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchDistRef.current = Math.hypot(a.x - b.x, a.y - b.y);
      tapRef.current = null; // a second finger landed — this is a pinch, not a tap
    }
  };
  const onSvgPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (tapRef.current && Math.hypot(e.clientX - tapRef.current.x, e.clientY - tapRef.current.y) > 6) {
      tapRef.current.moved = true; // dragged too far — this is a pan, not a tap
    }
    if (pointersRef.current.size === 1 && panStartRef.current) {
      const start = panStartRef.current; // snapshot now — panStartRef.current can be nulled
                                          // by pointerup before React flushes the state update below
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      setTransform((t) => ({ ...t, x: start.tx + dx, y: start.ty + dy }));
    } else if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistRef.current) zoomBy(dist / pinchDistRef.current);
      pinchDistRef.current = dist;
    }
  };
  const endPointer = (e) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchDistRef.current = null;
    if (pointersRef.current.size === 1) {
      const [remaining] = pointersRef.current.values();
      panStartRef.current = { x: remaining.x, y: remaining.y, tx: transformRef.current.x, ty: transformRef.current.y };
    } else if (pointersRef.current.size === 0) {
      panStartRef.current = null;
    }
    // resolve tap: it counts as a tap only if nothing else was already down and it never moved far
    if (tapRef.current && !tapRef.current.moved && pointersRef.current.size === 0) {
      setSelected(tapRef.current.nodeId || null);
    }
    if (pointersRef.current.size === 0) tapRef.current = null;
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [loaded]);

  const submitAdd = () => {
    if (!form.word.trim() || !form.def.trim()) return;
    const id = form.word.trim().toLowerCase().replace(/\s+/g, "-");
    setData((prev) => {
      const nodes = {
        ...prev.nodes,
        [id]: {
          id,
          en: form.word.trim(),
          def: form.def.trim(),
          defEs: form.defEs.trim(),
          literal: form.literal.trim(),
          cat: form.cat.trim() || "custom",
          images: form.images,
          standalone: form.sentence.trim() || form.def.trim(),
          userExamples: [],
        },
      };
      const newEdges = form.connections
        .filter((c) => c.checked)
        .map((c) => ({ source: id, target: c.targetId, sentence: c.sentence }));
      return { ...prev, nodes, edges: [...prev.edges, ...newEdges] };
    });
    setForm({ word: "", def: "", defEs: "", literal: "", cat: "", connections: [], sentence: "", images: [], imgInput: "" });
    setManualLink("");
    resetZoom();
    setActiveTab("map");
  };

  const runGenerate = async () => {
    if (!form.word.trim()) return;
    setGenerating(true);
    setGenError("");
    const existingWords = Object.values(data.nodes).map((n) => ({ id: n.id, en: n.en, cat: n.cat }));

    // 1) definition + connections: required, this is the part that must succeed
    let generatedCategory = form.cat;
    let generatedDefinition = form.def;
    let generatedWord = form.word.trim();
    try {
      const details = await generateWordDetails(form.word.trim(), existingWords);
      const byName = {};
      existingWords.forEach((w) => (byName[w.en.toLowerCase()] = w.id));
      const spellFixed = details.correctedWord && details.correctedWord.toLowerCase() !== form.word.trim().toLowerCase();
      // Building the network in Add Word is a different task from learning
      // it — the AI's suggested connecting sentences show up here so you can
      // see and tweak them while creating. The requirement to write your own
      // sentence still applies later, when you actually unlock/learn a word
      // on the Map — that part is untouched.
      const connections = (details.connections || [])
        .map((c) => ({
          targetId: byName[(c.word || "").toLowerCase()],
          sentence: c.sentence,
          checked: true,
        }))
        .filter((c) => c.targetId);
      generatedCategory = details.category || generatedCategory;
      generatedDefinition = details.definition || generatedDefinition;
      generatedWord = details.correctedWord || generatedWord;
      setForm((f) => ({
        ...f,
        word: details.correctedWord || f.word,
        def: details.definition || f.def,
        defEs: details.definitionEs || f.defEs,
        cat: details.category || f.cat,
        connections,
        sentence: connections[0]?.sentence || f.sentence,
      }));
      if (spellFixed) setGenError(`Corrected the spelling to "${details.correctedWord}".`);
    } catch (e) {
      setGenError(`Couldn't generate: ${e.message || e}`);
      setGenerating(false);
      return;
    }

    // 2) images: real search now works (this is a real server, not a sandboxed artifact)
    const images = await findImages(generatedWord, generatedCategory, generatedDefinition);
    setForm((f) => ({ ...f, images }));
    setGenerating(false);
  };

  const toggleConnection = (idx) => {
    setForm((f) => ({
      ...f,
      connections: f.connections.map((c, i) => (i === idx ? { ...c, checked: !c.checked } : c)),
    }));
  };

  const addManualConnection = () => {
    if (!manualLink) return;
    if (form.connections.some((c) => c.targetId === manualLink)) return;
    setForm((f) => ({
      ...f,
      connections: [...f.connections, { targetId: manualLink, sentence: "", checked: true }],
    }));
    setManualLink("");
  };


  if (!data) return <div style={styles.app} />;

  if (!data.onboarded) {
    return (
      <Onboarding
        onFinish={(level, profile) => setData((prev) => ({ ...prev, level, profile, onboarded: true }))}
      />
    );
  }

  const nodeData = simRef.current?.nodeData || [];
  const linkData = simRef.current?.linkData || [];
  const learnedCount = learnedSet.size;
  const totalCount = Object.keys(data.nodes).length;
  const wordList = Object.values(data.nodes);
  const cats = [...new Set(wordList.map((w) => w.cat))];

  const dueIds = [...learnedSet]
    .filter((id) => (data.srs?.[id]?.due ?? 0) <= Date.now())
    .sort((a, b) => (data.srs?.[a]?.due ?? 0) - (data.srs?.[b]?.due ?? 0));
  const doneToday = data.reviewedToday?.date === todayKey() ? data.reviewedToday.count : 0;
  const remainingCapToday = Math.max(0, DAILY_REVIEW_CAP - doneToday);
  const dueCount = dueIds.length;
  const dueQueueIds = dueIds.slice(0, remainingCapToday);
  const practiceQueueIds = [...learnedSet].sort((a, b) => (data.srs?.[a]?.due ?? 0) - (data.srs?.[b]?.due ?? 0));

  return (
    <div style={styles.app}>
      <SpinCSS />
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <Sprout size={22} color="#6FBF8B" strokeWidth={1.6} />
          <div>
            <h1 style={styles.title}>Roots</h1>
            <p style={styles.subtitle}>your vocabulary, growing like roots</p>
          </div>
        </div>
        <div style={styles.progress}>
          <span style={styles.progressNum}>{learnedCount}</span>
          <span style={styles.progressDen}> / {totalCount} learned</span>
          <select
            style={styles.levelSelect}
            value={data.level || "advanced"}
            onChange={(e) => setData((prev) => ({ ...prev, level: e.target.value }))}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </header>

      <div style={styles.tabBar}>
        <button style={activeTab === "map" ? styles.tabActive : styles.tab} onClick={() => { setActiveTab("map"); setShowMoreMenu(false); }}>Map</button>
        <button style={activeTab === "review" ? styles.tabActive : styles.tab} onClick={() => { setActiveTab("review"); setShowMoreMenu(false); }}>
          Review{dueCount > 0 ? ` · ${dueCount}` : ""}
        </button>
        <div style={{ position: "relative", flex: 1 }}>
          <button
            style={activeTab === "add" || activeTab === "lookup" ? styles.tabActive : styles.tab}
            onClick={() => setShowMoreMenu((v) => !v)}
          >
            {activeTab === "add" ? "Add word" : activeTab === "lookup" ? "Lookup" : "More ▾"}
          </button>
          {showMoreMenu && (
            <div style={styles.moreMenu}>
              <button style={styles.moreMenuItem} onClick={() => { setActiveTab("add"); setShowMoreMenu(false); }}>Add word</button>
              <button style={styles.moreMenuItem} onClick={() => { setActiveTab("lookup"); setShowMoreMenu(false); }}>Lookup</button>
            </div>
          )}
        </div>
      </div>

      {activeTab === "map" && (
      <>
      <div style={styles.legendRow}>
        <div style={styles.legend}>
          {cats.map((c) => (
            <div key={c} style={styles.legendItem}>
              <span style={{ ...styles.legendDot, background: colorFor(c) }} />
              {c}
            </div>
          ))}
        </div>
      </div>

      <div style={styles.canvasWrap}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${dimsRef.current.w} ${dimsRef.current.h}`}
        style={styles.svg}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onPointerLeave={endPointer}
      >
        <defs>
          <radialGradient id="bgGlow" cx="50%" cy="42%" r="65%">
            <stop offset="0%" stopColor="#1c2a26" />
            <stop offset="100%" stopColor="#12181b" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width={dimsRef.current.w} height={dimsRef.current.h} fill="url(#bgGlow)" />

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
        {linkData.map((l, i) => {
          const s = l.source, t = l.target;
          if (!s || typeof s === "string" || !t || typeof t === "string") return null;
          const lit = learnedSet.has(s.id) && learnedSet.has(t.id);
          const partiallyLit = learnedSet.has(s.id) || learnedSet.has(t.id);
          return (
            <line
              key={i}
              x1={s.x} y1={s.y} x2={t.x} y2={t.y}
              stroke={lit ? "#6FBF8B" : partiallyLit ? "#D9A441" : "#33404a"}
              strokeWidth={lit ? 1.8 : 1}
              strokeOpacity={lit ? 0.85 : partiallyLit ? 0.55 : 0.35}
            />
          );
        })}

        {nodeData.map((n) => {
          const st = status(n.id);
          const catColor = colorFor(n.cat);
          const r = st === "learned" ? 15 : st === "suggested" ? 12 : 8;
          const fill = st === "learned" ? "#6FBF8B" : st === "suggested" ? "#D9A441" : "#2a343c";
          return (
            <g
              key={n.id}
              data-node-id={n.id}
              transform={`translate(${n.x || 0},${n.y || 0})`}
              style={{ cursor: "pointer" }}
            >
              <circle data-node-id={n.id} r={Math.max(r + 10, 22)} fill="transparent" />
              <circle r={r + 4} fill="none" stroke={catColor} strokeWidth={1.2} opacity={0.55} />
              <circle r={r} fill={fill} stroke={st === "new" ? "#4a5763" : "none"} strokeWidth={1} />
              {st !== "new" && (
                <text
                  y={-r - 8}
                  textAnchor="middle"
                  style={{ ...styles.nodeLabel, fill: st === "learned" ? "#eae4d8" : "#e7cf9e" }}
                >
                  {n.en}
                </text>
              )}
            </g>
          );
        })}
        </g>
      </svg>

      <div style={styles.zoomControls}>
        <button style={styles.zoomBtn} onClick={() => zoomBy(1.4)}>+</button>
        <button style={styles.zoomBtn} onClick={() => zoomBy(1 / 1.4)}>−</button>
        <button style={styles.zoomBtnReset} onClick={resetZoom}>reset</button>
      </div>
      </div>

      <p style={styles.hint}>
        Tap an <span style={{ color: "#D9A441" }}>amber</span> word (linked to one you know) to learn it next.
        Pinch or scroll to zoom, drag to pan — the map itself stays put.
      </p>
      </>
      )}

      {activeTab === "review" && (
        <div style={styles.section}>
          {!reviewActive ? (
            <>
              <h2 style={styles.sectionTitle}>Spaced repetition</h2>
              <p style={styles.sectionBody}>
                Scheduled like Anki, but active: each card shows the word with its image and definition, then you
                write your own sentence with it. Once it's checked, grade yourself — words you find easy come back
                less often, words you struggle with come back sooner.
              </p>
              {learnedCount === 0 ? (
                <p style={styles.formHint}>Learn a word on the Map first — then it shows up here.</p>
              ) : dueCount === 0 ? (
                <>
                  <p style={styles.progressNum}>🎉 All caught up!</p>
                  <p style={styles.formHint}>Nothing's due today — come back tomorrow, or practice anyway (it won't rush your schedule).</p>
                  <button
                    style={styles.tab}
                    onClick={() => {
                      setReviewQueue(practiceQueueIds);
                      setReviewPos(0);
                      setExampleIdx(0);
                      setReviewSentence("");
                      setReviewChecking(false);
                      setReviewCheckResult(null);
                      setNextReviewInfo(null);
                      setReviewActive(true);
                    }}
                  >
                    Practice anyway ({learnedCount} word{learnedCount === 1 ? "" : "s"})
                  </button>
                </>
              ) : (
                <>
                  <p style={styles.progressNum}>
                    {dueCount} due{remainingCapToday < dueCount ? ` (showing ${remainingCapToday} today, rest carries over)` : ""}
                  </p>
                  <button
                    style={styles.learnBtn}
                    onClick={() => {
                      setReviewQueue(dueQueueIds);
                      setReviewPos(0);
                      setExampleIdx(0);
                      setReviewSentence("");
                      setReviewChecking(false);
                      setReviewCheckResult(null);
                      setNextReviewInfo(null);
                      setReviewActive(true);
                    }}
                  >
                    <Layers size={16} /> Start review ({dueQueueIds.length} word{dueQueueIds.length === 1 ? "" : "s"})
                  </button>
                </>
              )}

              {learnedCount > 0 && (() => {
                const now = Date.now();
                const upcoming = [...learnedSet]
                  .map((id) => ({ id, due: data.srs?.[id]?.due ?? now }))
                  .filter((x) => x.due > now)
                  .sort((a, b) => a.due - b.due)
                  .slice(0, 5);
                if (upcoming.length === 0) return null;
                return (
                  <div style={styles.upcomingBox}>
                    <p style={styles.label}>Coming up next</p>
                    {upcoming.map((x) => {
                      const days = Math.max(1, Math.ceil((x.due - now) / DAY_MS));
                      return (
                        <div key={x.id} style={styles.upcomingRow}>
                          <span style={styles.upcomingWord}>{data.nodes[x.id]?.en}</span>
                          <span style={styles.pagerCount}>in {days} day{days === 1 ? "" : "s"}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          ) : (() => {
            const id = reviewQueue[reviewPos];
            const w = data.nodes[id];
            if (!w) return null;
            const revExamples = allExamplesFor(w.id);
            const ex = revExamples[Math.min(exampleIdx, revExamples.length - 1)];
            return (
              <>
                <p style={styles.formHint}>Card {reviewPos + 1} of {reviewQueue.length}</p>
                <div style={styles.wordRow}>
                  <h2 style={styles.panelWord}>{w.en}</h2>
                  <button style={styles.speakBtn} onClick={() => speak(w.en)}><Volume2 size={17} /></button>
                </div>

                {w.images && w.images.length > 0 ? (
                  <div style={styles.gallery}>
                    {w.images.map((src, i) => <img key={i} src={src} alt={w.en} style={styles.galleryImg} />)}
                  </div>
                ) : (
                  <div style={styles.panelImgFallback}><CategoryIcon cat={w.cat} /></div>
                )}
                <p style={styles.panelDef}>{w.def}</p>
                {w.defEs && data.level === "beginner" && (
                  <p style={styles.translationText}>{w.defEs}</p>
                )}
                {w.defEs && data.level === "intermediate" && (
                  showTranslation ? (
                    <p style={styles.translationText} onClick={() => setShowTranslation(false)}>{w.defEs}</p>
                  ) : (
                    <button style={styles.translateBtn} onClick={() => setShowTranslation(true)}>🇪🇸 tap to translate</button>
                  )
                )}

                <label style={styles.label}>Write a sentence with "{w.en}" to complete this card</label>
                <input
                  style={styles.input}
                  value={reviewSentence}
                  onChange={(e) => { setReviewSentence(e.target.value); setReviewCheckResult(null); }}
                  placeholder={`e.g. I ${w.en} ...`}
                  disabled={!!reviewCheckResult}
                />

                {!reviewCheckResult ? (
                  <button
                    style={styles.genBtn}
                    disabled={!reviewSentence.trim() || reviewChecking}
                    onClick={async () => {
                      setReviewChecking(true);
                      try {
                        const result = await checkSentence(w.en, reviewSentence.trim());
                        setReviewCheckResult(result);
                        addUserExample(w.id, result.correct ? reviewSentence.trim() : result.corrected);
                      } catch (e) {
                        setReviewCheckResult({ correct: false, corrected: "", note: `Couldn't check that: ${e.message || e}` });
                      }
                      setReviewChecking(false);
                    }}
                  >
                    {reviewChecking ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                    {reviewChecking ? "Checking…" : "Check & continue"}
                  </button>
                ) : (
                  <div style={styles.exampleBox}>
                    {reviewCheckResult.correct ? (
                      <p style={{ ...styles.exampleEn, color: "#6FBF8B" }}>✓ Correct as written!</p>
                    ) : (
                      <p style={styles.exampleEn}>{reviewCheckResult.corrected}</p>
                    )}
                    <p style={styles.bridgeNote}>{reviewCheckResult.note}</p>
                  </div>
                )}
                {reviewChecking && <p style={styles.formHint}>The free tier can take up to 30–40s when it's busy — hang tight.</p>}

                {(data.level === "beginner" || reviewCheckResult) && (
                  <>
                    <div style={styles.exampleFooter}>
                      {ex.mine ? (
                        <p style={styles.mineNote}>✎ your example</p>
                      ) : ex.other ? (
                        <p style={styles.bridgeNote}>connects to “{data.nodes[ex.other]?.en || ex.other}”</p>
                      ) : <span />}
                      {revExamples.length > 1 && (
                        <div style={styles.examplePager}>
                          <button style={styles.pagerBtn} onClick={() => setExampleIdx((i) => (i - 1 + revExamples.length) % revExamples.length)}>‹</button>
                          <span style={styles.pagerCount}>{exampleIdx + 1}/{revExamples.length}</span>
                          <button style={styles.pagerBtn} onClick={() => setExampleIdx((i) => (i + 1) % revExamples.length)}>›</button>
                        </div>
                      )}
                    </div>
                    <p style={styles.exampleEn}>{ex.sentence}</p>
                  </>
                )}

                {reviewCheckResult && !nextReviewInfo && (
                  <>
                    <p style={styles.formHint}>How well did you remember it?</p>
                    <div style={styles.gradeRow}>
                      <button style={styles.gradeAgain} onClick={() => setNextReviewInfo(gradeReview(id, "again"))}>Again</button>
                      <button style={styles.gradeHard} onClick={() => setNextReviewInfo(gradeReview(id, "hard"))}>Hard</button>
                      <button style={styles.gradeGood} onClick={() => setNextReviewInfo(gradeReview(id, "good"))}>Good</button>
                      <button style={styles.gradeEasy} onClick={() => setNextReviewInfo(gradeReview(id, "easy"))}>Easy</button>
                    </div>
                  </>
                )}
                {nextReviewInfo && (
                  <div style={styles.exampleBox}>
                    <p style={styles.mineNote}>
                      Next review in {Math.round(nextReviewInfo.interval) <= 0 ? "less than a day" : `${Math.round(nextReviewInfo.interval)} day${Math.round(nextReviewInfo.interval) === 1 ? "" : "s"}`}
                    </p>
                    <button style={styles.learnBtn} onClick={nextReviewCard}>
                      Continue <ChevronRight size={16} />
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}

      {activeTab === "add" && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Add a word</h2>
          <p style={styles.formHint}>Every visitor builds their own map — this word is saved only for you.</p>

          {(data.profile?.job || data.profile?.interests) && (
            <div style={styles.lookupBox}>
              <label style={styles.label}>Suggested for you ({data.profile.job || data.profile.interests})</label>
              <button
                style={styles.genBtn}
                disabled={suggestBusy}
                onClick={async () => {
                  setSuggestBusy(true);
                  setSuggestResults(null);
                  try {
                    const existingWords = Object.values(data.nodes).map((n) => ({ en: n.en }));
                    const result = await suggestWordsForProfile(data.profile, existingWords);
                    setSuggestResults(result.suggestions || []);
                  } catch (e) {
                    setSuggestResults([{ word: "", why: `Couldn't get suggestions: ${e.message || e}` }]);
                  }
                  setSuggestBusy(false);
                }}
              >
                {suggestBusy ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                {suggestBusy ? "Thinking…" : "Suggest words for me"}
              </button>
              {suggestBusy && <p style={styles.formHint}>The free tier can take up to 30–40s when it's busy — hang tight.</p>}
              {suggestResults && suggestResults.map((r, i) => (
                r.word ? (
                  <button key={i} style={styles.lookupResult} onClick={() => { setForm((f) => ({ ...f, word: r.word })); setSuggestResults(null); }}>
                    <span style={styles.lookupWord}>{r.word}</span>
                    <span style={styles.lookupWhy}>{r.why}</span>
                  </button>
                ) : (
                  <p key={i} style={styles.genError}>{r.why}</p>
                )
              ))}
            </div>
          )}

          <label style={styles.label}>Word</label>
          <input style={styles.input} value={form.word} onChange={(e) => setForm({ ...form, word: e.target.value })} placeholder="e.g. deadline" />

          <button style={styles.genBtn} onClick={runGenerate} disabled={!form.word.trim() || generating}>
            {generating ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
            {generating ? "Generating…" : "Generate definition & connections"}
          </button>
          {generating && <p style={styles.formHint}>The free tier can take up to 30–40s when it's busy — hang tight.</p>}
          {genError && <p style={styles.genError}>{genError}</p>}

          <label style={styles.label}>Simple definition</label>
          <input style={styles.input} value={form.def} onChange={(e) => setForm({ ...form, def: e.target.value })} placeholder="Explain it with easy words" />

          <label style={styles.label}>Category</label>
          <input style={styles.input} value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })} placeholder="e.g. work, food, travel" />

          <label style={styles.label}>Connections in the network</label>
          <p style={styles.formHint}>
            A word can link to more than one — a word can belong to several ideas at once. Uncheck any that don't fit.
          </p>
          {form.connections.length === 0 && (
            <p style={styles.formHint}>No connections yet — generate above, or add one below.</p>
          )}
          {form.connections.map((c, i) => (
            <div key={c.targetId} style={styles.connRow}>
              <label style={styles.connCheckLabel}>
                <input type="checkbox" checked={c.checked} onChange={() => toggleConnection(i)} />
                <span style={styles.connWord}>{data.nodes[c.targetId]?.en}</span>
              </label>
              <input
                style={styles.inputSmall}
                value={c.sentence}
                onChange={(e) => {
                  const sentence = e.target.value;
                  setForm((f) => ({ ...f, connections: f.connections.map((cc, ii) => (ii === i ? { ...cc, sentence } : cc)) }));
                }}
                placeholder={`Sentence linking to "${data.nodes[c.targetId]?.en}"`}
              />
            </div>
          ))}
          <div style={styles.connRow}>
            <select style={styles.inputSmall} value={manualLink} onChange={(e) => setManualLink(e.target.value)}>
              <option value="">+ add another connection…</option>
              {Object.values(data.nodes)
                .filter((n) => !form.connections.some((c) => c.targetId === n.id))
                .map((n) => (
                  <option key={n.id} value={n.id}>{n.en}</option>
                ))}
            </select>
            <button style={styles.smallAddBtn} onClick={addManualConnection} disabled={!manualLink}>
              <Plus size={14} />
            </button>
          </div>

          <label style={styles.label}>Images {generating ? "" : form.images.length ? `(${form.images.length} found)` : ""}</label>
          {form.images.length > 0 && (
            <div style={styles.gallery}>
              {form.images.map((src, i) => (
                <div key={i} style={{ position: "relative", flex: "0 0 auto" }}>
                  <img src={src} alt={form.word} style={styles.galleryImg} />
                  <button
                    style={styles.removeImgBtn}
                    onClick={() => setForm((f) => ({ ...f, images: f.images.filter((_, ii) => ii !== i) }))}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div style={styles.connRow}>
            <input
              style={styles.inputSmall}
              value={form.imgInput}
              onChange={(e) => setForm({ ...form, imgInput: e.target.value })}
              placeholder="Or paste your own image link"
            />
            <button
              style={styles.smallAddBtn}
              disabled={!form.imgInput.trim()}
              onClick={() => setForm((f) => ({ ...f, images: [...f.images, f.imgInput.trim()], imgInput: "" }))}
            >
              <Plus size={14} />
            </button>
          </div>

          <button style={styles.learnBtn} onClick={submitAdd}>
            Save word <ChevronRight size={16} />
          </button>
        </div>
      )}

      {activeTab === "lookup" && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Lookup</h2>
          <p style={styles.formHint}>Two tools: find the word you're missing, or make sense of something you heard.</p>

          <label style={styles.label}>What's the word? Describe what you mean</label>
          <input
            style={styles.input}
            value={lookupText}
            onChange={(e) => { setLookupText(e.target.value); setLookupResults(null); }}
            placeholder='e.g. "Cómo se llama la hija de mi hermana"'
          />
          <button
            style={styles.genBtn}
            disabled={!lookupText.trim() || lookupBusy}
            onClick={async () => {
              setLookupBusy(true);
              setLookupResults(null);
              try {
                const result = await findWordForDescription(lookupText.trim());
                setLookupResults(result.words || []);
              } catch (e) {
                setLookupResults([{ word: "", why: `Couldn't look that up: ${e.message || e}` }]);
              }
              setLookupBusy(false);
            }}
          >
            {lookupBusy ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
            {lookupBusy ? "Thinking…" : "What's the word?"}
          </button>
          {lookupBusy && <p style={styles.formHint}>The free tier can take up to 30–40s when it's busy — hang tight.</p>}
          {lookupResults && lookupResults.map((r, i) => (
            r.word ? (
              <button
                key={i}
                style={styles.lookupResult}
                onClick={() => {
                  setForm((f) => ({ ...f, word: r.word }));
                  setLookupText("");
                  setLookupResults(null);
                  setActiveTab("add");
                }}
              >
                <span style={styles.lookupWord}>{r.word}</span>
                <span style={styles.lookupWhy}>{r.why}</span>
              </button>
            ) : (
              <p key={i} style={styles.genError}>{r.why}</p>
            )
          ))}

          <div style={styles.lookupDivider} />

          <label style={styles.label}>Heard a phrase and didn't get it? Paste it here</label>
          <input
            style={styles.input}
            value={phraseText}
            onChange={(e) => { setPhraseText(e.target.value); setPhraseResult(null); }}
            placeholder='e.g. "it cost an arm and a leg"'
          />
          <button
            style={styles.genBtn}
            disabled={!phraseText.trim() || phraseBusy}
            onClick={async () => {
              setPhraseBusy(true);
              setPhraseResult(null);
              try {
                const result = await explainPhrase(phraseText.trim());
                setPhraseResult(result);
              } catch (e) {
                setPhraseResult({ meaning: `Couldn't check that: ${e.message || e}`, meaningEs: "", idiomatic: false });
              }
              setPhraseBusy(false);
            }}
          >
            {phraseBusy ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
            {phraseBusy ? "Thinking…" : "What does this mean?"}
          </button>
          {phraseBusy && <p style={styles.formHint}>The free tier can take up to 30–40s when it's busy — hang tight.</p>}
          {phraseResult && (
            <div style={styles.exampleBox}>
              {phraseResult.idiomatic && <p style={styles.mineNote}>💬 idiomatic — not literal</p>}
              <p style={styles.exampleEn}>{phraseResult.meaning}</p>
              {phraseResult.meaningEs && <p style={styles.translationText}>{phraseResult.meaningEs}</p>}
              {phraseResult.meaning && !phraseResult.meaning.startsWith("Couldn't") && (
                <button
                  style={styles.smallAddBtn2}
                  onClick={() => {
                    setForm((f) => ({ ...f, word: phraseText.trim() }));
                    setPhraseText("");
                    setPhraseResult(null);
                    setActiveTab("add");
                  }}
                >
                  <Plus size={13} /> Add this phrase to my map
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {selected && (() => {
        const w = data.nodes[selected];
        if (!w) return null;
        const st = status(w.id);
        const examples = allExamplesFor(w.id);
        const hasOwnImages = w.images && w.images.length > 0;
        return (
          <div style={styles.panelOverlay} onClick={() => setSelected(null)}>
            <div style={styles.panel} onClick={(e) => e.stopPropagation()}>
              <button style={styles.closeBtn} onClick={() => setSelected(null)}>
                <X size={18} color="#9aa7ad" />
              </button>

              {hasOwnImages ? (
                <div style={styles.gallery}>
                  {w.images.map((src, i) => (
                    <img key={i} src={src} alt={w.en} style={styles.galleryImg} />
                  ))}
                </div>
              ) : (
                <button style={styles.findImgBtn} onClick={() => searchImagesForNode(w.id, w.en, w.cat, w.def)} disabled={imgSearching}>
                  {imgSearching ? <Loader2 size={15} className="spin" /> : <CategoryIcon cat={w.cat} size={20} />}
                  {imgSearching ? "Searching…" : "Find images"}
                </button>
              )}

              {editingWord ? (
                <>
                  <label style={styles.label}>Word</label>
                  <input style={styles.input} value={editForm.en} onChange={(e) => setEditForm((f) => ({ ...f, en: e.target.value }))} />
                  <label style={styles.label}>Definition</label>
                  <input style={styles.input} value={editForm.def} onChange={(e) => setEditForm((f) => ({ ...f, def: e.target.value }))} />
                  <label style={styles.label}>Spanish translation</label>
                  <input style={styles.input} value={editForm.defEs} onChange={(e) => setEditForm((f) => ({ ...f, defEs: e.target.value }))} />
                  <label style={styles.label}>Category</label>
                  <input style={styles.input} value={editForm.cat} onChange={(e) => setEditForm((f) => ({ ...f, cat: e.target.value }))} />
                  <div style={styles.editActionsRow}>
                    <button style={styles.learnBtn} onClick={() => { saveWordEdit(w.id, editForm); setEditingWord(false); }}>
                      Save changes
                    </button>
                    <button style={styles.tab} onClick={() => setEditingWord(false)}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={styles.wordHeaderRow}>
                    <span style={{ ...styles.catTag, color: colorFor(w.cat), borderColor: colorFor(w.cat) }}>
                      {w.cat}
                    </span>
                    <div style={styles.wordHeaderActions}>
                      <button style={styles.iconBtn} onClick={() => { setEditForm({ en: w.en, def: w.def, defEs: w.defEs || "", cat: w.cat }); setEditingWord(true); }}>
                        <Pencil size={14} />
                      </button>
                      <button style={deleteConfirm ? styles.iconBtnDanger : styles.iconBtn} onClick={() => (deleteConfirm ? deleteWord(w.id) : setDeleteConfirm(true))}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {deleteConfirm && (
                    <p style={styles.genError}>
                      Tap the trash icon again to permanently delete "{w.en}" — this can't be undone.{" "}
                      <span style={{ textDecoration: "underline", cursor: "pointer" }} onClick={() => setDeleteConfirm(false)}>Cancel</span>
                    </p>
                  )}
                  <div style={styles.wordRow}>
                    <h2 style={styles.panelWord}>{w.en}</h2>
                    <button style={styles.speakBtn} onClick={() => speak(w.en)}><Volume2 size={17} /></button>
                  </div>
                  <ClickableDefinition
                    text={w.def}
                    style={styles.panelDef}
                    onWordTap={(word) => { setForm((f) => ({ ...f, word })); setActiveTab("add"); }}
                  />
                  <p style={styles.tapHint}>tap any word above to add it too</p>
                  {w.defEs && data.level === "beginner" && (
                    <p style={styles.translationText}>{w.defEs}</p>
                  )}
                  {w.defEs && data.level === "intermediate" && (
                    showTranslation ? (
                      <p style={styles.translationText} onClick={() => setShowTranslation(false)}>{w.defEs}</p>
                    ) : (
                      <button style={styles.translateBtn} onClick={() => setShowTranslation(true)}>🇪🇸 tap to translate</button>
                    )
                  )}
                </>
              )}
              {!editingWord && (() => {
                const ex = examples[Math.min(exampleIdx, examples.length - 1)];
                return (
                  <div style={styles.exampleBox}>
                    <p style={styles.exampleEn}>{ex.sentence}</p>
                    <div style={styles.exampleFooter}>
                      {ex.mine ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <p style={styles.mineNote}>✎ your example</p>
                          <button style={styles.removeImgBtn2} onClick={() => removeUserExample(w.id, ex.sentence)}><X size={11} /></button>
                        </div>
                      ) : ex.other ? (
                        <p style={styles.bridgeNote}>connects to “{data.nodes[ex.other]?.en || ex.other}”</p>
                      ) : <span />}
                      {examples.length > 1 && (
                        <div style={styles.examplePager}>
                          <button style={styles.pagerBtn} onClick={() => setExampleIdx((i) => (i - 1 + examples.length) % examples.length)}>‹</button>
                          <span style={styles.pagerCount}>{exampleIdx + 1}/{examples.length}</span>
                          <button style={styles.pagerBtn} onClick={() => setExampleIdx((i) => (i + 1) % examples.length)}>›</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
              {st === "learned" ? (
                <>
                  <div style={styles.learnedTag}>
                    <Check size={16} color="#6FBF8B" /> Already learned
                  </div>

                  <label style={styles.label}>Try it — write your own sentence with "{w.en}"</label>
                  <input
                    style={styles.input}
                    value={sentenceInput}
                    onChange={(e) => { setSentenceInput(e.target.value); setCheckResult(null); setSavedExample(false); }}
                    placeholder={`e.g. I ${w.en} ...`}
                  />
                  <button
                    style={styles.genBtn}
                    disabled={!sentenceInput.trim() || checking}
                    onClick={async () => {
                      setChecking(true);
                      try {
                        const result = await checkSentence(w.en, sentenceInput.trim());
                        setCheckResult(result);
                      } catch (e) {
                        setCheckResult({ correct: false, corrected: "", note: `Couldn't check that: ${e.message || e}` });
                      }
                      setChecking(false);
                    }}
                  >
                    {checking ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                    {checking ? "Checking…" : "Check my sentence"}
                  </button>
                  {checking && <p style={styles.formHint}>The free tier can take up to 30–40s when it's busy — hang tight.</p>}
                  {checkResult && (
                    <div style={styles.exampleBox}>
                      {checkResult.correct ? (
                        <p style={{ ...styles.exampleEn, color: "#6FBF8B" }}>✓ Correct as written!</p>
                      ) : (
                        <p style={styles.exampleEn}>{checkResult.corrected}</p>
                      )}
                      <p style={styles.bridgeNote}>{checkResult.note}</p>
                      {checkResult.corrected !== undefined && checkResult.note && !checkResult.note.startsWith("Couldn't check") && (
                        savedExample ? (
                          <p style={styles.mineNote}>✓ Added to your examples</p>
                        ) : (
                          <button
                            style={styles.smallAddBtn2}
                            onClick={() => {
                              addUserExample(w.id, checkResult.correct ? sentenceInput.trim() : checkResult.corrected);
                              setSavedExample(true);
                            }}
                          >
                            <Plus size={13} /> Add to my examples
                          </button>
                        )
                      )}
                    </div>
                  )}
                </>
              ) : (() => {
                const learnedBridge = bridgesFor(w.id).find((b) => learnedSet.has(b.other));
                const connectedWord = learnedBridge ? data.nodes[learnedBridge.other]?.en : null;
                return (
                  <>
                    <label style={styles.label}>
                      {connectedWord
                        ? `Unlock it — write a sentence using both "${w.en}" and "${connectedWord}"`
                        : `Unlock it — write a sentence using "${w.en}"`}
                    </label>
                    <input
                      style={styles.input}
                      value={sentenceInput}
                      onChange={(e) => { setSentenceInput(e.target.value); setCheckResult(null); }}
                      placeholder={connectedWord ? `e.g. I ${w.en} ... ${connectedWord} ...` : `e.g. I ${w.en} ...`}
                      disabled={!!checkResult}
                    />
                    {!checkResult ? (
                      <button
                        style={styles.genBtn}
                        disabled={!sentenceInput.trim() || checking}
                        onClick={async () => {
                          setChecking(true);
                          try {
                            const result = connectedWord
                              ? await checkConnectionSentence(w.en, connectedWord, sentenceInput.trim())
                              : await checkSentence(w.en, sentenceInput.trim());
                            setCheckResult(result);
                            addUserExample(w.id, result.correct ? sentenceInput.trim() : result.corrected);
                          } catch (e) {
                            setCheckResult({ correct: false, corrected: "", note: `Couldn't check that: ${e.message || e}` });
                          }
                          setChecking(false);
                        }}
                      >
                        {checking ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                        {checking ? "Checking…" : "Check my sentence"}
                      </button>
                    ) : (
                      <div style={styles.exampleBox}>
                        {connectedWord && checkResult.usesBoth === false && (
                          <p style={styles.genError}>Try to include "{connectedWord}" too — here's an example:</p>
                        )}
                        {checkResult.correct ? (
                          <p style={{ ...styles.exampleEn, color: "#6FBF8B" }}>✓ Correct as written!</p>
                        ) : (
                          <p style={styles.exampleEn}>{checkResult.corrected}</p>
                        )}
                        <p style={styles.bridgeNote}>{checkResult.note}</p>
                      </div>
                    )}
                    {checking && <p style={styles.formHint}>The free tier can take up to 30–40s when it's busy — hang tight.</p>}

                    {checkResult && (
                      <button style={styles.learnBtn} onClick={() => markLearned(w.id)}>
                        Mark as learned <ChevronRight size={16} />
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        );
      })()}

    </div>
  );
}

/* ---------- Styles ---------- */
const styles = {
  app: {
    fontFamily: "'Georgia', 'Iowan Old Style', serif",
    background: "#12181b",
    minHeight: "100vh",
    color: "#eae4d8",
    padding: "20px 16px 32px",
    boxSizing: "border-box",
    maxWidth: 900,
    margin: "0 auto",
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  tabBar: { display: "flex", gap: 6, marginBottom: 14, borderBottom: "1px solid #232d32", paddingBottom: 10 },
  moreMenu: { position: "absolute", top: "110%", right: 0, background: "#1c2530", border: "1px solid #2f3b42", borderRadius: 10, padding: 6, zIndex: 20, minWidth: 130, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" },
  moreMenuItem: { display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: "#eae4d8", padding: "8px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "inherit" },
  tab: { flex: 1, background: "transparent", border: "1px solid #2f3b42", color: "#8a9490", borderRadius: 20, padding: "8px 6px", fontSize: 12.5, cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  tabActive: { flex: 1, background: "#2a3a3d", border: "1px solid #6FBF8B", color: "#9fd9b8", borderRadius: 20, padding: "8px 6px", fontSize: 12.5, cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  section: { background: "#1c2530", border: "1px solid #2f3b42", borderRadius: 14, padding: "18px 18px 22px" },
  upcomingBox: { marginTop: 20, paddingTop: 16, borderTop: "1px solid #2f3b42" },
  upcomingRow: { display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 },
  upcomingWord: { color: "#eae4d8", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  sectionTitle: { fontSize: 20, margin: "0 0 8px", fontWeight: 600 },
  sectionBody: { fontSize: 13.5, color: "#b7c2be", lineHeight: 1.5, margin: "0 0 16px" },
  onboardWrap: { maxWidth: 420, margin: "60px auto 0", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  onboardOption: { width: "100%", textAlign: "left", background: "#1c2530", border: "1px solid #2f3b42", color: "#eae4d8", borderRadius: 10, padding: "13px 16px", fontSize: 14, cursor: "pointer", fontFamily: "inherit", marginTop: 10 },
  onboardOptionPicked: { width: "100%", textAlign: "left", background: "#2a3a3d", border: "1px solid #6FBF8B", color: "#9fd9b8", borderRadius: 10, padding: "13px 16px", fontSize: 14, cursor: "pointer", fontFamily: "inherit", marginTop: 10 },
  translationText: { fontSize: 13.5, color: "#8cc9d9", fontStyle: "italic", margin: "2px 0 14px", cursor: "pointer" },
  translateBtn: { background: "none", border: "1px dashed #2f3b42", color: "#8cc9d9", borderRadius: 8, padding: "5px 10px", fontSize: 11.5, cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", margin: "2px 0 14px" },
  levelSelect: { display: "block", marginTop: 6, background: "#1c2530", border: "1px solid #2f3b42", color: "#8a9490", borderRadius: 6, fontSize: 10.5, padding: "3px 5px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  headerLeft: { display: "flex", gap: 10, alignItems: "flex-start" },
  title: { fontSize: 26, margin: 0, fontWeight: 600, letterSpacing: 0.3 },
  subtitle: { margin: "2px 0 0", fontSize: 12.5, color: "#8a9490", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontStyle: "italic" },
  progress: { textAlign: "right", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  progressNum: { fontSize: 20, color: "#6FBF8B" },
  progressDen: { fontSize: 12, color: "#8a9490" },
  legendRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" },
  legend: { display: "flex", flexWrap: "wrap", gap: 12, fontSize: 11.5, color: "#9aa7ad", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  legendItem: { display: "flex", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: "50%", display: "inline-block" },
  addBtn: { display: "flex", alignItems: "center", gap: 5, background: "#1c2530", border: "1px solid #2f3b42", color: "#eae4d8", borderRadius: 20, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  svg: { width: "100%", height: "auto", maxHeight: "72vh", borderRadius: 14, border: "1px solid #232d32", touchAction: "none", display: "block", userSelect: "none", WebkitUserSelect: "none" },
  canvasWrap: { position: "relative" },
  zoomControls: { position: "absolute", bottom: 14, right: 14, display: "flex", flexDirection: "column", gap: 6 },
  zoomBtn: { width: 32, height: 32, borderRadius: 8, background: "#1c2530", border: "1px solid #2f3b42", color: "#eae4d8", fontSize: 17, cursor: "pointer", lineHeight: "1" },
  zoomBtnReset: { padding: "4px 8px", borderRadius: 8, background: "#1c2530", border: "1px solid #2f3b42", color: "#8a9490", fontSize: 10, cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  nodeLabel: { fontSize: 11, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  hint: { fontSize: 12, color: "#71807d", marginTop: 12, textAlign: "center", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  panelOverlay: { position: "fixed", inset: 0, background: "rgba(10,14,16,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 },
  panel: { background: "#1c2530", borderTop: "1px solid #2f3b42", borderRadius: "16px 16px 0 0", padding: "22px 22px 28px", width: "100%", maxWidth: 480, position: "relative", boxShadow: "0 -8px 30px rgba(0,0,0,0.4)", maxHeight: "88vh", overflowY: "auto" },
  closeBtn: { position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer" },
  panelImg: { width: "100%", height: 150, objectFit: "cover", borderRadius: 10, marginBottom: 12 },
  gallery: { display: "flex", gap: 8, overflowX: "auto", marginBottom: 4, paddingBottom: 4 },
  galleryImg: { width: 140, height: 110, objectFit: "cover", borderRadius: 10, flex: "0 0 auto" },
  reviewBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", background: "#2a3a3d", border: "1px solid #3d504f", color: "#9fd9b8", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 },
  gradeRow: { display: "flex", gap: 6, marginTop: 10 },
  gradeAgain: { flex: 1, background: "#3d2a2a", border: "1px solid #5a3a3a", color: "#d98c8c", borderRadius: 8, padding: "10px 6px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" },
  gradeHard: { flex: 1, background: "#3d372a", border: "1px solid #5a4f3a", color: "#d9b98c", borderRadius: 8, padding: "10px 6px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" },
  gradeGood: { flex: 1, background: "#2a3d2f", border: "1px solid #3a5a42", color: "#8cd9a0", borderRadius: 8, padding: "10px 6px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" },
  gradeEasy: { flex: 1, background: "#2a3a3d", border: "1px solid #3a5259", color: "#8cc9d9", borderRadius: 8, padding: "10px 6px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" },
  panelImgFallback: { width: "100%", height: 90, borderRadius: 10, marginBottom: 12, background: "#12181b", display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed #2f3b42" },
  findImgBtn: { width: "100%", height: 70, borderRadius: 10, marginBottom: 12, background: "#12181b", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, border: "1px dashed #2f3b42", color: "#8a9490", fontSize: 12.5, cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  removeImgBtn: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(18,24,27,0.85)", border: "none", color: "#eae4d8", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  removeImgBtn2: { width: 16, height: 16, borderRadius: "50%", background: "#2a3a3d", border: "none", color: "#8a9490", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  catTag: { fontSize: 10.5, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", border: "1px solid", borderRadius: 20, padding: "2px 9px", display: "inline-block" },
  wordHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  wordHeaderActions: { display: "flex", gap: 8 },
  iconBtn: { background: "#1c2530", border: "1px solid #2f3b42", color: "#8a9490", borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  iconBtnDanger: { background: "#3d2a2a", border: "1px solid #5a3a3a", color: "#d98c8c", borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  wordRow: { display: "flex", alignItems: "center", gap: 10 },
  speakBtn: { background: "none", border: "1px solid #2f3b42", color: "#9fd9b8", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  editActionsRow: { display: "flex", gap: 8, marginTop: 8 },
  panelWord: { fontSize: 28, margin: "10px 0 0", fontWeight: 600 },
  panelDef: { fontSize: 14.5, color: "#b7c2be", margin: "4px 0 14px" },
  tapHint: { fontSize: 10, color: "#5a6763", margin: "-10px 0 14px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  exampleBox: { background: "#12181b", borderRadius: 10, padding: "12px 14px", marginBottom: 18, borderLeft: "3px solid #6FBF8B" },
  exampleEn: { margin: 0, fontSize: 14.5, color: "#eae4d8" },
  bridgeNote: { margin: "6px 0 0", fontSize: 11.5, color: "#D9A441", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  mineNote: { margin: "8px 0 0", fontSize: 11.5, color: "#8cc9d9", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  smallAddBtn2: { marginTop: 10, display: "flex", alignItems: "center", gap: 6, background: "#2a3a3d", border: "1px solid #3d504f", color: "#9fd9b8", borderRadius: 8, padding: "7px 11px", fontSize: 12, cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  exampleFooter: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  examplePager: { display: "flex", alignItems: "center", gap: 8 },
  pagerBtn: { background: "none", border: "1px solid #2f3b42", color: "#eae4d8", borderRadius: 6, width: 24, height: 24, fontSize: 15, cursor: "pointer", lineHeight: "1", display: "flex", alignItems: "center", justifyContent: "center" },
  pagerCount: { fontSize: 10.5, color: "#71807d", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  learnedTag: { display: "flex", alignItems: "center", gap: 8, color: "#6FBF8B", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 },
  learnBtn: { width: "100%", background: "#6FBF8B", color: "#12181b", border: "none", borderRadius: 10, padding: "13px 16px", fontSize: 14.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", fontFamily: "inherit", marginTop: 6 },
  formHint: { fontSize: 12, color: "#71807d", margin: "4px 0 16px" },
  lookupBox: { background: "#12181b", border: "1px dashed #2f3b42", borderRadius: 10, padding: 14, marginBottom: 20 },
  lookupDivider: { height: 1, background: "#232d32", margin: "24px 0" },
  lookupResult: { display: "block", width: "100%", textAlign: "left", background: "#1c2530", border: "1px solid #2f3b42", borderRadius: 8, padding: "9px 12px", marginTop: 8, cursor: "pointer", fontFamily: "inherit" },
  lookupWord: { color: "#eae4d8", fontSize: 15, fontWeight: 600, display: "block" },
  lookupWhy: { color: "#8a9490", fontSize: 11.5, display: "block", marginTop: 2 },
  genBtn: { width: "100%", background: "#2a3a3d", border: "1px solid #3d504f", color: "#9fd9b8", borderRadius: 10, padding: "11px 14px", fontSize: 13.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, cursor: "pointer", fontFamily: "inherit", marginTop: 14 },
  genError: { fontSize: 12, color: "#d98c8c", margin: "8px 0 0" },
  imgCredit: { fontSize: 10.5, color: "#66746f", margin: "4px 0 0", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  label: { display: "block", fontSize: 11.5, color: "#8a9490", marginTop: 12, marginBottom: 4, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  input: { width: "100%", boxSizing: "border-box", background: "#12181b", border: "1px solid #2f3b42", borderRadius: 8, padding: "9px 10px", color: "#eae4d8", fontSize: 14, fontFamily: "inherit" },
  connRow: { display: "flex", gap: 8, alignItems: "center", marginBottom: 8 },
  connCheckLabel: { display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto", fontSize: 13, color: "#c9a4d9", whiteSpace: "nowrap" },
  connWord: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  inputSmall: { flex: 1, boxSizing: "border-box", background: "#12181b", border: "1px solid #2f3b42", borderRadius: 8, padding: "7px 9px", color: "#eae4d8", fontSize: 12.5, fontFamily: "inherit" },
  smallAddBtn: { flex: "0 0 auto", background: "#2a3a3d", border: "1px solid #3d504f", color: "#9fd9b8", borderRadius: 8, padding: "7px 9px", cursor: "pointer" },
};
