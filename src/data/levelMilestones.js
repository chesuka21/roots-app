/* ---------- Level Milestones — requisitos de ascenso CEFR ----------
   Cada ascenso (A1→A2 … C1→C2) exige 3 hitos acumulados:
   1. VOCABULARIO:  ≥ N palabras aprendidas ETIQUETADAS al nivel actual o superior
                    (cefr del nodo ≥ nivel actual).
   2. XP EN EL NIVEL: ≥ N XP ganados DESDE el último ascenso (xpAtLevelStart).
   3. MASTERED EN SRS: ≥ N palabras con reps ≥ 8 (fase hub) — dominio real,
                       no solo haberlas visto.

   Al cumplir los 3, el examen de ascenso se desbloquea. Si se aprueba (≥80%),
   cefr sube y xpAtLevelStart se resetea al XP actual.                     */

import { CEFR_ORDER, cefrIndex } from "./patterns-cefr.js";

/* Umbrales por ascenso — indexados por el nivel ACTUAL. El ejemplo del usuario:
   B2→C1 = 40 palabras B2 + 500 XP del nivel + 15 mastered. Escala progresiva. */
export const LEVEL_MILESTONES = {
  A1: { wordsAtLevel: 15, xpAtLevel: 150, mastered: 5 },
  A2: { wordsAtLevel: 20, xpAtLevel: 250, mastered: 8 },
  B1: { wordsAtLevel: 30, xpAtLevel: 350, mastered: 10 },
  B2: { wordsAtLevel: 40, xpAtLevel: 500, mastered: 15 },
  C1: { wordsAtLevel: 50, xpAtLevel: 700, mastered: 20 },
};

export const LEVELUP_PASS_SCORE = 0.8; // ≥80% aprueba
export const LEVELUP_BONUS_XP = 200;
export const LEVELUP_QUIZ_LENGTH = 8;

/* Nivel siguiente en la escalera CEFR (null si ya está en C2). */
export function nextCefr(cefr) {
  const i = cefrIndex(cefr);
  if (i < 0 || i >= CEFR_ORDER.length - 1) return null;
  return CEFR_ORDER[i + 1];
}

/* ¿Cuántas palabras domina el usuario (reps ≥ 8 = fase hub)? */
export function masteredCount(data) {
  return Object.values(data.srs || {}).filter((c) => (c?.reps || 0) >= 8).length;
}

/* Palabras del mapa etiquetadas al nivel actual o superior.
   Los nodos sin cefr explícito heredan el cefr del usuario (asignado al aprender). */
export function wordsAtLevelCount(data, cefr) {
  const min = cefrIndex(cefr);
  if (min < 0) return 0;
  return Object.values(data.nodes || {}).filter((n) => {
    if (!n || n.kind === "pattern" || !n.en) return false;
    const nodeIdx = cefrIndex(n.cefr || cefr);
    return nodeIdx >= min;
  }).length;
}

/* XP acumulado desde el último ascenso. */
export function xpAtLevel(data) {
  const xp = data.progression?.xp || 0;
  const start = data.progression?.xpAtLevelStart || 0;
  return Math.max(0, xp - start);
}

/* Progreso de cada hito (0..1) para pintar barras. */
export function milestoneProgress(data, cefr) {
  const m = LEVEL_MILESTONES[cefr];
  if (!m) return null;
  const words = wordsAtLevelCount(data, cefr);
  const xp = xpAtLevel(data);
  const mastered = masteredCount(data);
  return {
    words: { have: words, need: m.wordsAtLevel, pct: Math.min(1, words / m.wordsAtLevel) },
    xp: { have: xp, need: m.xpAtLevel, pct: Math.min(1, xp / m.xpAtLevel) },
    mastered: { have: mastered, need: m.mastered, pct: Math.min(1, mastered / m.mastered) },
    unlocked: words >= m.wordsAtLevel && xp >= m.xpAtLevel && mastered >= m.mastered,
    nextLevel: nextCefr(cefr),
  };
}
