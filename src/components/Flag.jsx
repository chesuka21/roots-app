/* ---------- Flag — banderas SVG inline (sin emojis) ----------
   Los emojis de bandera (🇫🇷 etc.) NO se renderizan en Windows/Chrome de
   escritorio (aparecen como "FR" texto plano). Este componente dibuja
   banderas circulares en SVG puro — cero dependencias, se ven igual en
   todos los sistemas. size = diámetro en px.                          */

const CIRCUM = "M32 4a28 28 0 1 1 0 56a28 28 0 1 1 0-56"; // círculo r28

function Frame({ children, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: "inline-block", verticalAlign: "-0.15em", flexShrink: 0 }} aria-hidden="true">
      <defs>
        <clipPath id="flagClip"><circle cx="32" cy="32" r="28" /></clipPath>
      </defs>
      <g clipPath="url(#flagClip)">{children}</g>
      <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
    </svg>
  );
}

/* FR/IT: tres franjas verticales */
function Vertical({ left, mid, right }) {
  return (
    <>
      <rect x="0" y="0" width="22" height="64" fill={left} />
      <rect x="22" y="0" width="20" height="64" fill={mid} />
      <rect x="42" y="0" width="22" height="64" fill={right} />
    </>
  );
}

/* DE/ES: franjas horizontales */
function Horizontal({ colors }) {
  const h = 64 / colors.length;
  return colors.map((c, i) => <rect key={i} x="0" y={i * h} width="64" height={h} fill={c} />);
}

/* EN: Union Jack simplificado */
function UK() {
  return (
    <>
      <rect x="0" y="0" width="64" height="64" fill="#012169" />
      <path d="M0 0 L64 64 M64 0 L0 64" stroke="#fff" strokeWidth="12" />
      <path d="M0 0 L64 64 M64 0 L0 64" stroke="#C8102E" strokeWidth="6" />
      <path d="M32 0 V64 M0 32 H64" stroke="#fff" strokeWidth="16" />
      <path d="M32 0 V64 M0 32 H64" stroke="#C8102E" strokeWidth="9" />
    </>
  );
}

/* PT: verde + rojo con esfera amarilla */
function PT() {
  return (
    <>
      <rect x="0" y="0" width="26" height="64" fill="#046A38" />
      <rect x="26" y="0" width="38" height="64" fill="#DA291C" />
      <circle cx="26" cy="32" r="10" fill="#FFE900" stroke="#B8860B" strokeWidth="1.5" />
    </>
  );
}

export default function Flag({ code, size = 18 }) {
  const s = size;
  switch ((code || "").toLowerCase()) {
    case "en":
    case "gb":
      return <Frame size={s}><UK /></Frame>;
    case "fr":
      return <Frame size={s}><Vertical left="#0055A4" mid="#FFFFFF" right="#EF4135" /></Frame>;
    case "de":
      return <Frame size={s}><Horizontal colors={["#000000", "#DD0000", "#FFCE00"]} /></Frame>;
    case "it":
      return <Frame size={s}><Vertical left="#009246" mid="#FFFFFF" right="#CE2B37" /></Frame>;
    case "pt":
      return <Frame size={s}><PT /></Frame>;
    case "es":
      return <Frame size={s}><Horizontal colors={["#AA151B", "#F1BF00", "#AA151B"]} /></Frame>;
    default:
      return <Frame size={s}><rect x="0" y="0" width="64" height="64" fill="#5a6b75" /></Frame>;
  }
}
