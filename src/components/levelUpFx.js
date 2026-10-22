/* ---------- Level Up Progression — confeti + badge brillante ---------- */
/* Inyectar una vez (LevelUpBadge / LevelUpQuizModal lo importan). */
const LEVELUP_CSS_ID = "roots-levelup-css";

export function ensureLevelUpCss() {
  if (typeof document === "undefined") return;
  if (document.getElementById(LEVELUP_CSS_ID)) return;
  const el = document.createElement("style");
  el.id = LEVELUP_CSS_ID;
  el.textContent = `
@keyframes rootsConfetti {
  0% { transform: translateY(-20px) rotate(0deg); opacity: 1; }
  100% { transform: translateY(320px) rotate(720deg); opacity: 0; }
}
@keyframes rootsShine {
  0%, 100% { box-shadow: 0 0 6px rgba(217,164,65,0.55); }
  50% { box-shadow: 0 0 16px rgba(217,164,65,0.95), 0 0 4px rgba(255,220,140,0.9) inset; }
}
.roots-confetti-piece {
  position: absolute;
  top: 0;
  width: 9px;
  height: 13px;
  border-radius: 2px;
  animation: rootsConfetti 2.6s ease-in forwards;
  pointer-events: none;
}
.roots-badge-shine {
  animation: rootsShine 1.6s ease-in-out infinite;
}
`;
  document.head.appendChild(el);
}
