/* ---------- Level Milestones — requisitos de ascenso CEFR (tabla estricta) ----------
   Cada ascenso exige 3 hitos + define el examen del salto:

   Nivel    Palabras   Dominadas   XP total   Examen   Bono
   A1 → A2     25         10         250       75%     +150
   A2 → B1     40         20         600       80%     +250
   B1 → B2     60         35        1200       80%     +400
   B2 → C1     80         50        2000       85%     +600
   C1 → C2    100         70        3500       85%    +1000

   "Dominada" = tarjeta SRS con intervalo > 21 días (srs_stage ≥ 4):
   la memoria a largo plazo ya consolidó la palabra, no solo se la vio.

   Si el examen se falla, el reintento queda bloqueado (levelUpFailLock) hasta
   completar una sesión adicional de repaso (ver gradeReview/nextReviewCard). */

import { CEFR_ORDER, cefrIndex } from "./patterns-cefr.js";

export const LEVEL_MILESTONES = {
  A1: { words: 25, mastered: 10, xp: 250, passScore: 0.75, bonusXp: 150 },
  A2: { words: 40, mastered: 20, xp: 600, passScore: 0.8, bonusXp: 250 },
  B1: { words: 60, mastered: 35, xp: 1200, passScore: 0.8, bonusXp: 400 },
  B2: { words: 80, mastered: 50, xp: 2000, passScore: 0.85, bonusXp: 600 },
  C1: { words: 100, mastered: 70, xp: 3500, passScore: 0.85, bonusXp: 1000 },
};

export const LEVELUP_QUIZ_LENGTH = 8;
export const MASTERED_INTERVAL_DAYS = 21; // intervalo > 21 días = dominada

/* Nivel siguiente en la escalera CEFR (null si ya está en C2). */
export function nextCefr(cefr) {
  const i = cefrIndex(cefr);
  if (i < 0 || i >= CEFR_ORDER.length - 1) return null;
  return CEFR_ORDER[i + 1];
}

/* Palabras dominadas: intervalo SRS > 21 días (memoria consolidada). */
export function masteredCount(data) {
  return Object.values(data.srs || {}).filter((c) => c && (c.interval || 0) > MASTERED_INTERVAL_DAYS).length;
}

/* Palabras totales del mapa (sin pattern-nodes). */
export function totalWordsCount(data) {
  return Object.values(data.nodes || {}).filter((n) => n && n.kind !== "pattern" && n.en).length;
}

/* XP total acumulado. */
export function totalXp(data) {
  return data.progression?.xp || 0;
}

/* ── VALIDADOR PRINCIPAL: ¿el usuario puede presentar el examen? ──
   Devuelve { eligible, milestonesMet, lock, nextLevel, passScore, bonusXp, progress }
   o null en C2 (no hay ascenso). progress trae have/need/pct de cada hito. */
export function checkLevelUpEligibility(data) {
  const cefr = data?.cefr || "A1";
  const m = LEVEL_MILESTONES[cefr];
  const next = nextCefr(cefr);
  if (!m || !next) return null; // C2: no hay ascenso

  const words = totalWordsCount(data);
  const mastered = masteredCount(data);
  const xp = totalXp(data);
  const pct = (have, need) => (need > 0 ? Math.min(1, have / need) : 1);
  const progress = {
    words: { have: words, need: m.words, pct: pct(words, m.words) },
    mastered: { have: mastered, need: m.mastered, pct: pct(mastered, m.mastered) },
    xp: { have: xp, need: m.xp, pct: pct(xp, m.xp) },
  };
  const milestonesMet = words >= m.words && mastered >= m.mastered && xp >= m.xp;
  const lock = Boolean(data?.levelUpFailLock); // falló el examen → reintento tras repasar
  return {
    eligible: milestonesMet && !lock,
    milestonesMet,
    lock,
    nextLevel: next,
    currentLevel: cefr,
    passScore: m.passScore,
    bonusXp: m.bonusXp,
    progress,
  };
}

/* Compatibilidad con la vista de progreso en Ajustes (barras have/need/pct). */
export function milestoneProgress(data, cefr) {
  const check = checkLevelUpEligibility({ ...data, cefr: cefr || data?.cefr });
  if (!check) return null;
  return { ...check.progress, unlocked: check.eligible, milestonesMet: check.milestonesMet, lock: check.lock, nextLevel: check.nextLevel, passScore: check.passScore, bonusXp: check.bonusXp };
}
