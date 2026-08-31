import { useState, useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";
import { Sprout, X, Check, ChevronRight, Plus, Sparkles, Loader2, Layers, BookOpen, Utensils, Smile, Briefcase, TreePine, Shapes } from "lucide-react";

/* ---------- AI + image helpers — call our own /api/* serverless
   functions (see /api/claude.js and /api/pexels.js) so the Anthropic and
   Pexels API keys stay on the server and never reach the browser. ---------- */
async function callClaude(prompt, max_tokens) {
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, max_tokens }),
  });
  const data = await response.json();
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  return text.replace(/```json|```/g, "").trim();
}

async function findImages(word) {
  try {
    const res = await fetch(`/api/pexels?q=${encodeURIComponent(word)}`);
    const data = await res.json();
    return data.images || [];
  } catch (e) {
    return [];
  }
}

async function generateWordDetails(word, existingWords) {
  const wordList = existingWords.map((w) => w.en).join(", ");
  const prompt = `New word: "${word}"
Existing words already in the learner's vocabulary network: ${wordList || "(none yet)"}

Return ONLY valid JSON, no markdown fences, no extra text, in exactly this shape:
{"definition": "...", "category": "...", "connections": [{"word": "<exact spelling of an existing word from the list above>", "sentence": "..."}]}

Rules:
- "definition": a simple English definition for a beginner English learner, under 14 words, using common everyday words. Do not reuse "${word}" inside the definition.
- "category": one short lowercase English topic word, like school, food, feelings, work, nature, travel, or health.
- "connections": pick between 2 and 5 words FROM THE EXISTING LIST ABOVE that "${word}" is naturally related to in meaning or everyday use — not just words that share a category. A word can relate to ideas from more than one topic (e.g. "shelf" fits both "home" and "school"). The more genuine connections you find, the better — a richly connected network helps the learner review old words while learning new ones. For each connection, write one short natural English sentence using both "${word}" and that existing word together. Only return fewer than 2 if the existing list is very small or truly nothing relates well.`;

  const clean = await callClaude(prompt, 1000);
  return JSON.parse(clean);
}


/* ---------- Starter word graph (English only, simple definitions) ---------- */
const PALETTE = ["#8CA9C9", "#D98C5F", "#C98CC9", "#A9B16B", "#4FAE82", "#C9A15A", "#7BA9A0"];

const SEED_NODES = {
  study:    { def: "to spend time learning about something", cat: "school" },
  math:     { def: "the subject that deals with numbers and shapes", cat: "school" },
  exam:     { def: "a formal test of what you know", cat: "school" },
  school:   { def: "a place where people go to learn", cat: "school" },
  teacher:  { def: "a person whose job is to help others learn", cat: "school" },
  notebook: { def: "a small book used for writing notes", cat: "school" },

  kitchen:  { def: "a room where food is cooked", cat: "food" },
  recipe:   { def: "a set of steps for making a certain food", cat: "food" },
  flavor:   { def: "how food or drink tastes", cat: "food" },
  hungry:   { def: "feeling like you need to eat", cat: "food" },

  happy:    { def: "feeling good or pleased", cat: "feelings" },
  excited:  { def: "feeling very happy about something coming soon", cat: "feelings" },
  stress:   { def: "a feeling of worry or pressure", cat: "feelings" },
  calm:     { def: "quiet and free of worry", cat: "feelings" },
  proud:    { def: "feeling good about something you did", cat: "feelings" },

  meeting:  { def: "a time when people gather to talk about work", cat: "work" },
  deadline: { def: "the time by which something must be finished", cat: "work" },
  coworker: { def: "a person you work with", cat: "work" },
  salary:   { def: "the money a person earns from a job", cat: "work" },

  tree:     { def: "a tall plant with a trunk and branches", cat: "nature" },
  forest:   { def: "a large area covered with trees", cat: "nature" },
  river:    { def: "a long body of water that flows across land", cat: "nature" },
  root:     { def: "the part of a plant that grows under the ground", cat: "nature" },
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


const STORAGE_KEY = "vocab-data";

function buildGraphData() {
  const nodes = {};
  Object.entries(SEED_NODES).forEach(([id, n]) => {
    nodes[id] = { id, en: id, def: n.def, cat: n.cat, images: [], standalone: n.def };
  });
  const edges = SEED_EDGES.map((e) => ({ source: e.a, target: e.b, sentence: e.s }));
  const srs = { study: initSrs() };
  return { nodes, edges, learned: ["study"], srs };
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
  const [form, setForm] = useState({ word: "", def: "", cat: "", connections: [], sentence: "", images: [], imgInput: "" });
  const [manualLink, setManualLink] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [sentenceInput, setSentenceInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [reviewActive, setReviewActive] = useState(false);
  const [reviewQueue, setReviewQueue] = useState([]);
  const [reviewPos, setReviewPos] = useState(0);
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    setSentenceInput("");
    setCheckResult(null);
  }, [selected]);
  const svgRef = useRef(null);
  const simRef = useRef(null);
  const dimsRef = useRef({ w: 800, h: 560 });
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
  const searchImagesForNode = async (id, word) => {
    setImgSearching(true);
    const images = await findImages(word);
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
    setData((prev) => ({ ...prev, srs: { ...prev.srs, [id]: nextSrs(prev.srs?.[id] || initSrs(), grade) } }));
  };

  const nextReviewCard = () => {
    const next = reviewPos + 1;
    if (next >= reviewQueue.length) {
      setReviewActive(false);
    } else {
      setReviewPos(next);
      setRevealed(false);
    }
  };

  const bridgeFor = (id) => {
    if (!data) return null;
    const edge = data.edges.find(
      (e) => (e.source === id && learnedSet.has(e.target)) || (e.target === id && learnedSet.has(e.source))
    );
    if (!edge) return null;
    const otherId = edge.source === id ? edge.target : edge.source;
    return { sentence: edge.sentence, other: otherId };
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
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 1) {
      panStartRef.current = { x: e.clientX, y: e.clientY, tx: transformRef.current.x, ty: transformRef.current.y };
    } else if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchDistRef.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onSvgPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
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
          cat: form.cat.trim() || "custom",
          images: form.images,
          standalone: form.sentence.trim() || form.def.trim(),
        },
      };
      const newEdges = form.connections
        .filter((c) => c.checked)
        .map((c) => ({ source: id, target: c.targetId, sentence: c.sentence }));
      return { ...prev, nodes, edges: [...prev.edges, ...newEdges] };
    });
    setForm({ word: "", def: "", cat: "", connections: [], sentence: "", images: [], imgInput: "" });
    setManualLink("");
    setActiveTab("map");
  };

  const runGenerate = async () => {
    if (!form.word.trim()) return;
    setGenerating(true);
    setGenError("");
    const existingWords = Object.values(data.nodes).map((n) => ({ id: n.id, en: n.en, cat: n.cat }));

    // 1) definition + connections: required, this is the part that must succeed
    try {
      const details = await generateWordDetails(form.word.trim(), existingWords);
      const byName = {};
      existingWords.forEach((w) => (byName[w.en.toLowerCase()] = w.id));
      const connections = (details.connections || [])
        .map((c) => ({ targetId: byName[(c.word || "").toLowerCase()], sentence: c.sentence, checked: true }))
        .filter((c) => c.targetId);
      setForm((f) => ({
        ...f,
        def: details.definition || f.def,
        cat: details.category || f.cat,
        connections,
        sentence: connections[0]?.sentence || f.sentence,
      }));
    } catch (e) {
      setGenError("Couldn't generate the definition — try again, or fill it in yourself.");
      setGenerating(false);
      return;
    }

    // 2) images: real search now works (this is a real server, not a sandboxed artifact)
    const images = await findImages(form.word.trim());
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

  const nodeData = simRef.current?.nodeData || [];
  const linkData = simRef.current?.linkData || [];
  const learnedCount = learnedSet.size;
  const totalCount = Object.keys(data.nodes).length;
  const wordList = Object.values(data.nodes);
  const cats = [...new Set(wordList.map((w) => w.cat))];

  const dueCount = [...learnedSet].filter((id) => (data.srs?.[id]?.due ?? 0) <= Date.now()).length;
  const reviewQueueIds = [...learnedSet].sort((a, b) => (data.srs?.[a]?.due ?? 0) - (data.srs?.[b]?.due ?? 0));

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
        </div>
      </header>

      <div style={styles.tabBar}>
        <button style={activeTab === "map" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("map")}>Map</button>
        <button style={activeTab === "review" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("review")}>
          Review{dueCount > 0 ? ` · ${dueCount}` : ""}
        </button>
        <button style={activeTab === "add" ? styles.tabActive : styles.tab} onClick={() => setActiveTab("add")}>Add word</button>
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
        onClick={() => setSelected(null)}
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
              transform={`translate(${n.x || 0},${n.y || 0})`}
              onClick={(e) => { e.stopPropagation(); setSelected(n.id); }}
              style={{ cursor: "pointer" }}
            >
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
                Every learned word gets scheduled like Anki: grade yourself after each card, and words you find
                easy come back less often while words you struggle with come back sooner.
              </p>
              {learnedCount === 0 ? (
                <p style={styles.formHint}>Learn a word on the Map first — then it shows up here.</p>
              ) : (
                <>
                  <p style={styles.progressNum}>{dueCount > 0 ? `${dueCount} due now` : "Nothing due yet"}</p>
                  <button
                    style={styles.learnBtn}
                    onClick={() => {
                      setReviewQueue(reviewQueueIds);
                      setReviewPos(0);
                      setRevealed(false);
                      setReviewActive(true);
                    }}
                  >
                    <Layers size={16} /> Start review ({learnedCount} word{learnedCount === 1 ? "" : "s"})
                  </button>
                </>
              )}
            </>
          ) : (() => {
            const id = reviewQueue[reviewPos];
            const w = data.nodes[id];
            if (!w) return null;
            return (
              <>
                <p style={styles.formHint}>Card {reviewPos + 1} of {reviewQueue.length}</p>
                <h2 style={styles.panelWord}>{w.en}</h2>
                {!revealed ? (
                  <button style={styles.learnBtn} onClick={() => setRevealed(true)}>
                    Show answer <ChevronRight size={16} />
                  </button>
                ) : (
                  <>
                    {w.images && w.images.length > 0 ? (
                      <div style={styles.gallery}>
                        {w.images.map((src, i) => <img key={i} src={src} alt={w.en} style={styles.galleryImg} />)}
                      </div>
                    ) : (
                      <div style={styles.panelImgFallback}><CategoryIcon cat={w.cat} /></div>
                    )}
                    <p style={styles.panelDef}>{w.def}</p>
                    <div style={styles.exampleBox}>
                      <p style={styles.exampleEn}>{w.standalone}</p>
                    </div>
                    <p style={styles.formHint}>How well did you remember it?</p>
                    <div style={styles.gradeRow}>
                      <button style={styles.gradeAgain} onClick={() => { gradeReview(id, "again"); nextReviewCard(); }}>Again</button>
                      <button style={styles.gradeHard} onClick={() => { gradeReview(id, "hard"); nextReviewCard(); }}>Hard</button>
                      <button style={styles.gradeGood} onClick={() => { gradeReview(id, "good"); nextReviewCard(); }}>Good</button>
                      <button style={styles.gradeEasy} onClick={() => { gradeReview(id, "easy"); nextReviewCard(); }}>Easy</button>
                    </div>
                  </>
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

          <label style={styles.label}>Word</label>
          <input style={styles.input} value={form.word} onChange={(e) => setForm({ ...form, word: e.target.value })} placeholder="e.g. deadline" />

          <button style={styles.genBtn} onClick={runGenerate} disabled={!form.word.trim() || generating}>
            {generating ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
            {generating ? "Generating…" : "Generate definition & connections"}
          </button>
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

      {selected && (() => {
        const w = data.nodes[selected];
        if (!w) return null;
        const st = status(w.id);
        const bridge = st !== "learned" ? bridgeFor(w.id) : null;
        const sentence = bridge ? bridge.sentence : w.standalone;
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
                <button style={styles.findImgBtn} onClick={() => searchImagesForNode(w.id, w.en)} disabled={imgSearching}>
                  {imgSearching ? <Loader2 size={15} className="spin" /> : <CategoryIcon cat={w.cat} size={20} />}
                  {imgSearching ? "Searching…" : "Find images"}
                </button>
              )}

              <span style={{ ...styles.catTag, color: colorFor(w.cat), borderColor: colorFor(w.cat) }}>
                {w.cat}
              </span>
              <h2 style={styles.panelWord}>{w.en}</h2>
              <p style={styles.panelDef}>{w.def}</p>
              <div style={styles.exampleBox}>
                <p style={styles.exampleEn}>{sentence}</p>
                {bridge && <p style={styles.bridgeNote}>connects to “{bridge.other}”</p>}
              </div>
              {st === "learned" ? (
                <div style={styles.learnedTag}>
                  <Check size={16} color="#6FBF8B" /> Already learned
                </div>
              ) : (
                <button style={styles.learnBtn} onClick={() => markLearned(w.id)}>
                  Mark as learned <ChevronRight size={16} />
                </button>
              )}

              <label style={styles.label}>Try it — write your own sentence with "{w.en}"</label>
              <input
                style={styles.input}
                value={sentenceInput}
                onChange={(e) => { setSentenceInput(e.target.value); setCheckResult(null); }}
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
                    setCheckResult({ correct: false, corrected: "", note: "Couldn't check that — try again." });
                  }
                  setChecking(false);
                }}
              >
                {checking ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
                {checking ? "Checking…" : "Check my sentence"}
              </button>
              {checkResult && (
                <div style={styles.exampleBox}>
                  {checkResult.correct ? (
                    <p style={{ ...styles.exampleEn, color: "#6FBF8B" }}>✓ Correct as written!</p>
                  ) : (
                    <p style={styles.exampleEn}>{checkResult.corrected}</p>
                  )}
                  <p style={styles.bridgeNote}>{checkResult.note}</p>
                </div>
              )}
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
  tab: { flex: 1, background: "transparent", border: "1px solid #2f3b42", color: "#8a9490", borderRadius: 20, padding: "8px 6px", fontSize: 12.5, cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  tabActive: { flex: 1, background: "#2a3a3d", border: "1px solid #6FBF8B", color: "#9fd9b8", borderRadius: 20, padding: "8px 6px", fontSize: 12.5, cursor: "pointer", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  section: { background: "#1c2530", border: "1px solid #2f3b42", borderRadius: 14, padding: "18px 18px 22px" },
  sectionTitle: { fontSize: 20, margin: "0 0 8px", fontWeight: 600 },
  sectionBody: { fontSize: 13.5, color: "#b7c2be", lineHeight: 1.5, margin: "0 0 16px" },
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
  svg: { width: "100%", height: "auto", borderRadius: 14, border: "1px solid #232d32", touchAction: "none", display: "block" },
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
  catTag: { fontSize: 10.5, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", border: "1px solid", borderRadius: 20, padding: "2px 9px", display: "inline-block" },
  panelWord: { fontSize: 28, margin: "10px 0 0", fontWeight: 600 },
  panelDef: { fontSize: 14.5, color: "#b7c2be", margin: "4px 0 14px" },
  exampleBox: { background: "#12181b", borderRadius: 10, padding: "12px 14px", marginBottom: 18, borderLeft: "3px solid #6FBF8B" },
  exampleEn: { margin: 0, fontSize: 14.5, color: "#eae4d8" },
  bridgeNote: { margin: "6px 0 0", fontSize: 11.5, color: "#D9A441", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  learnedTag: { display: "flex", alignItems: "center", gap: 8, color: "#6FBF8B", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 },
  learnBtn: { width: "100%", background: "#6FBF8B", color: "#12181b", border: "none", borderRadius: 10, padding: "13px 16px", fontSize: 14.5, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer", fontFamily: "inherit", marginTop: 6 },
  formHint: { fontSize: 12, color: "#71807d", margin: "4px 0 16px" },
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
