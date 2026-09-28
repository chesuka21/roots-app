// Validación rápida de la lógica Pattern Nodes / CEFR (sin React)
import { PATTERN_NODES, TIER_TO_CEFR, CEFR_ORDER, cefrIndex, patternsForCefr, isAdvancedCefr, patternsForWord, linkWordToPatterns, ensurePatternNodes, templateAllowedForCefr } from "./src/data/patterns-cefr.js";

let fails = 0;
function check(name, cond) {
  if (cond) console.log(`  ✓ ${name}`);
  else { console.error(`  ✗ FAIL: ${name}`); fails++; }
}

console.log("— Mapeo tier → CEFR —");
check("beginner → A2", TIER_TO_CEFR.beginner === "A2");
check("intermediate → B1", TIER_TO_CEFR.intermediate === "B1");
check("advanced → B2", TIER_TO_CEFR.advanced === "B2");

console.log("— Techo de visibilidad por nivel —");
const a1 = patternsForCefr("A1").map((p) => p.id);
const b1 = patternsForCefr("B1").map((p) => p.id);
const b2 = patternsForCefr("B2").map((p) => p.id);
const c1 = patternsForCefr("C1").map((p) => p.id);
const c2 = patternsForCefr("C2").map((p) => p.id);
check("A1 solo ve A1 (2 patrones)", a1.length === 2 && a1.every((id) => PATTERN_NODES.find((p) => p.id === id).cefr === "A1"));
check("B1 ve A2+B1 (8 patrones, sin A1)", !b1.includes("pat-sv") && !b1.includes("pat-svo") && b1.length === 8);
check("B2 ve B1+B2 (9 patrones, sin A1/A2)", !b2.includes("pat-sv") && !b2.includes("pat-svo") && !b2.includes("pat-time") && b2.length === 9);
check("B2 NO recibe patrones elementales", !b2.some((id) => ["A1", "A2"].includes(PATTERN_NODES.find((p) => p.id === id).cefr)));
check("C1 ve B2+C1", c1.length === 8 && c1.includes("pat-inversion") && c1.includes("pat-collocation"));
check("C2 ve C1+C2 (incluye cleft)", c2.includes("pat-cleft") && c2.includes("pat-wishpast"));

console.log("— Estructuras avanzadas presentes —");
check("condicional mixto", !!PATTERN_NODES.find((p) => p.id === "pat-condmix"));
check("inversión", !!PATTERN_NODES.find((p) => p.id === "pat-inversion"));
check("phrasal verbs", !!PATTERN_NODES.find((p) => p.id === "pat-phrasal"));
check("conectores formales", !!PATTERN_NODES.find((p) => p.id === "pat-formalconn"));
check("collocations", !!PATTERN_NODES.find((p) => p.id === "pat-collocation"));

console.log("— Vinculación palabra → patterns —");
const wVerb = { id: "deadline", cat: "work", pos: "noun" };
const linksB2 = linkWordToPatterns(wVerb, "B2");
const linksA1 = linkWordToPatterns(wVerb, "A1");
check("deadline (work) en B2 → 3 patrones B1/B2", linksB2.length === 3 && linksB2.every((e) => ["B1", "B2"].includes(PATTERN_NODES.find((p) => p.id === e.target).cefr)));
check("deadline en A1 → solo patrones A1", linksA1.every((e) => PATTERN_NODES.find((p) => p.id === e.target).cefr === "A1"));
const wAdj = { id: "happy", cat: "feelings", pos: "adj" };
const linksAdj = linkWordToPatterns(wAdj, "B1");
check("happy (adj) en B1 → patrones con match adj", linksAdj.length > 0 && linksAdj.every((e) => ["A2", "B1"].includes(PATTERN_NODES.find((p) => p.id === e.target).cefr)));
const wCustom = { id: "zzz-custom", cat: "custom", pos: "noun" };
const customLinks = linkWordToPatterns(wCustom, "B2");
check("palabra sin match → 0 vínculos (sin crash)", Array.isArray(customLinks) && customLinks.every((e) => ["B1", "B2"].includes(PATTERN_NODES.find((p) => p.id === e.target).cefr)));

console.log("— Idempotencia de nodos —");
const nodes1 = ensurePatternNodes({ study: { id: "study", en: "study" } });
check("inyecta 20 pattern nodes", Object.values(nodes1).filter((n) => n.kind === "pattern").length === PATTERN_NODES.length);
check("conserva el nodo original", nodes1.study.en === "study");
const nodes2 = ensurePatternNodes(nodes1);
check("idempotente (no duplica)", Object.keys(nodes2).length === Object.keys(nodes1).length);

console.log("— Plantillas del banco permitidas por CEFR —");
check("plantilla lvl1 permitida en A1", templateAllowedForCefr({ level: 1 }, "A1") === true);
check("plantilla lvl4 (B2) NO permitida en A1", templateAllowedForCefr({ level: 4 }, "A1") === false);
check("plantilla lvl4 permitida en B2", templateAllowedForCefr({ level: 4 }, "B2") === true);
check("plantilla lvl3 permitida en C1 (techo +1)", templateAllowedForCefr({ level: 3 }, "C1") === true);

console.log("— isAdvancedCefr —");
check("A2 no avanzado", isAdvancedCefr("A2") === false);
check("B2 avanzado", isAdvancedCefr("B2") === true);
check("C2 avanzado", isAdvancedCefr("C2") === true);

console.log(fails === 0 ? "\nTODOS LOS TESTS PASAN ✓" : `\n${fails} TESTS FALLAN ✗`);
process.exit(fails === 0 ? 0 : 1);
