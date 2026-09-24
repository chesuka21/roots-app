import PracticeTab from "./components/PracticeTab.jsx";
import { useState, useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { Sprout, X, Check, ChevronLeft, ChevronRight, Plus, Sparkles, Loader2, Layers, BookOpen, Utensils, Smile, Briefcase, TreePine, Shapes, Volume2, Pencil, Trash2, Settings, Map as MapIcon, Search, RotateCcw, Flame, Waves, Repeat, BookA, Quote, Play } from "lucide-react";
import { lookupLocalWord, wordsByCategory, WORDBANK_EN } from "./data/wordbank.js";
import { fillFrame, buildDrills, parseUserFrame, frameToText, autoLevel as patternAutoLevel, PATTERN_LEVELS, SLOT_POOLS, SEED_PATTERNS } from "./data/patterns.js";

/* ---------- AI + image helpers — call our own /api/* serverless
   functions (see /api/claude.js and /api/pexels.js) so the Groq/Gemini and
   Unsplash API keys stay on the server and never reach the browser. ---------- */
/* Cache de respuestas IA en memoria + localStorage: si ya pediste "deadline",
   no se gasta otro request ni otros tokens. Clave para velocidad y costo. */
const AI_CACHE_KEY = "roots-ai-cache-v2"; // v2: la v1 se envenenó con respuestas truncadas — se invalida entera
const aiMemCache = new Map();
// La clave es un hash del prompt COMPLETO: en v1 se usaban solo los primeros
// 200 caracteres y prompts distintos (ej. corregir dos oraciones diferentes)
// colisionaban y devolvían la respuesta de OTRA petición → "is not valid JSON".
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
    // cap simple: max ~200 entradas para no llenar localStorage
    const keys = Object.keys(obj);
    if (keys.length > 200) delete obj[keys[0]];
    localStorage.setItem(AI_CACHE_KEY, JSON.stringify(obj));
  } catch (e) { /* storage lleno — ignorar */ }
}
async function callClaude(prompt, max_tokens, attempt = 1, skipCache = false, force = null) {
  // v3: backend responde en <8s (límite Vercel Hobby 10s).
  // Un solo reintento rápido en error de red; sin esperas de 45s ni 3 reintentos.
  // `force` ("groq"|"gemini") obliga a un proveedor (para reintentos con otro modelo).
  const ck = force ? `${prompt}|force:${force}` : prompt;
  const hit = skipCache ? null : aiCacheGet(ck);
  if (hit) return hit;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000); // el cold start de Vercel + modelo pesado puede tardar 10-20s la primera vez
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
    // reintento rápido si la red o el cold start de Vercel corta la conexión
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 800));
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
  if (!data) {
    // El backend respondió algo que no es JSON (p. ej. HTML de un deploy caído)
    throw new Error("El servidor no respondió JSON — revisa tu conexión o el deploy.");
  }
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  const clean = text.replace(/```json|```/g, "").trim();
  if (!skipCache) aiCacheSet(ck, clean);
  return clean;
}

/* JSON tolerante + reparación + reintento multi-proveedor.
   Causa real de los fallos: el modelo 8B a veces mete comillas dobles sin
   escapar dentro de los valores (ej. en "sentence") o deja comas colgantes,
   y eso rompe JSON.parse aunque el texto "parezca" JSON. */
function repairJson(t) {
  let s = String(t || "").replace(/```json|```/g, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  s = s.replace(/,\s*([}\]])/g, "$1"); // comas colgantes: {"a":1,} → {"a":1}
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ""); // controles literales
  s = s.replace(/\n/g, " "); // saltos de línea literales dentro de strings
  return s;
}
function extractJson(text) {
  const t = String(text || "").trim();
  try { return JSON.parse(t); } catch (e) { /* intentar reparación abajo */ }
  try { return JSON.parse(repairJson(t)); } catch (e) { /* reintentar fuera */ }
  // último intento: arreglo brackets/braces desbalanceados (la IA a veces no los cierra)
  let s = repairJson(t);
  // arreglo de strings: si está truncado a mitad, cerramos la cadena actual
  const braceCount = (s.match(/\{/g) || []).length - (s.match(/\}/g) || []).length;
  if (braceCount > 0) s += "}".repeat(braceCount);
  const bracketCount = (s.match(/\[/g) || []).length - (s.match(/\]/g) || []).length;
  if (bracketCount > 0) s += "]".repeat(bracketCount);
  try { return JSON.parse(s); } catch (e) { /* nada más que hacer */ }
  throw new Error("La IA devolvió un formato inválido — intenta de nuevo.");
}
// Regla extra que se añade solo en los reintentos (no gasta tokens en el intento normal)
const STRICT_JSON = `\n\nSTRICT OUTPUT RULES: respond with ONLY valid JSON (no markdown, no commentary). Never put double-quote characters (") inside any string value — use single quotes (') if you must quote a word. Close every bracket and brace.`;
async function callClaudeJson(prompt, max_tokens) {
  try {
    return extractJson(await callClaude(prompt, max_tokens));
  } catch (e1) {
    // 2º intento: mismo proveedor, en fresco (sin cache) + regla estricta
    try {
      return extractJson(await callClaude(prompt + STRICT_JSON, max_tokens, 1, true));
    } catch (e2) {
      // 3er intento: OTRO proveedor (Gemini piensa distinto y suele formatear mejor)
      // ...pero si Gemini está en quota (es free con 5 req/día), probamos Groq/OpenRouter
      try {
        return extractJson(await callClaude(prompt + STRICT_JSON, max_tokens, 1, true, "gemini"));
      } catch (e3) {
        if (/quota|429|resource/i.test(e3.message)) return extractJson(await callClaude(prompt + STRICT_JSON, max_tokens, 1, true, "openrouter"));
        throw e3;
      }
    }
  }
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
  // + enviamos `word` aparte para reforzar el resultado en el backend
  const parts = [word, category, keywordsFromDefinition(definition)].filter(Boolean);
  const query = parts.join(" ");
  try {
    const res = await fetch(`/api/pexels?q=${encodeURIComponent(query)}&word=${encodeURIComponent(word)}`);
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
  return callClaudeJson(prompt, 400);
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

/* Ajustes de voz (rueda de configuración ⚙): persisten en localStorage y
   aplican a TODA la app — cada speak() los lee si no recibe opts explícitos. */
const SETTINGS_KEY = "roots-settings-v1";
const VOICES = [
  { id: "en-US-AriaNeural", label: "Aria — mujer, EE.UU. (recomendada)" },
  { id: "en-US-JennyNeural", label: "Jenny — mujer, EE.UU. expresiva" },
  { id: "en-US-GuyNeural", label: "Guy — hombre, EE.UU." },
  { id: "en-US-ChristopherNeural", label: "Christopher — hombre, EE.UU. grave" },
  { id: "en-US-EmmaMultilingualNeural", label: "Emma — multilingüe (futura)" },
];
const DEFAULT_SETTINGS = { voice: "en-US-AriaNeural", rate: -5 };
function loadVoiceSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) { /* primera vez — defaults */ }
  return { ...DEFAULT_SETTINGS };
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
  // opts: { voice, rate } — si no vienen, se usan los de Ajustes (⚙).
  const saved = loadVoiceSettings();
  const voice = opts.voice || saved.voice;
  const rate = opts.rate ?? saved.rate;
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
  return callClaudeJson(prompt, 400);
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
  return callClaudeJson(prompt, 400);
}

async function suggestWordsForProfile(profile, existingWords) {
  const existingList = existingWords.map((w) => w.en).join(", ");
  const withInterests = profileInterestsLabel(profile);
  const context = [profile?.job && `works as / studies: ${profile.job}`, withInterests && `interests: ${withInterests}`]
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
  return callClaudeJson(prompt, 500);
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
- "connections": pick between 2 and 5 words FROM THE EXISTING LIST ABOVE that "correctedWord" is naturally related to in meaning or everyday use — not just words that share a category. A word can relate to ideas from more than one topic (e.g. "shelf" fits both "home" and "school"). The more genuine connections you find, the better — a richly connected network helps the learner review old words while learning new ones. For each connection, write one short natural English sentence using both "correctedWord" and that existing word together, spelled correctly. Only return fewer than 2 if the existing list is very small or truly nothing relates well.
- Never use double-quote characters (") inside any value — use single quotes (') if you need to quote a word.`;

  return callClaudeJson(prompt, 1000);
  }

  /* Búsqueda/conexiones con el diccionario local (ahorro de tokens):
     si la palabra está en el banco offline, la definición, la traducción y la
     categoría salen de ahí (sin llamar a la IA); solo las conexiones a palabras
     ya aprendidas se piden a la IA (prompt corto → pocos tokens). */
  async function generateConnections(word, correctedWord, existingWords) {
    const wordList = existingWords.map((w) => w.en).join(", ");
    const prompt = `For the word "${correctedWord}", 2 to 5 words FROM THIS EXISTING LIST relate naturally in meaning or everyday use: ${wordList || "(none yet)"}\n\nReturn ONLY valid JSON: {"connections":[{"word":"<one existing word from the list>","sentence":"<a short natural English sentence using both ${correctedWord} and that word>"}]}\nRules: pick the most genuinely connected words, spell them exactly as in the list, keep sentences short and simple. Never use double quotes inside a value — use single quotes.`;
    return callClaudeJson(prompt, 350);
  }
  // Devuelve { details, fromLocal } donde details tiene la forma esperada por runGenerate.
  async function generateWordDetailsSmart(word, existingWords) {
    const local = lookupLocalWord(word);
    const byName = {};
    existingWords.forEach((w) => (byName[w.en.toLowerCase()] = w.id));
    const connToForm = (list) =>
      (list || [])
        .map((c) => ({ targetId: byName[(c.word || "").toLowerCase()], sentence: c.sentence, checked: true }))
        .filter((c) => c.targetId);
    if (local) {
      // Caso ideal: definición/ES/categoría del banco local. Solo conexiones → IA corta.
      let connections = [];
      try {
        const res = await generateConnections(word, local.en, existingWords);
        connections = connToForm(res.connections);
      } catch (e) { /* sin conexiones IA — se queda vacío, el usuario añade manualmente */ }
      return {
        fromLocal: true,
        details: {
          correctedWord: local.en,
          definition: local.def,
          definitionEs: local.defEs,
          category: local.cat,
          connections,
        },
      };
    }
    // No está en el banco (palabra poco común / técnica) → flujo IA completo.
    const full = await generateWordDetails(word, existingWords);
        return { fromLocal: false, details: full };
      }

    // Umbral de repasos para "merecer" sinónimos/antónimos (evita llamadas IA prematuras).
    const SYNONYM_REVIEW_THRESHOLD = 3;
    async function fetchSynonymsAntonyms(word) {
      const prompt = `A learner has now reviewed the word "${word}" several times and wants to expand it. Give its most useful synonyms and antonyms.
    Return ONLY valid JSON, no markdown: {"synonyms":["...","...","..."],"antonyms":["...","...","..."]}
    Rules: 3 synonyms and up to 3 antonyms (if there is no natural antonym, use an empty array). All lowercase, single common words. Never use double quotes inside a value — use single quotes.`;
      return callClaudeJson(prompt, 300);
    }

    /* Crecimiento de la red: palabras afines al aprender/ver una palabra.
       Parte 1 — LOCAL y compartida (0 tokens): mismo tema/categoría desde el
       banco offline y desde los nodos ya en el grafo (como math → study/exam). */
    function relatedSuggestionsLocal(nodes, learned, id) {
      const node = nodes[id];
      if (!node) return [];
      const cat = node.cat;
      const learnedSet = new Set(learned || []);
      const knownLower = new Set(Object.keys(nodes).map((k) => k.toLowerCase()));
      const res = [];
      for (const w of Object.values(WORDBANK_EN)) {
        if (!w || !w.en) continue;
        if (learnedSet.has(w.en) || knownLower.has(w.en.toLowerCase())) continue;
        if (w.cat === cat) res.push({ word: w.en.toLowerCase(), why: `same theme: ${cat}` });
      }
      for (const n of Object.values(nodes)) {
        if (!n || n.id === id || learnedSet.has(n.id)) continue;
        if (n.cat === cat) res.push({ word: n.id, why: `related to ${node.en} (${cat})` });
      }
      const seen = new Set();
      const out = [];
      for (const s of res) {
        if (seen.has(s.word)) continue;
        seen.add(s.word);
        out.push(s);
        if (out.length >= 5) break;
      }
      return out;
    }

    /* Parte 2 — IA (cacheada) para sugerencias más inteligentes y temáticas. */
    async function fetchRelatedWords(word, category, existingList) {
      const prompt = `For a learner at the word "${word}" (theme: ${category || "general"}), suggest 4 nearby words in meaning, theme or everyday use — like a word network. Prefer common single words (e.g. for "math": sum, subtract, number, equation).
    Do NOT repeat any of these existing: ${existingList || "(none)"}.
    Return ONLY valid JSON: {"suggestions":[{"word":"...","why":"..."}]}
    Rules: lowercase words, "why" under 9 words explaining the connection. Never use double quotes inside a value — use single quotes.`;
      return callClaudeJson(prompt, 320);
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

/* ---------- Patrones (aprender estructuras reutilizables) ----------
   Cada patrón repite una estructura (sujeto + verbo) cambiando solo el objeto.
   Ej: "I drink ___ / Yo tomo ___" con agua, café, leche… Todo es local: sin IA,
   sin tokens. La práctica es combinar el patrón con distintas palabras. */
const PATTERNS = [
  { id: "drink", en: "I drink ____", es: "Yo tomo ____", pool: ["water", "juice", "coffee", "tea", "milk"] },
  { id: "eat", en: "I eat ____", es: "Yo como ____", pool: ["bread", "rice", "fruit", "an apple", "fish"] },
  { id: "drinkThey", en: "They drink ____", es: "Ellos toman ____", pool: ["water", "coffee", "milk", "tea", "juice"] },
  { id: "sheLikes", en: "She likes ____", es: "A ella le gusta ____", pool: ["soccer", "music", "cooking", "movies", "travel"] },
  { id: "heLikes", en: "He likes ____", es: "A él le gusta ____", pool: ["soccer", "music", "video games", "reading", "art"] },
  { id: "theyLike", en: "They like ____", es: "A ellos les gusta ____", pool: ["sports", "cooking", "music", "movies", "travel"] },
  { id: "iWant", en: "I want ____", es: "Yo quiero ____", pool: ["coffee", "a break", "water", "help", "time"] },
  { id: "iHave", en: "I have ____", es: "Yo tengo ____", pool: ["a dream", "a plan", "time", "a question", "a feeling"] },
  { id: "iUse", en: "I use ____", es: "Yo uso ____", pool: ["a computer", "a phone", "technology", "water", "paper"] },
  { id: "igoTo", en: "I go to ____", es: "Yo voy a ____", pool: ["school", "work", "the gym", "the beach", "a meeting"] },
  { id: "thisIs", en: "This is ____", es: "Esto es ____", pool: ["the school", "my home", "a tree", "the kitchen", "my job"] },
  { id: "iRead", en: "I read ____", es: "Yo leo ____", pool: ["a book", "books", "a story", "the news", "an email"] },
    { id: "aIf", en: "If I ____, I would ____", es: "Si yo ____, yo ____", tier: 3 },
    { id: "aBeen", en: "I have been ____ for ____", es: "He estado ____ por/durante ____", tier: 3 },
    { id: "aUsedTo", en: "I used to ____", es: "Yo solía ____", tier: 3 },
    { id: "aWish", en: "I wish I had ____", es: "Ojalá tuviera ____", tier: 3 },
    { id: "aLookingFwd", en: "I'm looking forward to ____", es: "Espero con ganas ____", tier: 3 },
    { id: "aDepends", en: "It depends on ____", es: "Depende de ____", tier: 2 },
    { id: "aGoingTo", en: "I'm going to ____ tomorrow", es: "Voy a ____ mañana", tier: 2 },
    ];

    // Dificultad del patrón (progresiva): 1=inicial, 2=intermedio, 3=avanzado.
    function patternTier(p) {
      if (p.tier) return p.tier;
      const s = (p.en || "").toLowerCase();
      if (/if |could |would |been |used to|wish |depends on|looking forward|should |might |must |going to| will /.test(s)) return 3;
      if (/likes|played|listened|worked|studied|yesterday|last |was |were |had /.test(s)) return 2;
      return 1;
    }
    // Nivel máximo de patterns según el nivel de inglés del usuario (progresivo).
        function maxTierForLevel(level) {
          return level === "advanced" ? 3 : level === "intermediate" ? 2 : 1;
        }
        function tierName(t) {
          return t === 3 ? "Avanzado" : t === 2 ? "Intermedio" : "Inicial";
        }

    // Patrones PERSONALIZADOS por interés: se añaden a la biblioteca cuando el
    // interés coincide. La app se personaliza según los gustos del usuario, sin IA.
    const INTEREST_PATTERNS = [
      { match: ["cook", "kitchen", "food", "bake", "culinary"], en: "I cook ____", es: "Yo cocino ____", pool: ["rice", "fish", "a recipe", "dinner", "a meal"] },
      { match: ["cook", "kitchen", "food", "bake"], en: "I add ____ to the dish", es: "Le agrego ____ al plato", pool: ["salt", "sugar", "flavor", "the recipe"] },
      { match: ["soccer", "football", "sport", "sports", "basketball", "tennis"], en: "I play ____", es: "Yo juego ____", pool: ["soccer", "sports", "video games", "music"] },
      { match: ["sport", "sports", "basketball", "tennis"], en: "I watch ____", es: "Yo miro/veo ____", pool: ["soccer", "a match", "a movie", "the news"] },
      { match: ["music", "song", "sing", "guitar"], en: "I listen to ____", es: "Yo escucho ____", pool: ["music", "a song", "the radio", "a band"] },
      { match: ["music", "sing", "guitar", "piano"], en: "I play the ____", es: "Yo toco el/la ____", pool: ["guitar", "piano", "drums", "music"] },
      { match: ["tech", "computer", "coding", "program", "software", "developer"], en: "I use ____ every day", es: "Uso ____ todos los días", pool: ["a computer", "a phone", "technology", "an app"] },
      { match: ["tech", "coding", "program", "software"], en: "I build ____", es: "Yo creo/construyo ____", pool: ["apps", "a program", "software", "a website"] },
      { match: ["movie", "cinema", "film", "tv", "series"], en: "I watch ____", es: "Yo veo ____", pool: ["movies", "a series", "a film", "an episode"] },
      { match: ["video game", "gaming", "games"], en: "I play ____", es: "Yo juego ____", pool: ["video games", "a board game", "soccer"] },
      { match: ["travel", "trip", "beach", "abroad"], en: "I travel to ____", es: "Yo viajo a ____", pool: ["the beach", "another country", "the mountains", "a new city"] },
      { match: ["art", "design", "draw", "paint", "photo"], en: "I draw ____", es: "Yo dibujo ____", pool: ["a picture", "a design", "art", "a drawing"] },
      { match: ["business", "finance", "money", "invest", "startup"], en: "I work in ____", es: "Yo trabajo en ____", pool: ["business", "finance", "a startup", "a bank"] },
      { match: ["read", "book", "literature", "novel"], en: "I read ____", es: "Yo leo ____", pool: ["a book", "novels", "a story", "a chapter"] },
      { match: ["nature", "outdoor", "hike", "garden", "plant"], en: "I love ____", es: "Me encanta ____", pool: ["nature", "the forest", "the river", "outdoor places"] },
    ];
    // Combina los patrones del interés del usuario (arriba) con la biblioteca base.
    function patternsForProfile(interests) {
      const all = interests.map((i) => String(i).toLowerCase());
      const custom = [];
      for (const p of INTEREST_PATTERNS) {
        if (p.match.some((k) => all.some((i) => i.includes(k)))) custom.push(p);
      }
      const known = new Set(PATTERNS.map((p) => p.en));
      for (const c of custom) if (!known.has(c.en)) { PATTERNS.push(c); known.add(c.en); }
      return PATTERNS;
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

/* ---------- Gamificación: racha (streak) + XP + nivel ---------- */
/* Persistencia: dentro del mismo objeto `data` de localStorage (vocab-data),
   bajo la clave `progression`. Diseñado para evolucionar sin romper versiones viejas. */
function initProgression() {
  return {
    xp: 0,                // XP total acumulado
    level: 1,             // nivel derivado del XP
    streak: { current: 0, best: 0, lastActive: null }, // "YYYY-MM-DD" del último día con actividad
    wordExamplesEarned: 0, // nº de oraciones propias ya premiadas con XP (evita doble cobro)
  };
}

// Umbral de XP por nivel (cuadrático suave: nivel n necesita n * 100 XP extra)
function xpForLevel(level) {
  return level * 100;
}
function levelForXp(xp) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level += 1;
  return level;
}
// Progreso dentro del nivel actual: 0..1 para pintar la barra
function levelProgress(xp, level) {
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const intoLevel = xp - base;
  const span = next - base;
  return Math.min(1, Math.max(0, span > 0 ? intoLevel / span : 0));
}

// Actualiza la racha: +1 si retomás hoy o si ayer practicaste; se rompe si hay un hueco.
function bumpStreak(prog) {
  const today = todayKey();
  const last = prog.streak?.lastActive;
  let current = prog.streak?.current || 0;
  if (last === today) {
    // ya registrado hoy — no sube de nuevo
  } else if (last === yesterKey()) {
    current += 1;
  } else {
    current = 1;
  }
  const best = Math.max(prog.streak?.best || 0, current);
  return { ...prog, streak: { current, best, lastActive: today } };
}
function yesterKey() {
  return new Date(Date.now() - DAY_MS).toISOString().slice(0, 10);
}

// Multiplicador por nivel de inglés del usuario (auto-reporte): los avanzados
// merecen más XP por el mismo esfuerzo (sus oraciones son más complejas).
function levelMultiplier(level) {
  return level === "beginner" ? 1 : level === "intermediate" ? 1.5 : 2;
}

// Premios base de XP (antes del multiplicador)
const XP = {
  learnWord: 10,      // memorizar una palabra nueva
  writeExample: 20,   // escribir una oración propia correcta
  reviewAgain: 2,
  reviewHard: 5,
  reviewGood: 10,
  reviewEasy: 15,
};
const XP_REVIEW = { again: XP.reviewAgain, hard: XP.reviewHard, good: XP.reviewGood, easy: XP.reviewEasy };

/* ---------- Perfil: intereses (lista) ---------- */
// Los intereses se guardan como array; se acepta el formato legacy (string
// separado por comas) para no romper datos guardados antes de esta versión.
const PRESET_INTERESTS = ["Cooking", "Soccer", "Music", "Technology", "Movies & TV", "Video games", "Travel", "Fitness", "Art & design", "Business & finance", "Reading", "Nature"];
function normalizeInterests(interests) {
  if (Array.isArray(interests)) return interests.map((s) => String(s).trim()).filter(Boolean);
  if (typeof interests === "string") return interests.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
  return [];
}
function profileInterestsLabel(profile) {
  if (!profile) return "";
  return normalizeInterests(profile.interests).join(", ");
}

/* Botón de voz reutilizable para definiciones y ejemplos (inline, discreto). */
function SpeakInline({ text, size = 13 }) {
  if (!text) return null;
  return (
    <button style={styles.speakInline} title="Escuchar" onClick={() => speak(text)}>
      <Volume2 size={size} />
    </button>
  );
}

// "Calidad" de una oración escrita por el usuario — determina cuánto XP extra
// da escribir un buen ejemplo (tu idea: "voy a bañarme" vale menos que
// "voy a proceder a ir al baño y tomarme una ducha"). Se mide por longitud y
// variedad léxica, SIN llamar a la IA (instantáneo y gratis).
function analyzeSentenceQuality(sentence) {
  const s = String(sentence || "").trim();
  if (!s) return { words: 0, unique: 0, score: 0 };
  const words = s.toLowerCase().replace(/[^a-z0-9áéíóúüñ'\s-]/gi, " ").split(/\s+/).filter(Boolean);
  const unique = new Set(words);
  // score local 0..1: combina longitud (más palabras = más elaborado) y
  // riqueza léxica (más palabras distintas = no repite "y... y... y...").
  const lengthScore = Math.min(1, words.length / 12);       // 12+ palabras = puntaje completo
  const varietyScore = Math.min(1, unique.size / 8);        // 8+ palabras distintas = completo
  return { words: words.length, unique: unique.size, score: Math.round((lengthScore * 0.5 + varietyScore * 0.5) * 100) / 100 };
}
// Bono de XP por calidad: 0..15 XP según qué tan elaborada es la oración.
function sentenceQualityBonus(sentence) {
  const { score } = analyzeSentenceQuality(sentence);
  return Math.round(score * 15);
}

function earnXp(prog, amount) {
  const xp = (prog.xp || 0) + amount;
  const level = levelForXp(xp);
  return { ...prog, xp, level };
}

async function checkSentence(word, sentence) {
  const prompt = `A beginner English learner wrote this sentence using the word "${word}":
"${sentence}"

Return ONLY valid JSON, no markdown fences, no extra text, in exactly this shape:
{"correct": true or false, "corrected": "...", "note": "..."}

Rules:
- "correct": true if the sentence is natural and grammatically fine as written, false otherwise.
- "corrected": the most natural correct version of the sentence (if it was already correct, repeat it unchanged).
- "note": one short, encouraging sentence in simple English explaining what changed and why (or confirming it was correct). Under 20 words.
- Never use double-quote characters (") inside any value — use single quotes (') if you need to quote a word.`;
  return callClaudeJson(prompt, 500);
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
- "note": one short, encouraging sentence in simple English — if they missed one of the words, gently say so; otherwise explain what changed or confirm it was correct. Under 20 words.
- Never use double-quote characters (") inside any value — use single quotes (') if you need to quote a word.`;
  return callClaudeJson(prompt, 500);
  }

  /* Corrector de la frase que el usuario escribe para practicar un patrón.
     El alumno es el autor: escribe su propia oración y la IA solo ayuda a
     corregirla/mejorarla (no la genera). Cacheable vía callClaudeJson. */
  async function checkPattern(sentence) {
    const prompt = `A learner wrote an English sentence to practice a sentence pattern: "${sentence}".
  They are the author — help polish, don't replace their idea. If it's natural and correct, say so.
  Return ONLY valid JSON: {"correct":true or false,"corrected":"...","note":"..."}
  Rules:
  - "correct": true if natural and grammatically fine as written.
  - "corrected": the most natural correct version (repeat the sentence unchanged if already correct; keep their idea).
  - "note": one short, encouraging sentence in simple English, under 20 words.
  - Never use double-quote characters (") inside any value — use single quotes.`;
    return callClaudeJson(prompt, 400);
  }


  const STORAGE_KEY = "vocab-data";

function buildGraphData() {
  const nodes = {};
  Object.entries(SEED_NODES).forEach(([id, n]) => {
    nodes[id] = { id, en: id, def: n.def, defEs: n.defEs || "", cat: n.cat, images: [], standalone: n.def, userExamples: [] };
  });
  const edges = SEED_EDGES.map((e) => ({ source: e.a, target: e.b, sentence: e.s }));
  const srs = { study: initSrs() };
    return { nodes, edges, learned: ["study"], srs, level: null, profile: null, onboarded: false, progression: initProgression() };
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
  <style>{`.spin { animation: spin 0.9s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } } @keyframes xpPop { from { opacity: 0; transform: translate(-50%, -6px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
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
  const [suggestChecked, setSuggestChecked] = useState(new Set());
  const [suggestBatch, setSuggestBatch] = useState([]);
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
  const [settings, setSettings] = useState(loadVoiceSettings);
    const [showSettings, setShowSettings] = useState(false);
    const [interestInput, setInterestInput] = useState("");
  const [synBusy, setSynBusy] = useState(false);
    const [synError, setSynError] = useState("");
    const [patternNoun, setPatternNoun] = useState({});      // patrón → sustantivo seleccionado
        const [patternHistory, setPatternHistory] = useState({}); // patrón → frases practicadas
        const [patternReview, setPatternReview] = useState(null);  // sesión de review: {ids, pos}
  const [relBusy, setRelBusy] = useState(false);
    const [relError, setRelError] = useState("");
    const [pattInput, setPattInput] = useState({});    // id de patrón → texto que escribe el usuario
    const [pattCheck, setPattCheck] = useState({});    // id de patrón → resultado de la corrección IA
    const [pattChecking, setPattChecking] = useState({}); // id de patrón → IA corriendo
    const [newPaEs, setNewPaEs] = useState("");       // traducción de la plantilla del usuario
    const [newPaText, setNewPaText] = useState("");   // frase del pattern que escribe el usuario
    const [newPaWord, setNewPaWord] = useState("");   // palabra/objeto a añadir a la pool
    const [newPaPool, setNewPaPool] = useState([]);   // objetos que querrá probar
  const updateSettings = (patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch (e) { /* storage lleno */ }
      return next;
    });
  };
  useEffect(() => {
      setSentenceInput("");
      setCheckResult(null);
      setExampleIdx(0);
      setSavedExample(false);
      setShowTranslation(false);
      setEditingWord(false);
      setDeleteConfirm(false);
    }, [selected]);

    /* --- Gamificación: estado del toast "+N XP" y helpers de concesión --- */
    const [xpToast, setXpToast] = useState(null); // { id, amount } — se renderiza en el header
    const xpToastIdRef = useRef(0);
    const lastGradeRef = useRef(null); // snapshot para "Undo grade"
    const showXpToast = (amount) => {
      if (!amount) return;
      xpToastIdRef.current += 1;
      const id = xpToastIdRef.current;
      setXpToast({ id, amount });
      setTimeout(() => setXpToast((t) => (t?.id === id ? null : t)), 1800);
    };
    // Concede XP sobre un objeto `prev` (data) y lanza el toast si hay ganancia.
    const grantXp = (prev, amount) => {
      if (!amount) return prev.progression;
      showXpToast(amount);
      return earnXp(prev.progression || initProgression(), amount);
    };
    // Marca el día como activo en la racha (sin sumar XP).
    const activateStreak = () => {
      setData((prev) => {
        const prog = prev.progression || initProgression();
        const bumped = bumpStreak(prog);
        if (bumped.streak.lastActive === prog.streak?.lastActive && bumped.streak.current === prog.streak?.current) {
          return prev; // sin cambios — evita re-render innecesario
        }
        return { ...prev, progression: bumped };
      });
    };
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
                if (parsed && parsed.nodes) {
                  initial = parsed;
                  // Migración legacy: datos guardados antes del sistema de progresión
                  // no tienen `progression` — se inicializa en fresco sin tocar lo demás.
                  if (!initial.progression) initial.progression = initProgression();
                }
      }
    } catch (e) {
      /* first visit — use starter set */
    }
    setData(initial);
    setLoaded(true);
    // Precalentar la función serverless /api/claude: el primer request real del
    // día suele caer en cold start y cortar conexión; este ping mudo hace que
    // Vercel levante el contenedor antes de que lo necesites.
    try { fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: "ping", max_tokens: 1 }) }).catch(() => {}); } catch (e) {}
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
      activateStreak();
      setData((prev) => {
        const alreadyLearned = prev.learned?.includes(id);
        let progression = grantXp(prev, alreadyLearned ? 0 : Math.round(XP.learnWord * levelMultiplier(prev.level)));
        return {
          ...prev,
          learned: [...new Set([...prev.learned, id])],
          srs: { ...prev.srs, [id]: prev.srs?.[id] || initSrs() },
          progression,
        };
      });
    };

    const gradeReview = (id, grade) => {
          const prevSrs = data.srs?.[id] || initSrs();
          const updated = nextSrs(prevSrs, grade);
          // Snapshot para "Undo grade": contiene lo que había antes de gradear y la
          // ganancia de XP, para revertir la tarjeta si tocaste el botón equivocado.
          const gain = Math.round((XP_REVIEW[grade] || 0) * levelMultiplier(data.level));
          lastGradeRef.current = { id, prevSrs, gain };
          activateStreak();
          setData((prev) => {
            const today = todayKey();
            const prevCount = prev.reviewedToday?.date === today ? prev.reviewedToday.count : 0;
            return {
              ...prev,
              srs: { ...prev.srs, [id]: updated },
              reviewedToday: { date: today, count: prevCount + 1 },
              progression: grantXp(prev, gain),
            };
          });
          return updated;
        };

        // Deshace el último grade (por si tocasté Again cuando querías Easy, etc.).
        // Restaura el SRS previo de la tarjeta, quita el XP ganado y vuelve a mostrar
        // los botones de autoevaluación.
        const undoLastGrade = () => {
          const snap = lastGradeRef.current;
          if (!snap) return;
          setData((prev) => {
            let reviewedToday = prev.reviewedToday;
            if (reviewedToday?.date === todayKey()) {
              reviewedToday = { date: todayKey(), count: Math.max(0, reviewedToday.count - 1) };
            }
            const progression = earnXp(prev.progression || initProgression(), -snap.gain);
            return { ...prev, srs: { ...prev.srs, [snap.id]: snap.prevSrs }, progression, reviewedToday };
          });
          lastGradeRef.current = null;
          setNextReviewInfo(null); // vuelve a los botones de grade de la misma tarjeta
        };

  const nextReviewCard = () => {
      const next = reviewPos + 1;
      lastGradeRef.current = null; // el undo solo aplica a la tarjeta actual
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

    // Práctica un patrón (tocaste una palabra): lo registra para recordarlo
    // y programa su próxima revisión (SRS de patrones, parecido al Review).
    const practicePattern = (pid) => {
      activateStreak();
      setData((prev) => {
        const existing = prev.patternSrs?.[pid];
        if (existing) return prev; // ya registrado — no re-agendar
        const prog = grantXp(prev, 2);
        return { ...prev, patternSrs: { ...(prev.patternSrs || {}), [pid]: initSrs() }, progression: prog };
      });
    };

    // Autoevaluación en el review de patrones: actualiza su SRS y avanza.
    const gradePattern = (pid, grade) => {
      const card = data.patternSrs?.[pid] || initSrs();
      const updated = nextSrs(card, grade);
      const gain = Math.round((XP_REVIEW[grade] || 0) * levelMultiplier(data.level));
      activateStreak();
      setData((prev) => ({
        ...prev,
        patternSrs: { ...prev.patternSrs, [pid]: updated },
        progression: grantXp(prev, gain),
      }));
      setPatternNoun((s) => { const c = { ...s }; delete c[pid]; return c; });
            setPatternReview((r) => (r && r.pos + 1 < r.ids.length ? { ...r, pos: r.pos + 1 } : null));
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
      let gained = 0;
      setData((prev) => {
        const node = prev.nodes[id];
        if (!node) return prev;
        const alreadyHas = (node.userExamples || []).includes(clean);
        if (alreadyHas) return prev; // no duplicates (tampoco se premia dos veces)
        // XP por escribir un ejemplo: base + bono según elaboración de la oración.
        const mult = levelMultiplier(prev.level);
        gained = Math.round((XP.writeExample + sentenceQualityBonus(clean)) * mult);
        return {
          ...prev,
          nodes: { ...prev.nodes, [id]: { ...node, userExamples: [...(node.userExamples || []), clean] } },
          progression: grantXp(prev, gained),
        };
      });
      return gained;
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
  const dragNodeRef = useRef(null); // { id, lastX, lastY, moved } — arrastrar un nodo lo mueve; si no se mueve, cuenta como tap
  const TAP_TOL = (e) => (e.pointerType === "touch" ? 12 : 6); // el dedo tiembla más que el mouse
  const contentDelta = (dxPx, dyPx) => {
    // Píxeles de pantalla → coordenadas del grafo (compensando zoom + escala del viewBox)
    const rect = svgRef.current?.getBoundingClientRect();
    const scale = rect && rect.width ? dimsRef.current.w / rect.width : 1;
    const k = transformRef.current.k || 1;
    return { dx: (dxPx * scale) / k, dy: (dyPx * scale) / k };
  };

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
      const nodeId = nodeEl ? nodeEl.getAttribute("data-node-id") : null;
      tapRef.current = { nodeId, x: e.clientX, y: e.clientY, moved: false };
      if (nodeId && simRef.current) {
        // Agarraste un nodo: se clava (fx/fy) y la simulación se calienta para reacomodar los links
        const nd = simRef.current.nodeData.find((n) => n.id === nodeId);
        if (nd) {
          dragNodeRef.current = { id: nodeId, lastX: e.clientX, lastY: e.clientY, moved: false };
          nd.fx = nd.x; nd.fy = nd.y;
          try { simRef.current.sim.alphaTarget(0.3).restart(); } catch (err) { /* sim detenida — igual se mueve */ }
        }
      }
    } else if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchDistRef.current = Math.hypot(a.x - b.x, a.y - b.y);
      tapRef.current = null; // a second finger landed — this is a pinch, not a tap
    }
  };
  const onSvgPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (tapRef.current && Math.hypot(e.clientX - tapRef.current.x, e.clientY - tapRef.current.y) > TAP_TOL(e)) {
      tapRef.current.moved = true; // dragged too far — this is a pan, not a tap
    }
    const drag = dragNodeRef.current;
    if (drag && pointersRef.current.size === 1 && simRef.current) {
      // Arrastrando un nodo: se mueve él, el canvas NO hace pan
      const nd = simRef.current.nodeData.find((n) => n.id === drag.id);
      if (nd) {
        const { dx, dy } = contentDelta(e.clientX - drag.lastX, e.clientY - drag.lastY);
        drag.lastX = e.clientX; drag.lastY = e.clientY;
        if (Math.hypot(dx, dy) > 0.01) drag.moved = true;
        nd.fx = (nd.fx ?? nd.x) + dx; nd.fy = (nd.fy ?? nd.y) + dy;
        nd.x = nd.fx; nd.y = nd.fy;
        forceTick((n) => n + 1);
      }
    } else if (pointersRef.current.size === 1 && panStartRef.current) {
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
    const drag = dragNodeRef.current;
    if (drag && simRef.current) {
      // Soltar el nodo: se libera (fx/fy=null) y la simulación lo acomoda; si se movió, no era tap
      const nd = simRef.current.nodeData.find((n) => n.id === drag.id);
      if (nd) { nd.fx = null; nd.fy = null; }
      try { simRef.current.sim.alphaTarget(0); } catch (err) {}
      if (drag.moved && tapRef.current) tapRef.current.moved = true;
      dragNodeRef.current = null;
    }
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
          const { fromLocal, details } = await generateWordDetailsSmart(form.word.trim(), existingWords);
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
      else if (fromLocal) setGenError(`Loaded "${details.correctedWord || form.word.trim()}" from the local dictionary — no AI use, definición offline.`);
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
  // Estilo Obsidian: tamaño por nº de conexiones + atenuar lo no vecino al seleccionar
  const degreeMap = {};
  (data?.edges || []).forEach((e) => {
    const a = typeof e.source === "string" ? e.source : e.source?.id;
    const b = typeof e.target === "string" ? e.target : e.target?.id;
    if (a) degreeMap[a] = (degreeMap[a] || 0) + 1;
    if (b) degreeMap[b] = (degreeMap[b] || 0) + 1;
  });
  const neighborSet = new Set();
  if (selected) {
    neighborSet.add(selected);
    (data?.edges || []).forEach((e) => {
      const a = typeof e.source === "string" ? e.source : e.source?.id;
      const b = typeof e.target === "string" ? e.target : e.target?.id;
      if (a === selected && b) neighborSet.add(b);
      if (b === selected && a) neighborSet.add(a);
    });
  }
  const learnedCount = learnedSet.size;
    const totalCount = Object.keys(data.nodes).length;
    const wordList = Object.values(data.nodes);
    const cats = [...new Set(wordList.map((w) => w.cat))];

    // Gamificación (progression): racha, XP, nivel y progreso de la barra
    const prog = data.progression || initProgression();
    const streakCurrent = prog.streak?.current || 0;
    const streakBest = prog.streak?.best || 0;
    const xp = prog.xp || 0;
        const xpLevel = prog.level || 1;
        const xpProgress = levelProgress(xp, xpLevel);
        // Estado de la racha: ¿viva, a punto de perderse o ya se perdió?
        const lastActive = prog.streak?.lastActive;
        const streakDead = streakCurrent > 0 && lastActive && lastActive !== todayKey() && lastActive !== yesterKey();
        const streakAtRisk = streakCurrent > 0 && lastActive === yesterKey(); // practicaste ayer pero aún no hoy
    const currentInterests = normalizeInterests(data.profile?.interests);
    // Patterns personalizados (intereses + biblioteca base) y los que están vencidos para review.
    const profilePatterns = patternsForProfile(currentInterests.filter((i) => typeof i === "string"));
        const customPatterns = data.customPatterns || [];
    // Biblioteca de plantillas Slot-and-Filler: semilla + las que CREÓ el usuario.
    const allPatternBank = [...SEED_PATTERNS, ...(data.patternBank || [])];
        // Biblioteca base + intereses + los que CREÓ el usuario (sin duplicados por texto).
        const allPatterns = [...profilePatterns.filter((p) => !customPatterns.some((c) => c.en === p.en)), ...customPatterns];
        const duePatterns = allPatterns.filter((p) => { const c = data.patternSrs?.[p.id]; return c && c.due <= Date.now(); });

  // Solo palabras que SIGUEN en el mapa (si borraste "school", no aparece en review)
  const dueIds = [...learnedSet]
    .filter((id) => data.nodes?.[id] !== undefined)
    .filter((id) => (data.srs?.[id]?.due ?? 0) <= Date.now())
    .sort((a, b) => (data.srs?.[a]?.due ?? 0) - (data.srs?.[b]?.due ?? 0));
  const doneToday = data.reviewedToday?.date === todayKey() ? data.reviewedToday.count : 0;
  const remainingCapToday = Math.max(0, DAILY_REVIEW_CAP - doneToday);
  const dueCount = dueIds.length;
  const dueQueueIds = dueIds.slice(0, remainingCapToday);
  const practiceQueueIds = [...learnedSet]
    .filter((id) => data.nodes?.[id] !== undefined)
    .sort((a, b) => (data.srs?.[a]?.due ?? 0) - (data.srs?.[b]?.due ?? 0));

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
                  <button style={styles.gearBtn} onClick={() => setShowSettings(true)} title="Ajustes de voz">
                    <Settings size={20} color="#8CA9C9" strokeWidth={1.8} />
                  </button>
                  <div style={styles.gamifyRow}>
                                      <span style={streakDead ? styles.streakBadgeDead : streakAtRisk ? styles.streakBadgeRisk : styles.streakBadge} title={(streakDead ? `Perdiste tu racha de ${streakCurrent} días. Mejor: ${streakBest}.` : `Racha actual ${streakCurrent} días · mejor ${streakBest}`)}>
                                        <Flame size={11} style={{ verticalAlign: "-1px" }} /> {streakCurrent}
                                      </span>
                    <span style={styles.xpBadge} title={`${xp} XP · nivel ${xpLevel}`}>
                      ⭐ Lv {xpLevel}
                    </span>
                  </div>
                  <div style={styles.xpBarWrap}>
                    <div style={{ ...styles.xpBarFill, width: `${Math.round(xpProgress * 100)}%` }} />
                  </div>
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

                            {streakDead && (
                              <div style={styles.streakNoticeLost}>
                                You broke your {streakCurrent}-day streak. Best so far: <b>{streakBest}</b> days — practice today to start again. <Flame size={12} style={{ verticalAlign: "-2px", color: "#d98c8c" }} />
                              </div>
                            )}
                            {!streakDead && streakAtRisk && (
                              <div style={styles.streakNoticeRisk}>
                                Practice today to keep your {streakCurrent}-day streak alive. <Flame size={12} style={{ verticalAlign: "-2px", color: "#d9a441" }} />
                              </div>
                            )}

                            {xpToast && (
                <div key={xpToast.id} style={styles.xpToast}>
                  +{xpToast.amount} XP
                </div>
              )}

      {showSettings && (
        <div style={styles.modalOverlay} onClick={() => setShowSettings(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.wordHeaderRow}>
              <h2 style={styles.sectionTitle}>Ajustes</h2>
              <button style={styles.iconBtn} onClick={() => setShowSettings(false)} title="Cerrar">
                <X size={16} />
              </button>
            </div>
            <p style={styles.sectionBody}>Se aplican a toda la app al instante.</p>
            <label style={styles.label}>Voz (Edge Neural, gratis)</label>
            <select
              style={styles.input}
              value={settings.voice}
              onChange={(e) => updateSettings({ voice: e.target.value })}
            >
              {VOICES.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
            <label style={styles.label}>Velocidad: {settings.rate > 0 ? `+${settings.rate}` : settings.rate} (negativo = más lento, ideal para aprender)</label>
            <input
              type="range"
              min={-10}
              max={10}
              step={1}
              value={settings.rate}
              onChange={(e) => updateSettings({ rate: Number(e.target.value) })}
              style={styles.range}
            />
            <button
                          style={styles.genBtn}
                          onClick={() => speak("The river was calm in the early morning.", { voice: settings.voice, rate: settings.rate })}
                        >
                          <Volume2 size={16} /> Probar voz
                        </button>

                        <div style={styles.lookupDivider} />
                                                <h2 style={styles.sectionTitle}>Intereses</h2>
                                                <p style={styles.sectionBody}>Los usa la IA para recomendarte vocabulario útil. Añade los que quieras, en cualquier momento.</p>

                        {currentInterests.length > 0 && (
                          <div style={styles.tagCloud}>
                            {currentInterests.map((it) => (
                              <span key={it} style={styles.interestTag}>
                                {it}
                                <button
                                  style={styles.removeImgBtn2}
                                  onClick={() =>
                                    setData((prev) => ({
                                      ...prev,
                                      profile: { ...prev.profile, interests: currentInterests.filter((x) => x !== it) },
                                    }))
                                  }
                                >
                                  <X size={10} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                        {currentInterests.length === 0 && <p style={styles.formHint}>No interests yet — pick some below.</p>}

                        {PRESET_INTERESTS.filter((p) => !currentInterests.some((c) => c.toLowerCase() === p.toLowerCase())).length > 0 && (
                          <div style={styles.tagCloud}>
                            {PRESET_INTERESTS.filter((p) => !currentInterests.some((c) => c.toLowerCase() === p.toLowerCase())).map((p) => (
                              <button
                                key={p}
                                style={styles.addTagBtn}
                                onClick={() =>
                                  setData((prev) => ({
                                    ...prev,
                                    profile: { ...prev.profile, interests: [...currentInterests, p] },
                                  }))
                                }
                              >
                                <Plus size={11} /> {p}
                              </button>
                            ))}
                          </div>
                        )}

                        <div style={{ ...styles.connRow, marginTop: 10 }}>
                                                  <input
                            style={styles.inputSmall}
                            value={interestInput}
                            onChange={(e) => setInterestInput(e.target.value)}
                            placeholder="Or type a custom interest"
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && interestInput.trim()) {
                                const v = interestInput.trim();
                                setData((prev) => ({
                                  ...prev,
                                  profile: { ...prev.profile, interests: currentInterests.includes(v) ? currentInterests : [...currentInterests, v] },
                                }));
                                setInterestInput("");
                              }
                            }}
                          />
                          <button
                            style={styles.smallAddBtn}
                            disabled={!interestInput.trim()}
                            onClick={() => {
                              const v = interestInput.trim();
                              setData((prev) => ({
                                ...prev,
                                profile: { ...prev.profile, interests: currentInterests.includes(v) ? currentInterests : [...currentInterests, v] },
                              }));
                              setInterestInput("");
                            }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

      <div style={styles.railContent}>
                      <nav style={styles.rail}>
                        <button
                          style={activeTab === "map" ? styles.railBtnActive : styles.railBtn}
                          onClick={() => setActiveTab("map")}
                          title="Map"
                        >
                          <MapIcon size={19} />
                        </button>
                        <button
                                            style={activeTab === "review" ? styles.railBtnActive : styles.railBtn}
                                            onClick={() => setActiveTab("review")}
                                            title="Review"
                                          >
                                            <Layers size={19} />
                                            {dueCount > 0 && <span style={styles.railBadge}>{dueCount > 99 ? "99+" : dueCount}</span>}
                                          </button>
                                          <button
                                            style={activeTab === "patterns" ? styles.railBtnActive : styles.railBtn}
                                            onClick={() => setActiveTab("patterns")}
                                            title="Patterns"
                                          >
                                            <Waves size={19} />
                                          </button>
                        <button
                          style={activeTab === "add" ? styles.railBtnActive : styles.railBtn}
                          onClick={() => setActiveTab("add")}
                          title="Add word"
                        >
                          <Plus size={19} />
                        </button>
                        <button
                          style={activeTab === "practice" ? styles.railBtnActive : styles.railBtn}
                          onClick={() => setActiveTab("practice")}
                          title="Practice (patterns dinámicos)"
                        >
                          <Play size={19} />
                        </button>
                        <button
                          style={activeTab === "lookup" ? styles.railBtnActive : styles.railBtn}
                          onClick={() => setActiveTab("lookup")}
                          title="Lookup"
                        >
                          <Search size={19} />
                        </button>
                      </nav>
                      <div style={styles.contentCol}>

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
              strokeOpacity={
                selected
                  ? (s.id === selected || t.id === selected ? 0.9 : 0.08)
                  : lit ? 0.85 : partiallyLit ? 0.55 : 0.35
              }
            />
          );
        })}

        {nodeData.map((n) => {
          const st = status(n.id);
          const catColor = colorFor(n.cat);
          const deg = degreeMap[n.id] || 0;
          const r = (st === "learned" ? 15 : st === "suggested" ? 12 : 8) + Math.min(deg, 8);
          const fill = st === "learned" ? "#6FBF8B" : st === "suggested" ? "#D9A441" : "#2a343c";
          return (
            <g
              key={n.id}
              data-node-id={n.id}
              transform={`translate(${n.x || 0},${n.y || 0})`}
              style={{ cursor: "grab" }}
              opacity={selected && !neighborSet.has(n.id) ? 0.25 : 1}
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
        Drag a word to move it, drag the background to pan, pinch or scroll to zoom.
      </p>
      </>
      )}

      {activeTab === "review" && (
        <div style={styles.section}>
          {!reviewActive ? (
            <>
              <h2 style={styles.sectionTitle}><Layers size={18} color="#9fd9b8" style={{ verticalAlign: "-3px", marginRight: 7 }} /> Spaced repetition</h2>
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
                <div style={styles.defRow}>
                                  <p style={styles.panelDef}>{w.def}</p>
                                  <SpeakInline text={w.def} size={15} />
                                </div>
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
                                        <div style={styles.exampleEnRow}>
                                          <p style={styles.exampleEn}>{ex.sentence}</p>
                                          <SpeakInline text={ex.sentence} size={15} />
                                        </div>
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
                                        <div style={styles.undoGradeRow}>
                                          <button style={styles.undoGradeBtn} onClick={undoLastGrade}>
                                            <RotateCcw size={13} /> Undo grade
                                          </button>
                                          <button style={styles.learnBtnRowBtn} onClick={nextReviewCard}>
                                            Continue <ChevronRight size={16} />
                                          </button>
                                        </div>
                                      </div>
                                    )}
              </>
            );
          })()}
        </div>
      )}

      {activeTab === "patterns" && (
                    <div style={styles.section}>
                      <h2 style={styles.sectionTitle}><span style={{ color: "#6FBF8B" }}>Patterns</span> — slot & filler</h2>
                      <p style={styles.sectionBody}>
                        Plantillas con huecos (slots). El sistema genera combinaciones cambiando una parte a la vez —
                        tú pruebas, fallas, y la IA te corrige. Empieza por tu nivel y desbloquea el siguiente.
                      </p>

                      {/* Crear tu propia plantilla */}
                      <div style={styles.customPatternBox}>
                        <h3 style={styles.customTitle}>✏️ Crear tu propia plantilla</h3>
                        <p style={styles.formHint}>Escribe la estructura con <b>____</b> para cada hueco (p. ej. "I drink ____ in the morning"). Guarda la traducción si quieres.</p>
                        <input style={styles.input} value={newPaText} onChange={(e) => setNewPaText(e.target.value)} placeholder='e.g. I drink ____ in the morning' />
                        <input style={styles.input} value={newPaEs} onChange={(e) => setNewPaEs(e.target.value)} placeholder="traducción (opcional): e.g. Yo tomo ____ en la mañana" />
                        <div style={styles.connRow}>
                          <input style={styles.inputSmall} value={newPaWord} onChange={(e) => setNewPaWord(e.target.value)} placeholder="palabra para el hueco, ej. coffee" />
                          <button style={styles.smallAddBtn} onClick={() => { if (newPaWord.trim()) { setNewPaPool((w) => [...w, newPaWord.trim().toLowerCase()]); setNewPaWord(""); } }}><Plus size={14} /></button>
                        </div>
                        {newPaPool.length > 0 && (
                          <div style={styles.tagCloud}>
                            {newPaPool.map((w, i) => (
                              <span key={i} style={styles.interestTag}>{w}<button style={styles.removeImgBtn2} onClick={() => setNewPaPool((p) => p.filter((_, j) => j !== i))}><X size={10} /></button></span>
                            ))}
                          </div>
                        )}
                        <button
                          style={styles.genBtn}
                          disabled={!/____/.test(newPaText) || !newPaText.trim()}
                          onClick={() => {
                            const frame = parseUserFrame(newPaText.trim());
                            const id = "cust" + Date.now();
                            const nSlots = frame.filter((s) => s.k !== "verb").length;
                            const lvl = nSlots >= 3 ? 3 : nSlots === 2 ? 2 : 1;
                            setData((prev) => ({
                              ...prev,
                              patternBank: [...(prev.patternBank || []), { id, es: newPaEs.trim(), frame, subjectPool: [], objectPool: newPaPool, level: lvl }],
                            }));
                            setNewPaText(""); setNewPaEs(""); setNewPaWord(""); setNewPaPool([]);
                          }}
                        >
                          <Plus size={15} /> Añadir a mis plantillas
                        </button>
                      </div>

                      {/* Plantillas por nivel (SRS + drills dinámicos) — bloqueo igual que Practice */}
                      {(() => {
                        const bank = allPatternBank;
                        const showEs = data.level !== "advanced";
                        // desbloqueo: mismo criterio que Practice — 2 patterns completados del nivel anterior
                        const patternSrs = data.patternSrs || {};
                        const countDone = (lvl) => Object.values(patternSrs).filter((s) => s.level === lvl && s.reps > 0).length;
                        const unlockedLvls = [1];
                        if (countDone(1) >= 2) unlockedLvls.push(2);
                        if (countDone(2) >= 2) unlockedLvls.push(3);
                        if (countDone(3) >= 2) unlockedLvls.push(4);
                        const parts = [];
                        for (const lv of PATTERN_LEVELS) {
                          const group = bank.filter((t) => patternAutoLevel(t) === lv.id);
                          if (!group.length) continue;
                          const unlocked = unlockedLvls.includes(lv.id);
                          const practicedOfLevel = countDone(lv.id);
                          parts.push(
                            <div key={lv.id}>
                              <p style={styles.tierLabel}>Nivel {lv.id} — {lv.name} <span style={{ color: "#71807d", fontWeight: 400, textTransform: "none" }}>· {lv.es}</span></p>
                              {!unlocked ? (
                                <div style={styles.lockedBox}>
                                  <div style={styles.lockedInner}>
                                    <Flame size={16} color="#d98c8c" />
                                    <span>Se desbloquea al completar 2 patterns del nivel anterior (llevas {practicedOfLevel}).</span>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {group.map((t) => {
                                    const drills = buildDrills(t, 5);
                                    const hist = patternHistory[t.id] || [];
                                    const got = pattCheck[t.id];
                                    const curDrill = patternNoun[t.id] || 0; // índice del drill actual
                                    const d = drills[Math.min(curDrill, drills.length - 1)];
                                    return (
                                      <div key={t.id} style={styles.patternCard}>
                                        <div style={styles.patternTitleRow}>
                                          <span style={styles.patternEn}>{frameToText(t.frame)}</span>
                                          {showEs && t.es && <span style={styles.patternEs}>{t.es}</span>}
                                          <SpeakInline text={fillFrame(t.frame, { subject: (t.subjectPool || SLOT_POOLS.subject)[0], object: (t.objectPool || SLOT_POOLS.object)[0], time: (t.timePool || [])[0], place: (t.placePool || [])[0] })} size={13} />
                                          {data.patternSrs?.[t.id] && <span style={styles.patternSrsTag}>interval {data.patternSrs[t.id].interval}d</span>}
                                        </div>
                                        <div style={styles.tagCloud}>
                                          {drills.map((dd, i) => (
                                            <button key={i} style={curDrill === i ? styles.patternChipActive : styles.patternChip} onClick={() => setPatternNoun((s) => ({ ...s, [t.id]: i }))}>{dd.text}</button>
                                          ))}
                                        </div>
                                        {d && (
                                          <div style={styles.patternResult}>
                                            <div style={styles.patternResultRow}>
                                              <p style={styles.exampleEn}>{d.text}</p>
                                              <SpeakInline text={d.text} size={15} />
                                            </div>
                                            {showEs && t.es && <p style={styles.patternEs}>{t.es.replace(/____/g, d.text.split(" ").slice(-1)[0])}</p>}
                                          </div>
                                        )}
                                        <input
                                          style={styles.input}
                                          value={pattInput[t.id] || ""}
                                          onChange={(e) => { setPattInput((s) => ({ ...s, [t.id]: e.target.value })); setPattCheck((s) => { const c = { ...s }; delete c[t.id]; return c; }); }}
                                          placeholder="o escribe tu propia frase con esta estructura…"
                                        />
                                        <button
                                          style={styles.genBtn}
                                          disabled={!pattInput[t.id] || !pattInput[t.id].trim() || pattChecking[t.id]}
                                          onClick={async () => {
                                            const text = pattInput[t.id].trim();
                                            speak(text);
                                            setPattChecking((s) => ({ ...s, [t.id]: true }));
                                            try {
                                              const r = await checkPattern(text);
                                              setPattCheck((s) => ({ ...s, [t.id]: r }));
                                              if (r.correct) { practicePattern(t.id); setPatternHistory((s) => ({ ...s, [t.id]: [...(s[t.id] || []), text] })); }
                                            } catch (e) { setPattCheck((s) => ({ ...s, [t.id]: { correct: false, corrected: "", note: "No pude corregirlo: " + (e.message || e) } })); }
                                            setPattChecking((s) => ({ ...s, [t.id]: false }));
                                          }}
                                        >
                                          {pattChecking[t.id] ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                                          {pattChecking[t.id] ? "Corrigiendo…" : "Practicar · escuchar · corregir"}
                                        </button>
                                        {got && (
                                          <div style={styles.patternResult}>
                                            {got.correct ? <p style={{ ...styles.exampleEn, color: "#6FBF8B" }}>✓ {got.note || "Suena natural."}</p> : <p style={styles.exampleEn}>{got.corrected}</p>}
                                            {!got.correct && got.note && <p style={styles.bridgeNote}>{got.note}</p>}
                                          </div>
                                        )}
                                        {hist.length > 0 && (
                                          <div style={styles.patternHist}>
                                            <p style={styles.patternHistLabel}>Tus frases:</p>
                                            {hist.map((h, i) => <span key={i} style={styles.patternHistItem}>{h}</span>)}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </>
                              )}
                            </div>
                          );
                        }
                        return parts;
                      })()}
                    </div>
                  )}

                  {activeTab === "practice" && (
                    <PracticeTab
                      data={data}
                      setData={setData}
                      learnedSet={learnedSet}
                      wordbank={new Map(Object.values(data.nodes).map((n) => [n.id, n]))}
                      settings={settings}
                      grantXp={grantXp}
                      activateStreak={activateStreak}
                      styles={styles}
                    />
                  )}

                  {activeTab === "add" && (
              <div style={styles.section}>
          <h2 style={styles.sectionTitle}><Plus size={18} color="#9fd9b8" style={{ verticalAlign: "-3px", marginRight: 7 }} /> Add a word</h2>
          <p style={styles.formHint}>Every visitor builds their own map — this word is saved only for you.</p>

          {(data.profile?.job || currentInterests.length > 0 || learnedCount > 0) && (
                      <div style={styles.lookupBox}>
                        <label style={styles.label}>Suggested for you (based on {currentInterests.slice(0, 4).join(", ") || data.profile?.job || "your vocabulary"})</label>
                        <p style={styles.formHint}>The AI mixes your interests with the words you already know to propose the next useful ones.</p>
                        <button
                style={styles.genBtn}
                disabled={suggestBusy}
                onClick={async () => {
                  setSuggestBusy(true);
                  setSuggestResults(null);
                  setSuggestChecked(new Set());
                  setSuggestBatch([]);
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
                {suggestBusy ? "Thinking…" : suggestResults ? "Suggest again" : "Suggest words for me"}
              </button>
              {/* Checkboxes para agregar varias de una vez */}
              {suggestResults && suggestResults.length > 0 && suggestResults[0].word && (
                <div style={{ marginTop: 10 }}>
                  {suggestResults.map((r, i) =>
                    r.word ? (
                      <label key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={suggestChecked.has(r.word)}
                          onChange={(e) => {
                            const newSet = new Set(suggestChecked);
                            if (e.target.checked) newSet.add(r.word);
                            else newSet.delete(r.word);
                            setSuggestChecked(newSet);
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 700, color: "#cfe3d8" }}>{r.word}</span>
                          <span style={{ color: "#71807d", marginLeft: 6, fontSize: 13 }}>{r.why}</span>
                        </div>
                      </label>
                    ) : null
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                    <button
                      style={styles.genBtn}
                      disabled={suggestChecked.size === 0}
                      onClick={() => {
                        if (suggestChecked.size >= 1) {
                          const words = [...suggestChecked];
                          setForm((f) => ({ ...f, word: words[0] }));
                          setSuggestBatch(words.slice(1));
                          setSuggestResults(null);
                          setSuggestChecked(new Set());
                        }
                      }}
                    >
                      <Check size={14} /> Add selected ({suggestChecked.size})
                    </button>
                    <button
                      style={{ ...styles.genBtn, background: "transparent", border: "1px solid #2d3d33" }}
                      disabled={suggestBusy}
                      onClick={() => {
                        // Refresh — no bloqueado por suggestBusy (puede quedar stuck del botón principal)
                        setSuggestResults(null);
                        setSuggestChecked(new Set());
                        setSuggestBatch([]);
                        setSuggestBusy(true);
                        console.log("[refresh] pidiendo sugerencias...");
                        suggestWordsForProfile(data.profile, Object.values(data.nodes).map((n) => ({ en: n.en }))).then((result) => {
                          console.log("[refresh] ok:", result);
                          setSuggestResults(result.suggestions || []);
                          setSuggestBusy(false);
                        }).catch((e) => {
                          console.error("[refresh] error:", e);
                          setSuggestResults([{ word: "", why: `Couldn't get suggestions: ${e.message || e}` }]);
                          setSuggestBusy(false);
                        });
                      }}
                    >
                      {suggestBusy ? <Loader2 size={14} className="spin" /> : <span>⭮ Refresh</span>}
                    </button>
                  </div>
                  {/* Aviso si hay palabras en cola después de seleccionar varias */}
                  {suggestBatch.length > 0 && (
                    <p style={{ ...styles.formHint, marginTop: 6, color: "#9fd9b8" }}>
                      Also add later: {suggestBatch.join(", ")}
                    </p>
                  )}
                </div>
              )}
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
          <h2 style={styles.sectionTitle}><Search size={18} color="#9fd9b8" style={{ verticalAlign: "-3px", marginRight: 7 }} /> Lookup</h2>
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

                            </div>
                          </div>

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
                  <div style={styles.defRow}>
                                      <ClickableDefinition
                                        text={w.def}
                                        style={styles.panelDef}
                                        onWordTap={(word) => { setForm((f) => ({ ...f, word })); setActiveTab("add"); }}
                                      />
                                      <SpeakInline text={w.def} size={16} />
                                    </div>
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
                                      <div style={styles.exampleEnRow}>
                                        <p style={styles.exampleEn}>{ex.sentence}</p>
                                        <SpeakInline text={ex.sentence} size={15} />
                                      </div>
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

                                                      {/* Crecimiento de la red: sugerir palabras afines */}
                                                      {(() => {
                                                        const related = relatedSuggestionsLocal(data.nodes, data.learned || [], w.id);
                                                        const relAI = w.relatedAI || [];
                                                        const existingIds = new Set(Object.keys(data.nodes));
                                                        const learnedIds = new Set(data.learned || []);
                                                        const merged = [...related, ...relAI].filter((s) => s && s.word && !learnedIds.has(s.word) && !existingIds.has(s.word.toLowerCase()));
                                                        const seen = new Set();
                                                        const uniq = [];
                                                        for (const s of merged) { if (seen.has(s.word)) continue; seen.add(s.word); uniq.push(s); if (uniq.length >= 6) break; }
                                                        return (
                                                          <div style={styles.synBox}>
                                                            <div style={styles.synHeader}>
                                                              <Waves size={14} color="#6FBF8B" />
                                                              <span style={styles.synTitle}>🌱 Grow your network — related words</span>
                                                            </div>
                                                            <p style={styles.formHint}>Suggestions related to “{w.en}” — tap to add, or simply ignore them.</p>
                                                            {uniq.length > 0 && (
                                                              <div style={styles.synRow}>
                                                                {uniq.map((s, i) => (
                                                                  <button key={s.word + i} style={styles.synChip} title={s.why}
                                                                    onClick={() => { setForm((f) => ({ ...f, word: s.word })); setSelected(null); setActiveTab("add"); }}>
                                                                    {s.word}
                                                                  </button>
                                                                ))}
                                                              </div>
                                                            )}
                                                            {uniq.length === 0 && !relAI.length && <p style={styles.formHint}>No local suggestions yet — the AI can propose thematically nearby words.</p>}
                                                            {relAI.length === 0 && (
                                                              relError ? (
                                                                <p style={styles.genError}>{relError}</p>
                                                              ) : (
                                                                <button
                                                                  style={styles.genBtnSmall}
                                                                  disabled={relBusy}
                                                                  onClick={async () => {
                                                                    setRelBusy(true); setRelError("");
                                                                    try {
                                                                      const existing = Object.values(data.nodes).map((n) => n.en).join(", ");
                                                                      const res = await fetchRelatedWords(w.en, w.cat, existing);
                                                                      saveWordEdit(w.id, { relatedAI: res.suggestions || [] });
                                                                    } catch (e) { setRelError(`Couldn't fetch: ${e.message || e}`); }
                                                                    setRelBusy(false);
                                                                  }}
                                                                >
                                                                  {relBusy ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
                                                                  {relBusy ? "Thinking…" : "Smarter suggestions (AI)"}
                                                                </button>
                                                              )
                                                            )}
                                                          </div>
                                                        );
                                                      })()}

                                    {/* Sinónimos y antónimos: aparecen tras suficientes repasos */}
                                    {(() => {
                                      const srs = data.srs?.[w.id];
                                      const reps = srs?.reps || 0;
                                      const sa = w.synonyms || null;
                                      if (reps < SYNONYM_REVIEW_THRESHOLD) return null;
                                      return (
                                        <div style={styles.synBox}>
                                          <div style={styles.synHeader}>
                                            <Repeat size={14} color="#d9a441" />
                                            <span style={styles.synTitle}>Expand it — synonyms &amp; antonyms</span>
                                          </div>
                                          {sa ? (
                                            <>
                                              <div style={styles.synRow}>
                                                <span style={styles.synLabel}>≈ synonyms:</span>
                                                {sa.synonyms && sa.synonyms.length > 0 ? (
                                                  sa.synonyms.map((s) => (
                                                    <button key={s} style={styles.synChip} onClick={() => { setForm((f) => ({ ...f, word: s })); setSelected(null); setActiveTab("add"); }}>
                                                      {s}
                                                    </button>
                                                  ))
                                                ) : <span style={styles.synEmpty}>—</span>}
                                              </div>
                                              <div style={styles.synRow}>
                                                <span style={styles.synLabel}>⇄ antonyms:</span>
                                                {sa.antonyms && sa.antonyms.length > 0 ? (
                                                  sa.antonyms.map((s) => (
                                                    <button key={s} style={styles.antiChip} onClick={() => { setForm((f) => ({ ...f, word: s })); setSelected(null); setActiveTab("add"); }}>
                                                      {s}
                                                    </button>
                                                  ))
                                                ) : <span style={styles.synEmpty}>none</span>}
                                              </div>
                                              <p style={styles.formHint}>Tap one to add it to your map and grow your network.</p>
                                            </>
                                          ) : synError ? (
                                            <>
                                              <p style={styles.genError}>{synError}</p>
                                              <button style={styles.retryBtn} onClick={() => { setSynError(""); setSynBusy(false); }}>Retry</button>
                                            </>
                                          ) : (
                                            <button
                                              style={styles.genBtnSmall}
                                              disabled={synBusy}
                                              onClick={async () => {
                                                setSynBusy(true);
                                                setSynError("");
                                                try {
                                                  const res = await fetchSynonymsAntonyms(w.en);
                                                  saveWordEdit(w.id, { synonyms: res });
                                                } catch (e) {
                                                  setSynError(`Couldn't fetch: ${e.message || e}`);
                                                }
                                                setSynBusy(false);
                                              }}
                                            >
                                              {synBusy ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
                                              {synBusy ? "Looking up…" : "Suggest synonyms & antonyms"}
                                            </button>
                                          )}
                                        </div>
                                      );
                                    })()}

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
      background: "radial-gradient(1200px 500px at 50% -120px, #1d2f2a 0%, #12181b 55%), radial-gradient(900px 400px at 100% 100%, #14202b 0%, transparent 60%), #12181b",
      minHeight: "100vh",
      color: "#eae4d8",
      padding: "20px 16px 32px",
      boxSizing: "border-box",
      maxWidth: 900,
      margin: "0 auto",
    },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, background: "rgba(111,191,139,0.045)", border: "1px solid #23362f", borderRadius: 16, padding: "14px 16px", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)" },
  tabBar: { display: "flex", gap: 6, marginBottom: 14, borderBottom: "1px solid #232d32", paddingBottom: 10 },
  moreMenu: { position: "absolute", top: "110%", right: 0, background: "#1c2530", border: "1px solid #2f3b42", borderRadius: 10, padding: 6, zIndex: 20, minWidth: 130, boxShadow: "0 8px 24px rgba(0,0,0,0.4)" },
  moreMenuItem: { display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: "#eae4d8", padding: "8px 10px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontFamily: "inherit" },
  tab: { flex: 1, background: "transparent", border: "1px solid #2f3b42", color: "#8a9490", borderRadius: 20, padding: "8px 6px", fontSize: 12.5, cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  tabActive: { flex: 1, background: "#2a3a3d", border: "1px solid #6FBF8B", color: "#9fd9b8", borderRadius: 20, padding: "8px 6px", fontSize: 12.5, cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  /* --- Barra lateral (navegación por iconos a la izquierda) --- */
  railContent: { display: "flex", gap: 12, alignItems: "flex-start" },
  rail: { display: "flex", flexDirection: "column", gap: 8, flex: "0 0 auto" },
  railBtn: { position: "relative", width: 44, height: 44, borderRadius: 12, background: "#1c2530", border: "1px solid #2f3b42", color: "#8a9490", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
  railBtnActive: { position: "relative", width: 44, height: 44, borderRadius: 12, background: "#2a3a3d", border: "1px solid #6FBF8B", color: "#9fd9b8", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 0 0 1px rgba(111,191,139,0.25)" },
  railBadge: { position: "absolute", top: -4, right: -4, minWidth: 17, height: 17, borderRadius: 9, background: "#d9a441", color: "#12181b", fontSize: 9.5, fontWeight: 700, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px", boxSizing: "border-box" },
  contentCol: { flex: 1, minWidth: 0 },
  speakInline: { background: "none", border: "none", color: "#7fb89a", cursor: "pointer", padding: 3, flex: "0 0 auto", display: "inline-flex", alignItems: "center", justifyContent: "center", marginLeft: 4 },
  defRow: { display: "flex", alignItems: "flex-start", gap: 2 },
  exampleEnRow: { display: "flex", alignItems: "flex-start", gap: 2 },
  undoGradeRow: { display: "flex", gap: 8, marginTop: 10 },
  undoGradeBtn: { flex: 1, background: "transparent", border: "1px solid #4a3c1f", color: "#d9a441", borderRadius: 10, padding: "10px 12px", fontSize: 12.5, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", fontFamily: "inherit" },
  learnBtnRowBtn: { flex: 1, background: "#6FBF8B", color: "#12181b", border: "none", borderRadius: 10, padding: "11px 16px", fontSize: 14.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", fontFamily: "inherit", marginTop: 0 },
  tagCloud: { display: "flex", flexWrap: "wrap", gap: 8, margin: "8px 0 4px" },
  interestTag: { display: "inline-flex", alignItems: "center", gap: 6, background: "#2a3a3d", border: "1px solid #3d504f", color: "#9fd9b8", borderRadius: 20, padding: "5px 6px 5px 12px", fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  addTagBtn: { display: "inline-flex", alignItems: "center", gap: 5, background: "transparent", border: "1px dashed #2f3b42", color: "#8a9490", borderRadius: 20, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  synBox: { background: "#172429", border: "1px solid #2a4145", borderRadius: 12, padding: "12px 14px", margin: "12px 0 16px" },
  synHeader: { display: "flex", alignItems: "center", gap: 7, marginBottom: 8 },
  synTitle: { fontSize: 12.5, color: "#e7cf9e", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 600 },
  synRow: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  synLabel: { fontSize: 11.5, color: "#8a9490", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", marginRight: 4 },
  synChip: { background: "transparent", border: "1px solid #3a5a42", color: "#8cd9a0", borderRadius: 20, padding: "3px 10px", fontSize: 12, cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  antiChip: { background: "transparent", border: "1px solid #5a3a3a", color: "#d98c8c", borderRadius: 20, padding: "3px 10px", fontSize: 12, cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  synEmpty: { fontSize: 12, color: "#66746f", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  retryBtn: { background: "transparent", border: "1px solid #4a3c1f", color: "#d9a441", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit", marginTop: 8 },
  genBtnSmall: { display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#2a3a3d", border: "1px solid #3d504f", color: "#9fd9b8", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", width: "100%" },
  patternCard: { background: "#12181b", border: "1px solid #2a4145", borderRadius: 12, padding: "12px 14px", marginBottom: 12 },
  patternTitleRow: { display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" },
  patternEn: { fontSize: 15.5, color: "#9fd9b8", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontWeight: 600 },
  patternEs: { fontSize: 13.5, color: "#8a9490", fontStyle: "italic" },
  patternChip: { background: "transparent", border: "1px solid #2f3b42", color: "#b7c2be", borderRadius: 18, padding: "4px 11px", fontSize: 12, cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  patternChipActive: { background: "#2a3a3d", border: "1px solid #6FBF8B", color: "#9fd9b8", borderRadius: 18, padding: "4px 11px", fontSize: 12, cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  patternResult: { background: "#172429", borderRadius: 8, padding: "10px 12px", marginTop: 8 },
  patternResultRow: { display: "flex", alignItems: "center", gap: 6 },
  patternHist: { marginTop: 8, borderTop: "1px dashed #232d32", paddingTop: 8 },
  patternHistLabel: { fontSize: 10.5, color: "#71807d", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", margin: "0 0 4px" },
  patternHistItem: { display: "inline-block", background: "#1c2530", border: "1px solid #2f3b42", color: "#8a9490", borderRadius: 8, padding: "2px 8px", fontSize: 11, marginRight: 6, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  patternSrsTag: { fontSize: 10.5, color: "#d9a441", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", border: "1px solid #4a3c1f", borderRadius: 10, padding: "1px 7px" },
  customPatternBox: { background: "#172429", border: "1px dashed #2a4145", borderRadius: 12, padding: "14px", marginBottom: 16 },
  customTitle: { fontSize: 15, color: "#9fd9b8", margin: "0 0 8px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  tierLabel: { fontSize: 12, color: "#6FBF8B", fontWeight: 700, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", textTransform: "uppercase", letterSpacing: 0.5, margin: "16px 0 8px", borderBottom: "1px solid #23362f", paddingBottom: 4 },
  tierDetails: { margin: "10px 0" },
  tierSummary: { cursor: "pointer", fontSize: 12.5, color: "#8a9490", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  lockedBox: { border: "1px dashed #4a3c1f", borderRadius: 12, padding: "12px 14px", marginTop: 12, background: "rgba(74,60,31,0.12)" },
  lockedInner: { display: "flex", alignItems: "center", gap: 8, color: "#d9a441", fontSize: 12.5, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  streakBadgeDead: { fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#d98c8c", background: "#2a1a1a", border: "1px solid #4a2a2a", borderRadius: 12, padding: "2px 8px" },
  streakBadgeRisk: { fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#d9a441", background: "#2a2417", border: "1px dashed #4a3c1f", borderRadius: 12, padding: "2px 8px" },
  streakNoticeLost: { display: "flex", alignItems: "center", gap: 8, background: "#2a1a1a", border: "1px solid #4a2a2a", color: "#d98c8c", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, marginBottom: 14, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  streakNoticeRisk: { display: "flex", alignItems: "center", gap: 8, background: "#2a2417", border: "1px solid #4a3c1f", color: "#d9a441", borderRadius: 10, padding: "9px 12px", fontSize: 12.5, marginBottom: 14, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
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
  gearBtn: { background: "none", border: "1px solid #2f3b42", borderRadius: "50%", width: 34, height: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginRight: 10, verticalAlign: "middle" },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(10,14,16,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 },
  modalCard: { background: "#1c2530", border: "1px solid #2f3b42", borderRadius: 14, padding: "20px 20px 24px", width: "100%", maxWidth: 420, boxShadow: "0 12px 40px rgba(0,0,0,0.5)" },
  range: { width: "100%", accentColor: "#6FBF8B", margin: "4px 0 8px" },
  // PracticeTab — acordeón por nivel
  levelCard: { background: "#161e23", border: "1px solid #232d32", borderRadius: 12, overflow: "hidden" },
  levelHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "12px 14px", background: "none", border: "none", textAlign: "left", color: "inherit", cursor: "pointer", gap: 10 },
  progressBarSm: { height: 4, width: 56, background: "#232d32", borderRadius: 2, overflow: "hidden" },
  progressBarFillSm: { height: "100%", background: "#6FBF8B", borderRadius: 2 },
    gamifyRow: { display: "flex", gap: 6, justifyContent: "flex-end", marginBottom: 4 },
    streakBadge: { fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#d9a441", background: "#2a2417", border: "1px solid #4a3c1f", borderRadius: 12, padding: "2px 8px" },
    xpBadge: { fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", color: "#8cc9d9", background: "#172a2f", border: "1px solid #2a4a52", borderRadius: 12, padding: "2px 8px" },
    xpBarWrap: { height: 5, background: "#232d32", borderRadius: 3, overflow: "hidden", marginBottom: 6, minWidth: 120 },
    xpBarFill: { height: "100%", background: "linear-gradient(90deg, #6FBF8B, #8cc9d9)", borderRadius: 3, transition: "width 0.4s ease" },
    xpToast: { position: "fixed", top: 18, left: "50%", transform: "translateX(-50%)", background: "#2a3a3d", border: "1px solid #6FBF8B", color: "#9fd9b8", borderRadius: 20, padding: "8px 16px", fontSize: 14, fontWeight: 600, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", zIndex: 70, boxShadow: "0 6px 20px rgba(0,0,0,0.5)", animation: "xpPop 0.25s ease" },
  };
