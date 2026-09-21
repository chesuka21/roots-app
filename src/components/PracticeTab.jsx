/* ---------- Practice Tab — Patterns dinámicos con grafo semántico ----------
   Cada nivel usa palabras REALES del vocabulario del usuario (aprendidas +
   wordbank). Completar 2 patterns de un nivel desbloquea el siguiente.
   Generación: grafo tipado directamente (sin llamada al endpoint) para
   respuesta instantánea offline. */
import { useState, useMemo } from "react";
import { Sparkles, Loader2, ChevronRight, Lock, Check, X } from "lucide-react";
import { fillFrame, buildDrills, frameToText, autoLevel, PATTERN_LEVELS } from "../data/patterns.js";
import { buildSeedGraph, indexGraph, objectsOf, agentsOf } from "../lib/graph.js";
import { fillPattern } from "../lib/generator.js";

// niveles fijos del sistema (igual a PATTERN_LEVELS)
const LEVELS = PATTERN_LEVELS.map((l) => l.id); // [1,2,3,4]

// Patterns semilla: mínimo viable por nivel (los creados por el usuario se expanden)
const PATTERN_BY_LEVEL = {
  1: { // Subject + Action
    frame: [{ k: "subject" }, { k: "verb" }],
  },
  2: { // SVO
    frame: [{ k: "subject" }, { k: "verb" }, { k: "object" }],
  },
  3: { // SVO + Tiempo (o Place)
    frame: [{ k: "subject" }, { k: "verb" }, { k: "object" }, { k: "time" }],
  },
  4: { // Avanzado — necesita vocab de casa
    frame: [{ k: "subject" }, { k: "verb" }, { k: "object" }, { k: "place" }],
  },
};

// Persistencia de grafo del usuario (keys de localStorage)
const USER_GRAPH_KEY = "roots-graph-v1";

// Guarda/actualiza el peso de una arista user (la aprendida en practice).
// Formato: { src: "i", rel: "agent", dst: "drink", weight }
function persistUserEdge(graph, src, rel, dst, extraWeight = 0.02) {
  try {
    const raw = localStorage.getItem(USER_GRAPH_KEY);
    const user = raw ? JSON.parse(raw) : { edges: [] };
    const exists = user.edges.find((e) => e.src === src && e.rel === rel && e.dst === dst);
    if (exists) {
      exists.weight = Math.min(1, (exists.weight || 0.5) + extraWeight);
    } else {
      user.edges.push({ src, rel, dst, weight: 0.5 });
    }
    localStorage.setItem(USER_GRAPH_KEY, JSON.stringify(user));
  } catch (e) { /* silencio — localStorage lleno o no accesible */ }
}
// Applicar aristas del usuario al grafo (se llama al cargar)
function applyUserEdges(graph) {
  try {
    const raw = localStorage.getItem(USER_GRAPH_KEY);
    const user = raw ? JSON.parse(raw) : null;
    if (!user?.edges) return graph;
    for (const e of user.edges) {
      // si ya existe una arista idéntica en el seed, sumamos el peso
      const idx = graph.edges.findIndex((x) => x.src === e.src && x.rel === e.rel && x.dst === e.dst);
      if (idx >= 0) graph.edges[idx] = { ...graph.edges[idx], weight: Math.min(1, graph.edges[idx].weight + e.weight) };
      else graph.edges.push(e);
    }
  } catch (e) { /* sin user graph — usamos seed limpio */ }
  return graph;
}

export default function PracticeTab({
  data, setData,
  learnedSet, wordbank,           // Map<id, node>
  settings,                       // voz/settings (pa TTS)
  grantXp, activateStreak,        // gamificación
  onUnlockLevel,                  // cb cuando se desbloquea un nivel nuevo
  styles,
}) {
  const [activeLevel, setActiveLevel] = useState(null);   // nivel elegido
  const [exercise, setExercise] = useState(null);         // { target, source, frame, allowedWords }
  const [exerciseLevel, setExerciseLevel] = useState(null);
  const [userSentence, setUserSentence] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [completed, setCompleted] = useState(false);

  const graph = useMemo(() => {
    let g = buildSeedGraph();
    g = applyUserEdges(g); // fusiona aristas usadas por el usuario en su propia práctica
    // Combinar con nodos aprendidos del usuario (agregan aristas desde wordbank + usuario)
    if (!wordbank?.size) return indexGraph(g);
    const merged = { ...g.nodes, ...Object.fromEntries(Array.from(wordbank.entries()).map(([id, node]) => [id, { ...node }])) };
    return indexGraph({ nodes: merged, edges: g.edges });
  }, [wordbank]);

  const setUserPatternData = (fnOrValue) => {
    setData((prev) => {
      const next = typeof fnOrValue === "function" ? fnOrValue(prev) : fnOrValue;
      return next;
    });
  };

  // calcula qué niveles están desbloqueados
  const unlockedLevels = useMemo(() => {
    const srs = data.patternSrs || {};
    const unlocked = [1]; // siempre el primero
    for (let lvl = 1; lvl < 4; lvl++) {
      const needed = 2; // completar 2 del nivel actual para desbloquear
      const done = Object.values(srs).filter((s) => s.level === lvl && s.reps > 0).length;
      if (done >= needed) unlocked.push(lvl + 1);
    }
    return unlocked;
  }, [data.patternSrs]);

  const startExercise = (levelId) => {
    setActiveLevel(levelId);
    setCheckResult(null);
    setUserSentence("");
    setCompleted(false);

    // genera oración a completar según nivel — el generador necesita roles
    // en cada slot (subject/agent + los objetos), así que mapeamos nuestro frame
    const pattern = {
      frame: PATTERN_BY_LEVEL[levelId].frame.map((s, i) => {
        // pos según el tipo de slot conocido
        const roleMap = { subject: "agent", verb: "verb", object: "object", time: "time", place: "place" };
        const posMap = { subject: ["pron", "noun"], verb: ["verb"], object: ["noun"], time: ["noun"], place: ["noun"] };
        return { slot: s.k, pos: posMap[s.k] || ["noun"], role: roleMap[s.k] || s.k };
      }),
    };
    const result = fillPattern(pattern, graph);
    if (!result) {
      setExercise({ text: "Completa tu vocabulario para practicar este nivel", words: {} });
      return;
    }
    setExercise({
      targetText: result.text,          // texto completo (para comparar)
      skeleton: fillFrame(pattern.frame, result.picks), // para mostrar con blanks si quisiéramos
      picks: result.picks,
    });
  };

  const checkUserSentence = async () => {
    if (!userSentence.trim() || !exercise) return;
    setChecking(true);
    try {
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt: `You are an English grammar checker for a Spanish learner. Compare the user's sentence with the target pattern.
                
Target pattern: "${exercise.targetText}"
User wrote: "${userSentence.trim()}"

Is the user's sentence grammatically correct AND semantically appropriate to express the same idea (even with different structure)? Respond ONLY valid JSON:
{"correct": true|false, "reason": "short explanation in Spanish under 20 words"}`,
          max_tokens: 150,
          force: "openrouter", // forzar el proveedor más económico si existe
        }),
      });
      const parsed = await res.json();
      let dataOut = null;
      try { dataOut = JSON.parse(parsed.content[0].text); } catch (e) { /* fallback */ }

      if (dataOut?.correct) {
        setCheckResult({ correct: true, note: dataOut.reason || "Perfecto!" });
        setCompleted(true);
        activateStreak();
        // Persistir aristas usadas: agent→verb→object — cada combinación correcta
        // sube su peso y la próxima práctica la sugerirá más a menudo.
        if (exercise?.picks) {
          const { agent, verb, object } = exercise.picks;
          if (agent && verb) persistUserEdge(graph, agent, "agent", verb);
          if (verb && object) persistUserEdge(graph, verb, "object", object);
        }
        // marcar pattern como aprendido
        const level = activeLevel;
        setUserPatternData((prev) => ({
          ...prev,
          patternSrs: {
            ...prev.patternSrs,
            [`lvl${level}-${exercise.picks?.verb}-${exercise.picks?.object}`]: { level, reps: 1, due: Date.now() + 86400000 },
          },
        }));
        grantXp(20); // XP base por pattern correcto
        // Desbloqueo progresivo: si completaste 2 patterns del nivel máximo disponible,
        // el siguiente nivel se desbloquea (memoizado en unlockedLevels se recalcula
        // en el próximo render porque data.patternSrs cambia).
        const topUnlocked = unlockedLevels[unlockedLevels.length - 1];
        if (activeLevel === topUnlocked && onUnlockLevel) {
          const nextLvl = activeLevel + 1;
          if (nextLvl <= 4 && !unlockedLevels.includes(nextLvl)) {
            setTimeout(() => onUnlockLevel(nextLvl), 1200);
          }
        }
      } else {
        setCheckResult({ correct: false, note: dataOut?.reason || "Intenta de nuevo — la gramática puede mejorar" });
      }
    } catch (e) {
      setCheckResult({ correct: false, note: `No pude validar: ${e.message || "error de red"}` });
    }
    setChecking(false);
  };

  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>Practice — Patterns</h2>
      <p style={styles.sectionBody}>
        Completa oraciones siguiendo patrones. Cada nivel usa tus palabras aprendidas. Desbloquea niveles practicando.
      </p>

      {/* Nivel select */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {LEVELS.map((lvl) => {
          const isUnlocked = unlockedLevels.includes(lvl);
          return (
            <button
              key={lvl}
              onClick={() => isUnlocked && startExercise(lvl)}
              disabled={!isUnlocked}
              style={{
                ...(activeLevel === lvl ? styles.tabActive : styles.tab),
                opacity: isUnlocked ? 1 : 0.4,
                position: "relative",
              }}
            >
              {!isUnlocked && <Lock size={11} style={{ position: "absolute", top: -4, right: -4 }} />}
              Level {lvl}
            </button>
          );
        })}
      </div>

      {exercise && (
        <>
          <p style={styles.formHint}>
            Modelo: <b>{exercise.targetText}</b>
          </p>
          <input
            style={styles.input}
            placeholder="Escribe tu versión..."
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
              {checking ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
              {checking ? "Evaluando…" : "Check"}
            </button>
          ) : (
            <div>
              <p style={{ ...styles.mineNote, color: "#6FBF8B" }}>✓ Correcto! +20 XP</p>
              <button style={styles.learnBtn} onClick={() => { setExercise(null); setActiveLevel(null); }}>
                Next <ChevronRight size={16} />
              </button>
            </div>
          )}
          {checkResult && (
            <div style={{ ...(checkResult.correct ? styles.exampleBox : { ...styles.exampleBox, borderLeftColor: "#d98c8c" }) }}>
              <p style={checkResult.correct ? styles.exampleEn : { ...styles.exampleEn, color: "#d98c8c" }}>
                {checkResult.correct ? `✓ ${userSentence}` : userSentence}
              </p>
              <p style={styles.bridgeNote}>{checkResult.note}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
