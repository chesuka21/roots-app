/* ---------- Vocabulary Table — vista tipo Excel del mapa mental ----------
   Renderiza todas las palabras del grafo en una tabla con filtros y búsqueda
   tipo Excel: término/definición, CEFR, partOfSpeech, nodos aislados, orden.
   Conectada en TIEMPO REAL con el estado del mapa: las acciones ("Ver en el
   Mapa", editar conexiones) operan directamente sobre data/setData.

   FASE SRS de cada fila (del edgeEngine):
   initial (0-3 reps) · intermediate (4-7) · advanced/hub (8+).            */

import { useMemo, useState } from "react";
import {
  Table2, Search, Filter, Eye, Link2, X, Check, ChevronUp, ChevronDown,
  Unlink, MousePointerClick,
} from "lucide-react";
import { cefrIndex, CEFR_ORDER } from "../data/patterns-cefr.js";
import { maturityPhase, edgeWidth } from "../lib/edgeEngine.js";

/* Colores por partOfSpeech (misma paleta del grafo) */
const POS_LABEL = {
  noun: "Noun", verb: "Verb", adjective: "Adjective", adverb: "Adverb",
  "phrasal verb": "Phrasal Verb", idiom: "Idiom",
};
const POS_COLOR = {
  noun: "#3B82F6", verb: "#22C55E", adjective: "#F59E0B", adverb: "#C9A6D8",
  "phrasal verb": "#A855F7", idiom: "#A855F7",
};

const PHASE_LABEL = { initial: "Inicial", intermediate: "Intermedia", advanced: "Hub" };
const PHASE_COLOR = { initial: "#8a9490", intermediate: "#D9A441", advanced: "#6FBF8B" };

/* Traducción de fecha próxima de repaso: "hoy", "en N días", "vencida" */
function dueLabel(due, now, t) {
  if (!due) return "—";
  const days = Math.ceil((due - now) / 86400000);
  if (days <= 0) return t("Vencida");
  if (days === 1) return t("mañana");
  return t("en") + " " + days + " " + t("días");
}

export default function VocabularyTable({ data, setData, styles, t = (k) => k, onViewInMap, onEditConnections, cloudSyncing, cloudError }) {
  const [query, setQuery] = useState("");
  const [cefrFilter, setCefrFilter] = useState("all");
  const [posFilter, setPosFilter] = useState("all");
  const [isolatedOnly, setIsolatedOnly] = useState(false);
  const [sortKey, setSortKey] = useState("added"); // added | reviews | word
  const [sortDir, setSortDir] = useState("desc");
  const [editingId, setEditingId] = useState(null);
  const [editList, setEditList] = useState([]);
  const [savedFlash, setSavedFlash] = useState(null); // id guardado ✓

  const now = Date.now();

  /* ── Índice de conexiones por nodo (una pasada) ── */
  const connIndex = useMemo(() => {
    const idx = {};
    for (const e of data.edges || []) {
      // solo aristas palabra↔palabra (los pattern-nodes no cuentan como conexiones)
      const sp = data.nodes[e.source]?.kind === "pattern";
      const tp = data.nodes[e.target]?.kind === "pattern";
      if (sp || tp) continue;
      if (!data.nodes[e.source] || !data.nodes[e.target]) continue; // huérfanas fuera
      (idx[e.source] = idx[e.source] || new Set()).add(e.target);
      (idx[e.target] = idx[e.target] || new Set()).add(e.source);
    }
    return idx;
  }, [data.edges, data.nodes]);

  /* ── Filas: todas las palabras (no pattern-nodes) ── */
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = Object.values(data.nodes || {}).filter((n) => n && n.kind !== "pattern" && n.en);
    if (q) list = list.filter((n) => n.en.toLowerCase().includes(q) || (n.def || "").toLowerCase().includes(q));
    if (cefrFilter !== "all") list = list.filter((n) => (n.cefr || inferCefr(n)) === cefrFilter);
    if (posFilter !== "all") list = list.filter((n) => (n.pos || "—") === posFilter);
    if (isolatedOnly) list = list.filter((n) => (connIndex[n.id]?.size || 0) === 0);

    const addedAt = (n) => n.addedAt || n.updatedAt || 0;
    const reviewsOf = (n) => data.srs?.[n.id]?.reps || 0;
    const dir = sortDir === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sortKey === "word") return a.en.localeCompare(b.en) * dir;
      if (sortKey === "reviews") return (reviewsOf(a) - reviewsOf(b)) * dir;
      return (addedAt(a) - addedAt(b)) * dir; // added
    });
    return list;
  }, [data.nodes, data.srs, connIndex, query, cefrFilter, posFilter, isolatedOnly, sortKey, sortDir]);

  /* CEFR del nodo: explícito, o inferido del nivel del usuario (A2 por defecto) */
  function inferCefr(n) {
    return n.cefr || null;
  }

  /* ── Edición de conexiones inline (igual lógica que el modal del mapa) ── */
  const startEdit = (row) => {
    const conn = [...(connIndex[row.id] || [])];
    setEditList(conn);
    setEditingId(row.id);
  };
  const toggleConn = (targetId) => {
    setEditList((l) => (l.includes(targetId) ? l.filter((x) => x !== targetId) : [...l, targetId]));
  };
  const applyEdit = () => {
    if (!editingId) return;
    setData((prev) => {
      // borrar las aristas palabra↔palabra del nodo y recrear con la selección
      const others = (prev.edges || []).filter((e) => {
        if (e.source !== editingId && e.target !== editingId) return true;
        const otherId = e.source === editingId ? e.target : e.source;
        return prev.nodes[otherId]?.kind === "pattern"; // las pattern links se conservan
      });
      const fresh = editList
        .filter((id) => prev.nodes[id] && id !== editingId)
        .map((id) => ({ source: editingId, target: id, sentence: "", rel: "user" }));
      const nodes = { ...prev.nodes, [editingId]: { ...prev.nodes[editingId], updatedAt: Date.now() } };
      return { ...prev, edges: [...others, ...fresh], nodes };
    });
    setSavedFlash(editingId);
    setTimeout(() => setSavedFlash(null), 1600);
    setEditingId(null);
    setEditList([]);
  };

  const posOptions = [...new Set(Object.values(data.nodes || {}).filter((n) => n?.pos).map((n) => n.pos))];
  const isolatedCount = Object.values(data.nodes || {}).filter((n) => n && n.kind !== "pattern" && n.en && (connIndex[n.id]?.size || 0) === 0).length;

  return (
    <div style={styles.section}>
      <h2 style={styles.sectionTitle}>
        <Table2 size={18} color="#9fd9b8" style={{ verticalAlign: "-3px", marginRight: 7 }} />
        {t("Vocabulary Table")}
      </h2>
      <p style={styles.sectionBody}>
        {t("Todas las palabras de tu mapa en una vista tipo Excel — filtra, ordena y conecta sin salir de la tabla.")}
      </p>

      {/* ── Barra de filtros tipo Excel ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <div style={{ position: "relative", flex: "1 1 200px", minWidth: 170 }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#5a6763" }} />
          <input
            style={{ ...styles.input, paddingLeft: 30, margin: 0 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Buscar palabra o definición…")}
          />
        </div>
        <select style={{ ...styles.input, margin: 0, width: "auto" }} value={cefrFilter} onChange={(e) => setCefrFilter(e.target.value)}>
          <option value="all">{t("Todos los niveles")}</option>
          {CEFR_ORDER.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select style={{ ...styles.input, margin: 0, width: "auto" }} value={posFilter} onChange={(e) => setPosFilter(e.target.value)}>
          <option value="all">{t("Todas las categorías")}</option>
          {posOptions.map((p) => <option key={p} value={p}>{POS_LABEL[p] || p}</option>)}
        </select>
        <button
          style={isolatedOnly ? styles.tabActive : styles.tab}
          onClick={() => setIsolatedOnly((v) => !v)}
          title={t("Palabras sin conexiones")}
        >
          <Unlink size={13} style={{ verticalAlign: "-2px" }} /> {t("Aisladas")} ({isolatedCount})
        </button>
      </div>

      {/* ── Tabla ── */}
      <div style={{ overflowX: "auto", border: "1px solid #232d32", borderRadius: 10 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5, minWidth: 720 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#8a9490", borderBottom: "1px solid #232d32" }}>
              <th style={{ padding: "8px 10px", cursor: "pointer", whiteSpace: "nowrap" }} onClick={() => { setSortKey("word"); setSortDir(sortKey === "word" && sortDir === "asc" ? "desc" : "asc"); }}>
                {t("Palabra")} {sortKey === "word" && (sortDir === "asc" ? <ChevronUp size={12} style={{ verticalAlign: "-2px" }} /> : <ChevronDown size={12} style={{ verticalAlign: "-2px" }} />)}
              </th>
              <th style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{t("Categoría")}</th>
              <th style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>CEFR</th>
              <th style={{ padding: "8px 10px" }}>{t("Definición")}</th>
              <th style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{t("Conexiones")}</th>
              <th style={{ padding: "8px 10px", cursor: "pointer", whiteSpace: "nowrap" }} onClick={() => { setSortKey("reviews"); setSortDir(sortKey === "reviews" && sortDir === "asc" ? "desc" : "asc"); }}>
                {t("SRS")} {sortKey === "reviews" && (sortDir === "asc" ? <ChevronUp size={12} style={{ verticalAlign: "-2px" }} /> : <ChevronDown size={12} style={{ verticalAlign: "-2px" }} />)}
              </th>
              <th style={{ padding: "8px 10px", cursor: "pointer", whiteSpace: "nowrap" }} onClick={() => { setSortKey("added"); setSortDir(sortKey === "added" && sortDir === "asc" ? "desc" : "asc"); }}>
                {t("Añadida")} {sortKey === "added" && (sortDir === "asc" ? <ChevronUp size={12} style={{ verticalAlign: "-2px" }} /> : <ChevronDown size={12} style={{ verticalAlign: "-2px" }} />)}
              </th>
              <th style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{t("Acciones")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 18, textAlign: "center", color: "#5a6763" }}>{t("Sin resultados con estos filtros.")}</td></tr>
            )}
            {rows.map((n) => {
              const card = data.srs?.[n.id];
              const reps = card?.reps || 0;
              const phase = maturityPhase(card);
              const conns = [...(connIndex[n.id] || [])].map((id) => data.nodes[id]?.en).filter(Boolean);
              const due = card?.due ? dueLabel(card.due, now, t) : "—";
              const isEditing = editingId === n.id;
              return (
                <tr key={n.id} style={{ borderBottom: "1px solid #1a2228", background: isEditing ? "#17211f" : "transparent" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 600, color: "#eae4d8" }}>{n.en}</td>
                  <td style={{ padding: "8px 10px" }}>
                    {n.pos ? (
                      <span style={{ color: POS_COLOR[n.pos] || "#8a9490", fontWeight: 600, fontSize: 12.5 }}>{POS_LABEL[n.pos] || n.pos}</span>
                    ) : <span style={{ color: "#5a6763" }}>—</span>}
                  </td>
                  <td style={{ padding: "8px 10px", fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#8CC9D9" }}>{n.cefr || "—"}</td>
                  <td style={{ padding: "8px 10px", color: "#b7c2be", fontSize: 13, maxWidth: 220 }}>
                    {n.def ? (n.def.length > 60 ? n.def.slice(0, 57) + "…" : n.def) : <span style={{ color: "#5a6763" }}>—</span>}
                  </td>
                  {/* Conexiones: contador + lista rápida + editor inline */}
                  <td style={{ padding: "8px 10px" }}>
                    {isEditing ? (
                      <div style={{ minWidth: 220 }}>
                        <p style={{ margin: "0 0 6px", fontSize: 11.5, color: "#8a9490" }}>{t("Marca las palabras a conectar:")}</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, maxHeight: 120, overflowY: "auto" }}>
                          {Object.values(data.nodes).filter((x) => x.kind !== "pattern" && x.id !== n.id && x.en).map((x) => (
                            <button
                              key={x.id}
                              onClick={() => toggleConn(x.id)}
                              style={{
                                fontSize: 11.5, padding: "3px 8px", borderRadius: 12, cursor: "pointer",
                                border: editList.includes(x.id) ? "1px solid #6FBF8B" : "1px solid #2f3b42",
                                background: editList.includes(x.id) ? "rgba(111,191,139,0.15)" : "transparent",
                                color: editList.includes(x.id) ? "#9fd9b8" : "#8a9490",
                              }}
                            >
                              {editList.includes(x.id) && <Check size={10} style={{ verticalAlign: "-1px" }} />} {x.en}
                            </button>
                          ))}
                        </div>
                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                          <button style={styles.smallAddBtn} onClick={applyEdit}><Check size={13} /> {t("Guardar")}</button>
                          <button style={styles.tab} onClick={() => { setEditingId(null); setEditList([]); }}>{t("Cancelar")}</button>
                        </div>
                        {savedFlash === n.id && <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "#6FBF8B" }}>✓ {t("Conexiones actualizadas — sync a la nube en curso")}</p>}
                      </div>
                    ) : (
                      <>
                        <span style={{ color: conns.length ? "#9fd9b8" : "#d98c8c", fontWeight: 700 }}>{conns.length}</span>
                        {conns.length > 0 && (
                          <span style={{ color: "#71807d", fontSize: 12, marginLeft: 6 }}>
                            {conns.slice(0, 3).join(", ")}{conns.length > 3 ? ` +${conns.length - 3}` : ""}
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  {/* SRS: fase + intervalo + próxima fecha */}
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                    <span style={{ color: PHASE_COLOR[phase], fontWeight: 600, fontSize: 12 }}>{PHASE_LABEL[phase]}</span>
                    <span style={{ color: "#71807d", fontSize: 11.5, marginLeft: 6 }}>{reps}× · {due}</span>
                  </td>
                  <td style={{ padding: "8px 10px", color: "#71807d", fontSize: 12, whiteSpace: "nowrap" }}>
                    {n.addedAt ? new Date(n.addedAt).toLocaleDateString() : "—"}
                  </td>
                  {/* Acciones */}
                  <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        style={styles.smallAddBtn}
                        onClick={() => onViewInMap(n.id)}
                        title={t("Ver en el Mapa")}
                      >
                        <Eye size={13} /> {t("Ver")}
                      </button>
                      <button
                        style={styles.smallAddBtn}
                        onClick={() => (isEditing ? applyEdit() : startEdit(n))}
                        title={t("Editar conexiones")}
                      >
                        <Link2 size={13} /> {t("Conectar")}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={styles.formHint}>
        <MousePointerClick size={12} style={{ verticalAlign: "-2px" }} />{" "}
        {t("Los cambios en la tabla actualizan el mapa al instante y se sincronizan con la nube.")}
        {cloudSyncing ? ` ${t("sincronizando…")}` : cloudError ? ` ⚠ ${cloudError}` : ""}
      </p>
    </div>
  );
}
