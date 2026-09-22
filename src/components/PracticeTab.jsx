/* ---------- Practice Tab — Patterns dinámicos con grafo semántico ----------
   Cada nivel usa palabras REALES del vocabulario del usuario. Completar 2
   patterns bien de un nivel desbloquea el siguiente.
   Generación: grafo tipado local (offline instantáneo) + validación semántica IA. */
import { useState, useMemo } from "react";
import { Sparkles, Loader2, ChevronRight, Check } from "lucide-react";
import { PATTERN_LEVELS } from "../data/patterns.js";
import { buildSeedGraph, indexGraph } from "../lib/graph.js";
import { fillPattern } from "../lib/generator.js";
import { conjugateVerb } from "../data/patterns.js";

const USER_GRAPH_KEY = "roots-graph-v1";

const LEVELS = PATTERN_LEVELS.map((l) => l.id); // [1,2,3,4]
const LEVEL_META = {
  1: { name: "Fundacionales", desc: "[Subject] + [Action]", es: "2 elementos" },
  2: { name: "SVO Básicos", desc: "[Subject] + [Verb] + [Object]", es: "3 elementos" },
  3: { name: "Tiempo y Lugar", desc: "[S+V+O] + [Time/Place]", es: "4+ elementos" },
  4: { name: "Avanzados", desc: "Estructuras complejas", es: "condicionales" },
};

// Patterns por nivel (frame con slots + keywords requeridos para validación local)
const PATTERN_BY_LEVEL = {
  1: { frame: [{ k: "subject" }, { k: "verb" }], needKeys: { subject: true, verb: true } },
  2: { frame: [{ k: "subject" }, { k: "verb" }, { k: "object" }], needKeys: { subject: true, verb: true, object: true } },
  3: { frame: [{ k: "subject" }, { k: "verb" }, { k: "object" }, { k: "time" }], needKeys: { subject: true, verb: true, object: true, time: true } },
  4: { frame: [{ k: "subject" }, { k: "verb" }, { k: "object" }, { k: "place" }], needKeys: { subject: true, verb: true, object: true, place: true } },
};

// ---------- persistencia de aristas del usuario ----------
function persistUserEdge(src, rel, dst, extraWeight = 0.02) {
  try {
    const raw = localStorage.getItem(USER_GRAPH_KEY);
    const user = raw ? JSON.parse(raw) : { edges: [] };
    const exists = user.edges.find((e) => e.src === src && e.rel === rel && e.dst === dst);
    if (exists) exists.weight = Math.min(1, (exists.weight || 0.5) + extraWeight);
    else user.edges.push({ src, rel, dst, weight: 0.5 });
    localStorage.setItem(USER_GRAPH_KEY, JSON.stringify(user));
  } catch (e) { /* silencio */ }
}
function applyUserEdges(graph) {
  try {
    const raw = localStorage.getItem(USER_GRAPH_KEY);
    const user = raw ? JSON.parse(raw) : null;
    if (!user?.edges) return graph;
    for (const e of user.edges) {
      const idx = graph.edges.findIndex((x) => x.src === e.src && x.rel === e.rel && x.dst === e.dst);
      if (idx >= 0) graph.edges[idx] = { ...graph.edges[idx], weight: Math.min(1, graph.edges[idx].weight + e.weight) };
      else graph.edges.push(e);
    }
  } catch (e) { /* ignorar */ }
  return graph;
}

// Validación local: la oración tiene que contener las palabras del pattern.
// Pero solo exige lo que EL FRAME del nivel pide (ej. nivel 1 no tiene object).
function validateLocally(userText, picks, levelId) {
  const low = ` ${userText.toLowerCase().trim()} `;
  const issues = [];
  const need = PATTERN_BY_LEVEL[levelId].needKeys;

  if (need.subject && picks.agent) {
    const subj = picks.agent.toLowerCase();
    // "I", "he", "she", "we", "they", "the baby", "my mom"
    if (!low.includes(` ${subj}`) && !low.includes(`${subj} '`)) {
      issues.push(`¿Dónde está "${picks.agent}"?`);
    }
  }
  if (need.verb && picks.verb) {
    const v = picks.verb.toLowerCase();
    // aceptar: run, runs, is running, am running, are running, ran
    const variants = [v, v + "s", v + "es", `is ${v}ing`, `am ${v}ing`, `are ${v}ing`];
    // para verbos con -e como "take": "takes", "is taking"
    const withE = v.endsWith("e") ? [v.slice(0, -1) + "ing"] : [];
    const anyMatch = [...variants, ...withE].some((x) => low.includes(` ${x} `) || low.includes(` ${x}`) || low.endsWith(x));
    if (!anyMatch) issues.push(`Usa el verbo "${picks.verb}"`);
  }
  if (need.object && picks.object) {
    const o = picks.object.toLowerCase();
    if (!low.includes(o)) issues.push(`Te falta "${picks.object}"`);
  }
  // time/place opcional: solo validar si existen en picks
  if (need.time && picks.time) {
    const t = picks.time.toLowerCase();
    if (!low.includes(t)) issues.push(`Agrega "${picks.time}" para dar tiempo/lugar`);
  }
  if (need.place && picks.place) {
    const p = picks.place.toLowerCase();
    if (!low.includes(p)) issues.push(`Agrega "${picks.place}" como lugar`);
  }
  return { ok: issues.length === 0, issues };
}

export default function PracticeTab({ data, setData, learnedSet, wordbank, grantXp, activateStreak, styles }) {
  const [activeLevel, setActiveLevel] = useState(null);
  const [exercise, setExercise] = useState(null);
  const [userSentence, setUserSentence] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [completed, setCompleted] = useState(false);
  const [openLevel, setOpenLevel] = useState(null); // acordeón de niveles

  // grafo = seed + aristas del usuario + palabras aprendidas
  const graph = useMemo(() => {
    let g = buildSeedGraph();
    g = applyUserEdges(g);
    // fusionar palabras aprendidas del usuario: pueden agregar aristas nuevas
    if (wordbank?.size) {
      const merged = { ...g.nodes, ...Object.fromEntries(Array.from(wordbank.entries()).map(([id, node]) => [id, { ...node, id: node.id || id }])) };
      return indexGraph({ nodes: merged, edges: g.edges });
    }
    return indexGraph(g);
  }, [wordbank]);

  // patterns completados hoy, para el desbloqueo
  const patternProgress = useMemo(() => {
    const srs = data.patternSrs || {};
    const completedToday = {}; // { level: count }
    Object.values(srs).forEach((s) => {
      if (s.reps > 0) completedToday[s.level] = (completedToday[s.level] || 0) + 1;
    });
    return completedToday;
  }, [data.patternSrs]);

  const unlockedLevels = useMemo(() => {
    const done = patternProgress[1] || 0;
    const lvls = [1];
    if (done >= 2) lvls.push(2);
    if ((patternProgress[2] || 0) >= 2) lvls.push(3);
    if ((patternProgress[3] || 0) >= 2) lvls.push(4);
    return lvls;
  }, [patternProgress]);

  const startExercise = (levelId) => {
    setActiveLevel(levelId);
    setCheckResult(null);
    setUserSentence("");
    setCompleted(false);
    setOpenLevel(levelId);

    const patternDef = PATTERN_BY_LEVEL[levelId];
    const frameForGenerator = {
      frame: patternDef.frame.map((s) => ({
        slot: s.k,
        pos: s.k === "subject" ? ["pron", "noun"] : s.k === "verb" ? ["verb"] : ["noun"],
        role: s.k === "subject" ? "agent" : s.k === "verb" ? "verb" : s.k,
      })),
    };
    const result = fillPattern(frameForGenerator, graph);
    if (!result) {
      setExercise({ targetText: "Agrega más palabras a tu mapa para practicar este nivel.", picks: {} });
      return;
    }
    // Guardar el nivel del ejercicio junto al texto para validación correcta.
    // Esto resuelve "You eat meat" en nivel 1 (debería ser solo "You eat").
    setExercise({ targetText: result.text, picks: result.picks, level: levelId });
  };

  const checkUserSentence = async () => {
    if (!userSentence.trim() || !exercise || !exercise.picks?.verb) return;
    setChecking(true);
    setCheckResult(null);

    // 1) validación local — usa el nivel DEL EJERCICIO generado (puede ser distinto al
    // clickeado si el grafo no tenía palabras para ese nivel)
    const local = validateLocally(userSentence.trim(), exercise.picks, exercise.level || activeLevel);
    if (!local.ok) {
      setCheckResult({ correct: false, note: local.issues.join(" · ") });
      setChecking(false);
      return;
    }

    // 2) validación IA — prompt con SOLO los slots que el ejercicio generó
    const agent = exercise.picks.subject ?? exercise.picks.agent;
    const verb = exercise.picks.verb;
    const object = exercise.picks.object; // undefined en nivel 1 → no aparece en prompt
    const targetText = exercise.targetText;
    const userText = userSentence.trim();
    const slotDesc = [
      agent && `subject="${agent}"`,
      verb && `verb="${verb}"`,
      object && `object="${object}"`,
    ].filter(Boolean).join(", ");
    const prompt = `The student is learning English. The TARGET pattern is: "${targetText}" (${slotDesc}).
The student wrote: "${userText}"
Is "${userText}" grammatically correct AND does it use the target pattern structure? If the student used different words or changed the structure, mark as WRONG.
Respond with EXACTLY this format:
CORRECT
or
WRONG: <one short Spanish sentence explaining the error, max 12 words>`;

    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, max_tokens: 120 }),
      });
      const raw = (await res.json())?.content?.[0]?.text?.trim() || "";
      const firstLine = raw.split("\n")[0].trim();
      const isCorrect = /^correct/i.test(firstLine);
      const note = isCorrect
        ? "✓ Correcto — buena conjugación y estructura"
        : (firstLine.replace(/^wrong[:\s]*/i, "").trim() || "Revisa la estructura o las palabras del patrón");

      if (isCorrect) {
        setCheckResult({ correct: true, note });
        setCompleted(true);
        activateStreak();
        // persistir aristas usadas
        if (agent && verb) persistUserEdge(agent, "agent", verb);
        if (verb && object) persistUserEdge(verb, "object", object);
        // persistir pattern completado (usar exercise.level — el nivel real del ejercicio)
        const lvlDone = exercise.level || activeLevel;
        setData((prev) => ({
          ...prev,
          patternSrs: {
            ...(prev.patternSrs || {}),
            [`lvl${lvlDone}-${agent}-${verb}-${object || "x"}`]: { level: lvlDone, reps: 1, due: Date.now() + 86400000 },
          },
        }));
        grantXp(20);
      } else {
        setCheckResult({ correct: false, note });
      }
    } catch (e) {
      setCheckResult({ correct: false, note: `Error de conexión: ${e.message || e}` });
    }
    setChecking(false);
  };

  const levelDoneCount = (lvl) => patternProgress[lvl] || 0;

  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>Practice — Patterns</h2>
      <p style={styles.sectionBody}>
        Cada nivel usa palabras que ya conoces. Completa 2 patterns correctos para desbloquear el siguiente.
        La IA evalúa que uses la estructura generada.
      </p>

      {/* Acordeón de niveles */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {LEVELS.map((lvl) => {
          const unlocked = unlockedLevels.includes(lvl);
          const isOpen = openLevel === lvl;
          const meta = LEVEL_META[lvl];
          const doneCount = levelDoneCount(lvl);
          const needed = 2;
          const pct = Math.min(100, Math.round((doneCount / needed) * 100));

          return (
            <div key={lvl} style={{ ...styles.levelCard, opacity: unlocked ? 1 : 0.45 }}>
              {/* header del acordeón */}
              <button
                style={{ ...styles.levelHeader, cursor: unlocked ? "pointer" : "default" }}
                onClick={() => {
                  if (!unlocked) return;
                  setOpenLevel(isOpen ? null : lvl);
                  if (!isOpen) setActiveLevel(lvl);
                }}
                disabled={!unlocked}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                  {/* indicador de nivel + candado */}
                  <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, color: unlocked ? "#6FBF8B" : "#4a5763" }}>
                    Lv{lvl}
                  </span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: unlocked ? "#eae4d8" : "#71807d" }}>
                      {meta.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#8a9490" }}>{meta.desc} · {meta.es}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {unlocked && (
                    <>
                      <span style={{ fontSize: 11, color: doneCount >= 2 ? "#6FBF8B" : "#d9a441", fontFamily: "ui-monospace" }}>
                        {doneCount}/{needed}
                      </span>
                      <div style={styles.progressBarSm}>
                        <div style={{ ...styles.progressBarFillSm, width: `${pct}%` }} />
                      </div>
                    </>
                  )}
                  {!unlocked && <span style={{ fontSize: 11, color: "#4a5763" }}>🔒 2 patterns del nivel anterior</span>}
                  {unlocked && <ChevronRight size={15} style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />}
                </div>
              </button>

              {/* contenido expandible */}
              {isOpen && unlocked && (
                <div style={{ paddingTop: 10, borderTop: "1px solid #232d32" }}>
                  {!exercise || activeLevel !== lvl ? (
                    <button
                      style={styles.genBtn}
                      onClick={() => startExercise(lvl)}
                    >
                      <Sparkles size={15} />
                      Generar ejercicio
                    </button>
                  ) : (
                    <>
                      <p style={styles.formHint}>
                        Modelo: <b>{exercise.targetText}</b>
                      </p>
                      <input
                        style={styles.input}
                        placeholder={"Escribe tu oración..."}
                        value={userSentence}
                        onChange={(e) => { setUserSentence(e.target.value); setCheckResult(null); }}
                        disabled={completed}
                      />
                      {!completed ? (
                        <button
                          style={styles.genBtn}
                          onClick={checkUserSentence}
                          disabled={checking || !userSentence.trim()}
                        >
                          {checking ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
                          {checking ? "Evaluando…" : "Check my sentence"}
                        </button>
                      ) : (
                        <div>
                          <p style={{ ...styles.mineNote, color: "#6FBF8B", marginBottom: 8 }}>✓ Correcto! +20 XP</p>
                          <button style={styles.learnBtn} onClick={() => { setExercise(null); setUserSentence(""); setCheckResult(null); setCompleted(false); }}>
                            Next exercise <ChevronRight size={15} />
                          </button>
                        </div>
                      )}
                      {checkResult && (
                        <div style={{ ...styles.exampleBox, borderLeftColor: checkResult.correct ? "#3a5a42" : "#5a3a3a" }}>
                          <p style={checkResult.correct ? styles.exampleEn : { ...styles.exampleEn, color: "#d98c8c" }}>
                            {checkResult.correct ? "✓ " : ""}{userSentence}
                          </p>
                          <p style={styles.bridgeNote}>{checkResult.note}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
