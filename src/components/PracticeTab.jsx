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

// (validateLocally eliminada — sustituida por checkSentence dentro del componente)

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

  // ── Validador gramatical LOCAL (sin IA — funciona para cualquier pattern) ──
  // 1) Verifica que la oración use las palabras requeridas por el frame (verbo
  //    obligatorio; objeto/tiempo/lugar solo si el nivel los pide).
  // 2) Verifica concordancia sujeto-verbo: he/she/it/singular → verbo+s;
  //    I/you/we/they/plural → verbo base. Soporta continuos (is running) y pasado.
  function checkSentence(userText, picks, levelId) {
    const low = ` ${userText.toLowerCase().replace(/[.,!?;:'"]/g, " ").replace(/\s+/g, " ").trim()} `;
    const tokens = low.trim().split(" ");
    const issues = [];
    const need = PATTERN_BY_LEVEL[levelId].needKeys;

    const verbVal = picks.verb;
    const objectVal = picks.object;
    const timeVal = picks.time;
    const placeVal = picks.place;

    // — sujeto detectado: buscamos subtokens típicos para deducir singular/plural —
    const singularSubjects = /^he$|^she$|^it$|^the$|^my$|^his$|^her$|^this$|^that$|^a$|^an$/;
    const pluralSubjects = /^(i|you|we|they|people|everyone)$/;
    const firstWord = tokens[0] || "";
    let isSingular;
    if (/^(he|she|it|this|that)$/.test(firstWord)) isSingular = true;
    else if (pluralSubjects.test(firstWord)) isSingular = false;
    else if (singularSubjects.test(firstWord)) isSingular = true; // "the dog…", "my dad…"
    else isSingular = undefined; // no pudimos saber — no juzgamos concordancia

    if (need.verb && verbVal) {
      const base = verbVal.toLowerCase().replace(/^to /, "");
      const stem = base.endsWith("e") ? base.slice(0, -1) : base;
      // formas aceptadas encontradas en la oración
      const found = tokens.filter((t) => t === base || t === base + "s" || t === base + "es"
        || t === base + "ed" || t === base + "d" || t === stem + "ed"
        || t === base + "ing" || t === stem + "ing"
        || t.startsWith(stem) && (t.endsWith("ing") || t.endsWith("ed")));
      const hasContinuousAux = ["is", "am", "are", "was", "were"].some((a) => tokens.includes(a))
        && found.some((t) => t.endsWith("ing"));

      if (!found.length) {
        issues.push(`Debes usar el verbo "${verbVal}"`);
      } else if (!hasContinuousAux && isSingular !== undefined) {
        // concordancia en presente simple
        const used = found[0];
        const isThirdPersonForm = used === base + "s" || used === base + "es";
        const isPastForm = used.endsWith("ed") || /^(went|came|ate|ran|said|got|made|took|saw|felt|had|was|were|did)$/.test(used);
        if (!isPastForm) {
          if (isSingular && used === base) {
            issues.push(`Con he/she/it (singular) el verbo lleva -s: usa "${base}s" (ej. "he ${base}s")`);
          }
          if (!isSingular && isThirdPersonForm) {
            issues.push(`Con I/you/we/they el verbo va sin -s: usa "${base}"`);
          }
        }
      }
    }
    if (need.object && objectVal) {
      // objeto: acepta la palabra o su plural
      const o = objectVal.toLowerCase();
      const oTokens = o.split(" ");
      const allPresent = oTokens.every((w) => low.includes(` ${w} `) || low.includes(` ${w}s `) || low.includes(` ${w}s`));
      if (!allPresent) issues.push(`Te falta "${objectVal}"`);
    }
    if (need.time && timeVal) {
      if (!low.includes(timeVal.toLowerCase())) issues.push(`Agrega "${timeVal}"`);
    }
    if (need.place && placeVal) {
      if (!low.includes(placeVal.toLowerCase())) issues.push(`Agrega "${placeVal}"`);
    }
    return { ok: issues.length === 0, issues };
  }

  const checkUserSentence = async () => {
    if (!userSentence.trim() || !exercise || !exercise.picks?.verb) return;
    setChecking(true);
    setCheckResult(null);

    // 1) validación LOCAL completa — sin IA, funciona para cualquier pattern.
    //    Como checkSentence ya valida todo (palabra del frame + concordancia), si pasa
    //    aquí la oración es válida. La IA SOLO se consulta como mejora de feedback y
    //    nunca puede tirar abajo una oración que el validador local aprobó.
    const local = checkSentence(userSentence.trim(), exercise.picks, exercise.level || activeLevel);
    if (!local.ok) {
      setCheckResult({ correct: false, note: local.issues.join(" · ") });
      setChecking(false);
      return;
    }

    const agent = exercise.picks.subject ?? exercise.picks.agent;
    const verb = exercise.picks.verb;
    const object = exercise.picks.object;

    // 2) Si la validación local pasó → la oración es válida. SIN IA. Determinista.
    //    Funciona para cualquier pattern presente o futuro porque valida contra el frame.
    const accept = () => {
      setCheckResult({ correct: true, note: "✓ ¡Correcto! Buena estructura y concordancia." });
      setCompleted(true);
      activateStreak();
      if (agent && verb) persistUserEdge(agent, "agent", verb);
      if (verb && object) persistUserEdge(verb, "object", object);
      const lvlDone = exercise.level || activeLevel;
      setData((prev) => ({
        ...prev,
        patternSrs: {
          ...(prev.patternSrs || {}),
          [`lvl${lvlDone}-${agent}-${verb}-${object || "x"}`]: { level: lvlDone, reps: 1, due: Date.now() + 86400000 },
        },
      }));
      grantXp(20);
      setChecking(false);
    };
    accept();
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
