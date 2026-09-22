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
// fillPattern usa slot names como "subject"/"agent"/"object" — aquí los mapeamos.
function validateLocally(userText, picks, levelId) {
  const low = ` ${userText.toLowerCase().trim()} `;
  const issues = [];
  const need = PATTERN_BY_LEVEL[levelId].needKeys;

  // mapear slots: subject/agent son lo mismo; verb/verb; object/object; time/time; place/place
  const agentVal = picks.subject ?? picks.agent;
  const verbVal = picks.verb;
  const objectVal = picks.object;
  const timeVal = picks.time;
  const placeVal = picks.place;

  if (need.subject && agentVal) {
    // El sujeto es LIBRE: cualquier sujeto válido vale ("my dad", "the dog", "she"...)
    // Solo avisamos si el usuario repitió distinto — la IA decide si es gramática correcta.
  }
  if (need.verb && verbVal) {
    const v = verbVal.toLowerCase();
    // aceptar: run, runs, is running, am running, are running, ran, loved, loving...
    const variants = [v, v + "s", v + "es", v + "d", v + "ed", v + "ing", `is ${v}ing`, `am ${v}ing`, `are ${v}ing`];
    const withE = v.endsWith("e") ? [v.slice(0, -1) + "ing", v + "d"] : [];
    const anyMatch = [...variants, ...withE].some((x) => low.includes(` ${x} `) || low.includes(` ${x}`) || low.endsWith(x));
    if (!anyMatch) issues.push(`Debes usar el verbo "${verbVal}"`);
  }
  if (need.object && objectVal) {
    const o = objectVal.toLowerCase();
    if (!low.includes(o)) issues.push(`Te falta "${objectVal}"`);
  }
  if (need.time && timeVal) {
    const t = timeVal.toLowerCase();
    if (!low.includes(t)) issues.push(`Agrega "${timeVal}" para dar tiempo/lugar`);
  }
  if (need.place && placeVal) {
    const p = placeVal.toLowerCase();
    if (!low.includes(p)) issues.push(`Agrega "${placeVal}" como lugar`);
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

    const agent = exercise.picks.subject ?? exercise.picks.agent;
    const verb = exercise.picks.verb;
    const object = exercise.picks.object;
    const userText = userSentence.trim();

    // 2) validación IA — prompt con SOLO los slots que el ejercicio generó.
    // Timeout corto (20s) para no cortar en móvil/lentas; si falla, retry con Groq.
    async function aiValidate(maxTry = 1) {
      try {
        const res = await fetch("/api/claude", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            prompt: `English learner must write a sentence using the verb "${verb}" (any conjugation OK)${object ? ` and the object "${object}"` : ""}.
Student wrote: "${userText}"
Judge ONLY grammar correctness (conjugation, articles, word order). The subject can be ANY valid one (my dad, she, the dog...) — do NOT reject for a different subject.
Reply EXACTLY: CORRECT or WRONG: <short Spanish note, max 12 words>`,
            max_tokens: 80,
            force: "openrouter",
          }),
        });
        const raw = (await res.json())?.content?.[0]?.text?.trim() || "";
        // parsing tolerante: el modelo a veces responde "The sentence is CORRECT." o con markdown
        const clean = raw.replace(/[*_`#>]/g, "").toLowerCase();
        const hasWrong = /\bwrong|incorrect\b/.test(clean);
        const hasCorrect = /\bcorrect\b/.test(clean) && !hasWrong;
        const isCorrect = hasCorrect && !hasWrong;
        // nota: primera línea útil del modelo (después de quitar "wrong:" o "correct")
        const note = raw
          .replace(/[*_`#>]/g, "")
          .split("\n").map((l) => l.trim()).filter(Boolean)
          .map((l) => l.replace(/^(correct|wrong)[:\s.—-]*/i, "").trim())
          .filter((l) => l.length > 3)
          .join(" ") || "Revisa la estructura";
        return { isCorrect, note };
      } catch (e) {
        if (maxTry > 0) return aiValidate(maxTry - 1, true); // retry sin force
        throw e;
      }
    }

    try {
      const { isCorrect, note } = await aiValidate();

      if (isCorrect) {
        setCheckResult({ correct: true, note: "✓ Correcto! Perfecto — buena conjunción." });
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
      setCheckResult({ correct: false, note: `No pude validar: ${e.message || "timeout"}. Intenta de nuevo.` });
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
