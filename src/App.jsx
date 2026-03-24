import { useState, useEffect, useCallback, useMemo } from "react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, LineChart, Line, CartesianGrid,
} from "recharts";

// ─── Supabase Config ───────────────────────────────────────────
const SB_URL = "https://vnxypnpepwxurhbdtswn.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZueHlwbnBlcHd4dXJoYmR0c3duIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQxMzk0NTQsImV4cCI6MjA4OTcxNTQ1NH0.NsybSa9Sb8lVl4D5i_gygUX79kejpyFAnne0CiKNXy4";
const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json" };

async function sb(table, params = "") {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?${params}`, { headers });
  if (!r.ok) throw new Error(`${table}: ${r.status}`);
  return r.json();
}

async function sbCount(table) {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?select=id&limit=10000`, { headers });
  if (!r.ok) return 0;
  const d = await r.json();
  return d.length;
}

// ─── Helpers ───────────────────────────────────────────────────
const ago = (d) => {
  if (!d) return "—";
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";
const fmtShortDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
const trunc = (s, n = 100) => s ? (s.length > n ? s.slice(0, n) + "…" : s) : "—";
const fmtNum = (n) => n != null ? Number(n).toLocaleString() : "—";
const fmtPct = (n) => n != null ? `${Number(n).toFixed(1)}%` : "—";
const fmtMoney = (n) => n != null ? `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—";

// ─── Color Palette ─────────────────────────────────────────────
const C = {
  bg: "#0F1419", bgSurface: "#141C27", card: "#1B2A4A", cardHover: "#1F3156",
  border: "#2A3F5F", borderLight: "#2A3F5F44",
  blue: "#2B7DE9", blueLight: "#4A9AF5", blueDim: "#2B7DE933",
  text: "#E8ECF1", textDim: "#8899AA", textMuted: "#5A6A7A",
  green: "#34D399", greenDim: "#34D39922",
  yellow: "#FBBF24", yellowDim: "#FBBF2422",
  red: "#F87171", redDim: "#F8717122",
  purple: "#A78BFA", purpleDim: "#A78BFA22",
  orange: "#FB923C", orangeDim: "#FB923C22",
  teal: "#2DD4BF", tealDim: "#2DD4BF22",
  pink: "#F472B6",
};

const TIER_COLORS = { t1: C.blue, t2: C.purple, t3: C.teal, watch: C.textDim };
const TIER_LABELS = { t1: "Tier 1 · Core", t2: "Tier 2 · Active", t3: "Tier 3 · Tactical", watch: "Watchlist" };
const STATUS_COLORS = { holding: C.green, adding: C.blue, trimming: C.yellow, watching_to_exit: C.red, watching: C.textDim, closed: C.textDim };
const CONFIDENCE_COLORS = { high: C.green, medium: C.yellow, low: C.red, shaken: C.red };
const CATEGORY_COLORS = { company: C.blue, earnings: C.green, sector: C.purple, filing: C.orange, transcript_analysis: C.teal, strategy: C.yellow };
const BG_ALIGNED_COLORS = { aligned: C.green, adjacent: C.yellow, off_framework: C.red };
const PIE_COLORS = [C.blue, C.purple, C.green, C.orange, C.teal, C.yellow, C.pink, C.red];

const POSITION_TYPE_COLORS = { portfolio: C.blue, watchlist: C.yellow, ibkr_only: C.orange };

// ─── Reusable Components ───────────────────────────────────────
const Pill = ({ label, color = C.blue, small, onClick }) => (
  <span onClick={onClick} style={{
    display: "inline-block", padding: small ? "1px 6px" : "2px 10px",
    borderRadius: 999, fontSize: small ? 10 : 11, fontWeight: 600,
    background: color + "22", color, letterSpacing: 0.3,
    textTransform: "uppercase", whiteSpace: "nowrap",
    cursor: onClick ? "pointer" : "default",
  }}>{label}</span>
);

const Card = ({ children, style, onClick, hoverable }) => (
  <div onClick={onClick} style={{
    background: C.card, borderRadius: 12, padding: 16,
    border: `1px solid ${C.border}`,
    cursor: onClick ? "pointer" : "default",
    transition: "all 0.15s ease",
    ...(hoverable ? {} : {}),
    ...style,
  }}
  onMouseEnter={hoverable ? (e) => {
    e.currentTarget.style.background = C.cardHover;
    e.currentTarget.style.borderColor = C.blue + "66";
    e.currentTarget.style.transform = "translateY(-1px)";
  } : undefined}
  onMouseLeave={hoverable ? (e) => {
    e.currentTarget.style.background = C.card;
    e.currentTarget.style.borderColor = C.border;
    e.currentTarget.style.transform = "translateY(0)";
  } : undefined}
  >{children}</div>
);

const SectionTitle = ({ icon, title, count, right }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
    <span style={{ fontSize: 18 }}>{icon}</span>
    <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0, letterSpacing: 0.3 }}>{title}</h2>
    {count != null && <span style={{
      fontSize: 11, color: C.textDim, background: C.border + "66",
      padding: "2px 8px", borderRadius: 99, fontFamily: "'JetBrains Mono', monospace",
    }}>{count}</span>}
    {right && <div style={{ marginLeft: "auto" }}>{right}</div>}
  </div>
);

const BackButton = ({ onClick }) => (
  <button onClick={onClick} style={{
    background: "transparent", border: `1px solid ${C.border}`,
    color: C.textDim, borderRadius: 8, padding: "6px 12px", fontSize: 12,
    fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
  }}>
    <span style={{ fontSize: 14 }}>←</span> Brain Map
  </button>
);

const ExpandableText = ({ text, limit = 100 }) => {
  const [open, setOpen] = useState(false);
  if (!text) return <span style={{ color: C.textDim }}>—</span>;
  if (text.length <= limit) return <span>{text}</span>;
  return (
    <span>
      {open ? text : trunc(text, limit)}{" "}
      <span onClick={(e) => { e.stopPropagation(); setOpen(!open); }} style={{
        color: C.blue, cursor: "pointer", fontSize: 11, fontWeight: 600,
      }}>{open ? "less" : "more"}</span>
    </span>
  );
};

const CollapsibleSection = ({ title, count, color = C.blue, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 12 }}>
      <div onClick={() => setOpen(!open)} style={{
        display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
        padding: "8px 0", borderBottom: `1px solid ${C.border}33`,
      }}>
        <span style={{ fontSize: 12, color, transform: open ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.15s" }}>▶</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>{title}</span>
        <span style={{
          fontSize: 10, color: C.textDim, background: color + "18",
          padding: "1px 6px", borderRadius: 99, fontFamily: "'JetBrains Mono', monospace",
        }}>{count}</span>
      </div>
      {open && <div style={{ paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>}
    </div>
  );
};

const EmptyState = ({ message }) => (
  <div style={{ color: C.textDim, fontSize: 13, textAlign: "center", padding: 32, opacity: 0.7 }}>{message}</div>
);

// ─── Search Bar ────────────────────────────────────────────────
const SearchBar = ({ value, onChange }) => (
  <div style={{ position: "relative" }}>
    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.5 }}>🔍</span>
    <input
      type="text" value={value} onChange={(e) => onChange(e.target.value)}
      placeholder="Search across all tables… (ticker, keyword, topic)"
      style={{
        width: "100%", padding: "12px 12px 12px 40px", borderRadius: 10,
        background: C.card, border: `1px solid ${C.border}`, color: C.text,
        fontSize: 14, outline: "none", fontFamily: "Inter, sans-serif",
        boxSizing: "border-box",
      }}
    />
    {value && (
      <span onClick={() => onChange("")} style={{
        position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
        fontSize: 14, cursor: "pointer", color: C.textDim,
      }}>✕</span>
    )}
  </div>
);

// ─── Search Results (cross-table) ──────────────────────────────
const SearchResults = ({ query, data, onNavigate }) => {
  const q = query.toLowerCase().trim();
  if (!q) return null;

  const results = [];
  const match = (obj) => JSON.stringify(obj).toLowerCase().includes(q);

  data.positions.filter(match).forEach((p) => results.push({
    table: "positions", icon: "📊", label: p.ticker, sub: p.entry_thesis || p.current_status || "",
    color: TIER_COLORS[p.tier] || C.blue, item: p,
  }));
  data.theses.filter(match).forEach((t) => results.push({
    table: "theses", icon: "🎯", label: t.thesis ? trunc(t.thesis, 60) : "Untitled",
    sub: (t.positions_linked || []).join(", ") || "", color: CONFIDENCE_COLORS[t.confidence] || C.textDim, item: t,
  }));
  data.researchNotes.filter(match).forEach((n) => results.push({
    table: "research_notes", icon: "📝", label: n.title || "Untitled",
    sub: n.ticker || (n.related_tickers || []).join(", ") || "", color: CATEGORY_COLORS[n.category] || C.blue, item: n,
  }));
  data.trades.filter(match).forEach((t) => results.push({
    table: "trade_journal", icon: "💹", label: `${t.ticker} ${t.action || t.direction || ""}`,
    sub: t.trade_date ? fmtDate(t.trade_date) : "", color: (t.action || t.direction || "").toLowerCase().includes("buy") ? C.green : C.red, item: t,
  }));
  data.brainEntries.filter(match).forEach((e) => results.push({
    table: "brain_entries", icon: "🧠", label: e.category || "entry",
    sub: trunc(e.raw_text || e.processed_text || e.content || "", 60), color: C.purple, item: e,
  }));
  data.positionEvents.filter(match).forEach((e) => results.push({
    table: "position_events", icon: "📅", label: `${e.ticker} · ${e.event_type || "event"}`,
    sub: e.reason || "", color: C.orange, item: e,
  }));

  const TABLE_LABELS = {
    positions: "Positions", theses: "Theses", research_notes: "Research",
    trade_journal: "Trades", brain_entries: "Brain Entries", position_events: "Events",
  };

  return (
    <Card>
      <SectionTitle icon="🔍" title="Search Results" count={results.length} />
      {results.length === 0 && <EmptyState message={`No results for "${query}"`} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {results.slice(0, 30).map((r, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
            background: C.bg + "88", borderRadius: 8, border: `1px solid ${C.border}44`,
            cursor: "pointer",
          }} onClick={() => onNavigate(r.table === "brain_entries" ? "brain" : r.table === "position_events" ? "events" : r.table === "research_notes" ? "research" : r.table === "trade_journal" ? "trades" : r.table)}>
            <span style={{ fontSize: 14 }}>{r.icon}</span>
            <Pill label={TABLE_LABELS[r.table] || r.table} color={r.color} small />
            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.label}</span>
            <span style={{ fontSize: 11, color: C.textDim, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sub}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════
// LEVEL 1: BRAIN MAP (Landing Page)
// ═══════════════════════════════════════════════════════════════

const BrainMapCard = ({ icon, title, description, count, previews, color, onClick }) => (
  <Card hoverable onClick={onClick} style={{ cursor: "pointer" }}>
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 10 }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10, background: color + "18",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 22, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{title}</span>
          <span style={{
            fontSize: 18, fontWeight: 800, color, fontFamily: "'JetBrains Mono', monospace",
          }}>{count}</span>
        </div>
        <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.4, marginTop: 2 }}>{description}</div>
      </div>
      <span style={{ fontSize: 16, color: C.textDim, flexShrink: 0, marginTop: 4 }}>→</span>
    </div>
    {previews && previews.length > 0 && (
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {previews.map((p, i) => (
          <span key={i} style={{
            fontSize: 10, fontWeight: 600, color: C.textDim, background: C.border + "44",
            padding: "2px 8px", borderRadius: 99, fontFamily: "'JetBrains Mono', monospace",
          }}>{p}</span>
        ))}
      </div>
    )}
  </Card>
);

const BrainMap = ({ data, counts, onNavigate }) => {
  const positionPreviews = data.positions.slice(0, 4).map((p) => p.ticker).filter(Boolean);
  const thesisPreviews = data.theses.slice(0, 3).map((t) => trunc(t.thesis || "", 20));
  const researchPreviews = data.researchNotes.slice(0, 3).map((n) => n.title || n.ticker || "note").map((s) => trunc(s, 20));
  const tradePreviews = data.trades.slice(0, 3).map((t) => `${t.ticker} ${t.action || t.direction || ""}`.trim());
  const brainPreviews = useMemo(() => {
    const cats = {};
    data.brainEntries.forEach((e) => { const c = e.category || "other"; cats[c] = (cats[c] || 0) + 1; });
    return Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}: ${v}`);
  }, [data.brainEntries]);
  const sourcePreviews = data.sources ? data.sources.slice(0, 3).map((s) => s.name || s.source_name || "source") : [];
  const eventPreviews = data.positionEvents.slice(0, 3).map((e) => `${e.ticker} ${e.event_type || ""}`.trim());

  return (
    <div>
      {/* Top Row: Core */}
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
        Core Holdings
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10, marginBottom: 20 }}>
        <BrainMapCard
          icon="📊" title="Positions" description="Portfolio holdings, watchlist, and tracked tickers with tiers and PW-IRR targets"
          count={counts.positions} color={C.blue} previews={positionPreviews}
          onClick={() => onNavigate("positions")}
        />
        <BrainMapCard
          icon="🎯" title="Theses" description="Investment theses with confidence levels, evidence, and linked positions"
          count={counts.theses} color={C.green} previews={thesisPreviews}
          onClick={() => onNavigate("theses")}
        />
      </div>

      {/* Second Row: Research & Trades */}
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
        Research & Activity
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10, marginBottom: 20 }}>
        <BrainMapCard
          icon="📝" title="Research Notes" description="Company deep-dives, earnings analysis, sector research, and strategy notes"
          count={counts.research_notes} color={C.purple} previews={researchPreviews}
          onClick={() => onNavigate("research")}
        />
        <BrainMapCard
          icon="💹" title="Trade Journal" description="Trade log with BG2 alignment tracking, reconciliation status, and P&L"
          count={counts.trade_journal} color={C.orange} previews={tradePreviews}
          onClick={() => onNavigate("trades")}
        />
      </div>

      {/* Third Row: Deep Storage & History */}
      <div style={{ fontSize: 11, fontWeight: 700, color: C.textDim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
        Deep Storage & History
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10, marginBottom: 20 }}>
        <BrainMapCard
          icon="🧠" title="Brain Entries" description="Raw inputs — transcripts, IC memos, methodology docs, and investment observations"
          count={counts.brain_entries} color={C.teal} previews={brainPreviews}
          onClick={() => onNavigate("brain")}
        />
        <BrainMapCard
          icon="📅" title="Position Events" description="Timeline of all position changes — tier moves, status updates, price adjustments"
          count={counts.position_events} color={C.yellow} previews={eventPreviews}
          onClick={() => onNavigate("events")}
        />
      </div>

      {/* Fourth Row: Sources & IBKR */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 10, marginBottom: 20 }}>
        <BrainMapCard
          icon="📚" title="Sources" description="Tracked sources — podcasts, analysts, research providers, and data feeds"
          count={counts.sources} color={C.pink} previews={sourcePreviews}
          onClick={() => onNavigate("sources")}
        />
        <BrainMapCard
          icon="🏦" title="IBKR Snapshots" description="Daily brokerage snapshots — positions, cost basis, unrealized P&L from Interactive Brokers"
          count={counts.ibkr_snapshots} color={C.green} previews={[]}
          onClick={() => onNavigate("ibkr")}
        />
        <BrainMapCard
          icon="🖥️" title="Device Activity" description="Automated task runs and agent activity across devices"
          count={counts.task_activity} color={C.textDim} previews={[]}
          onClick={() => onNavigate("devices")}
        />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// LEVEL 2: TABLE EXPLORERS
// ═══════════════════════════════════════════════════════════════

// ─── Positions Explorer ────────────────────────────────────────
const PositionDetail = ({ p }) => {
  const [open, setOpen] = useState(false);
  const tierColor = TIER_COLORS[p.tier] || C.textDim;
  const statusColor = STATUS_COLORS[p.current_status] || C.textDim;
  const typeColor = POSITION_TYPE_COLORS[p.position_type] || C.textDim;

  return (
    <div style={{
      background: C.bg + "88", borderRadius: 10, padding: "12px 14px",
      border: `1px solid ${C.border}44`, cursor: "pointer",
      borderLeft: `3px solid ${tierColor}`,
    }} onClick={() => setOpen(!open)}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{
          fontSize: 18, fontWeight: 800, color: C.text, minWidth: 56,
          fontFamily: "'JetBrains Mono', monospace",
        }}>{p.ticker}</span>
        <Pill label={p.tier || "—"} color={tierColor} small />
        <Pill label={p.current_status?.replace(/_/g, " ") || "—"} color={statusColor} small />
        {p.position_type && <Pill label={p.position_type.replace(/_/g, " ")} color={typeColor} small />}
        {p.qqq_overlap && <Pill label="QQQ" color={C.orange} small />}
        <div style={{ flex: 1 }} />
        {p.pw_irr != null && (
          <span style={{
            fontSize: 14, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
            color: p.pw_irr >= 12 ? C.green : p.pw_irr >= 0 ? C.yellow : C.red,
          }}>{fmtPct(p.pw_irr)} IRR</span>
        )}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: C.text }}>
            {p.entry_price ? `$${p.entry_price}` : "—"} → {p.target_price ? `$${p.target_price}` : "—"}
          </div>
        </div>
      </div>

      {/* Expanded detail */}
      {open && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}33` }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, fontSize: 12 }}>
            <div><span style={{ color: C.textDim }}>Entry Price:</span> <span style={{ color: C.text, fontFamily: "'JetBrains Mono', monospace" }}>{p.entry_price ? `$${p.entry_price}` : "—"}</span></div>
            <div><span style={{ color: C.textDim }}>Target Price:</span> <span style={{ color: C.text, fontFamily: "'JetBrains Mono', monospace" }}>{p.target_price ? `$${p.target_price}` : "—"}</span></div>
            <div><span style={{ color: C.textDim }}>PW-IRR:</span> <span style={{ color: C.text, fontFamily: "'JetBrains Mono', monospace" }}>{p.pw_irr != null ? fmtPct(p.pw_irr) : "—"}</span></div>
            <div><span style={{ color: C.textDim }}>PW-IV:</span> <span style={{ color: C.text, fontFamily: "'JetBrains Mono', monospace" }}>{p.pw_iv != null ? `$${p.pw_iv}` : "—"}</span></div>
            <div><span style={{ color: C.textDim }}>Tier:</span> <span style={{ color: tierColor, fontWeight: 600 }}>{(p.tier || "—").toUpperCase()}</span></div>
            <div><span style={{ color: C.textDim }}>Type:</span> <span style={{ color: C.text }}>{p.position_type?.replace(/_/g, " ") || "—"}</span></div>
            <div><span style={{ color: C.textDim }}>QQQ Overlap:</span> <span style={{ color: C.text }}>{p.qqq_overlap ? "Yes" : "No"}</span></div>
            <div><span style={{ color: C.textDim }}>Last Reviewed:</span> <span style={{ color: C.text }}>{fmtDate(p.last_reviewed)}</span></div>
          </div>
          {p.entry_thesis && (
            <div style={{ marginTop: 8, fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 600, color: C.text }}>Thesis: </span>{p.entry_thesis}
            </div>
          )}
          {p.notion_page_url && (
            <a href={p.notion_page_url} target="_blank" rel="noopener noreferrer" style={{
              display: "inline-block", marginTop: 8, fontSize: 11, color: C.blue, textDecoration: "none", fontWeight: 600,
            }}>Open in Notion →</a>
          )}
        </div>
      )}
    </div>
  );
};

const PositionsExplorer = ({ data, onBack }) => {
  const byTier = useMemo(() => {
    const groups = { t1: [], t2: [], t3: [], watch: [], other: [] };
    data.forEach((p) => {
      const tier = p.tier || (p.position_type === "watchlist" ? "watch" : "other");
      (groups[tier] || groups.other).push(p);
    });
    // Sort by PW-IRR descending within each tier
    Object.values(groups).forEach((g) => g.sort((a, b) => (b.pw_irr || -999) - (a.pw_irr || -999)));
    return groups;
  }, [data]);

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <BackButton onClick={onBack} />
        <SectionTitle icon="📊" title="Positions" count={data.length} />
      </div>
      {["t1", "t2", "t3", "watch"].map((tier) => {
        if (!byTier[tier] || byTier[tier].length === 0) return null;
        return (
          <CollapsibleSection
            key={tier}
            title={TIER_LABELS[tier] || tier.toUpperCase()}
            count={byTier[tier].length}
            color={TIER_COLORS[tier]}
            defaultOpen={tier !== "watch"}
          >
            {byTier[tier].map((p, i) => <PositionDetail key={i} p={p} />)}
          </CollapsibleSection>
        );
      })}
      {byTier.other.length > 0 && (
        <CollapsibleSection title="Untiered" count={byTier.other.length} color={C.textDim}>
          {byTier.other.map((p, i) => <PositionDetail key={i} p={p} />)}
        </CollapsibleSection>
      )}
      {data.length === 0 && <EmptyState message="No positions tracked" />}
    </Card>
  );
};

// ─── Theses Explorer ───────────────────────────────────────────
const ThesisDetail = ({ t }) => {
  const [open, setOpen] = useState(false);
  const cc = CONFIDENCE_COLORS[t.confidence] || C.textDim;
  return (
    <div style={{
      background: C.bg + "88", borderRadius: 10, padding: 14,
      border: `1px solid ${C.border}44`, borderLeft: `3px solid ${cc}`,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 6, lineHeight: 1.4 }}>
        {t.thesis || "Untitled thesis"}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
        <Pill label={t.confidence || "?"} color={cc} small />
        {t.status && <Pill label={t.status} color={t.status === "active" ? C.green : t.status === "invalidated" ? C.red : C.yellow} small />}
        {t.time_horizon && <Pill label={t.time_horizon} color={C.textDim} small />}
      </div>
      {t.positions_linked && t.positions_linked.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
          {(Array.isArray(t.positions_linked) ? t.positions_linked : [t.positions_linked]).map((tk, i) => (
            <span key={i} style={{
              fontSize: 11, fontWeight: 700, color: C.blue, background: C.blue + "18",
              padding: "1px 6px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace",
            }}>{tk}</span>
          ))}
        </div>
      )}
      {(t.supporting_evidence || t.contradicting_evidence) && (
        <div>
          <span onClick={() => setOpen(!open)} style={{
            fontSize: 11, color: C.blue, cursor: "pointer", fontWeight: 600,
          }}>{open ? "▾ Hide evidence" : "▸ Show evidence"}</span>
          {open && (
            <div style={{ marginTop: 6, fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>
              {t.supporting_evidence && <div style={{ marginBottom: 4 }}>
                <span style={{ color: C.green, fontWeight: 600 }}>Supporting: </span>{t.supporting_evidence}
              </div>}
              {t.contradicting_evidence && <div>
                <span style={{ color: C.red, fontWeight: 600 }}>Contradicting: </span>{t.contradicting_evidence}
              </div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ThesesExplorer = ({ data, onBack }) => (
  <Card>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <BackButton onClick={onBack} />
      <SectionTitle icon="🎯" title="Theses" count={data.length} />
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((t, i) => <ThesisDetail key={i} t={t} />)}
      {data.length === 0 && <EmptyState message="No theses tracked" />}
    </div>
  </Card>
);

// ─── Research Notes Explorer ───────────────────────────────────
const ResearchExplorer = ({ data, onBack }) => {
  const byCategory = useMemo(() => {
    const groups = {};
    data.forEach((n) => {
      const c = n.category || "other";
      if (!groups[c]) groups[c] = [];
      groups[c].push(n);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [data]);

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <BackButton onClick={onBack} />
        <SectionTitle icon="📝" title="Research Notes" count={data.length} />
      </div>
      {byCategory.map(([cat, notes]) => (
        <CollapsibleSection key={cat} title={cat.replace(/_/g, " ")} count={notes.length} color={CATEGORY_COLORS[cat] || C.textDim}>
          {notes.map((n, i) => (
            <div key={i} style={{
              padding: "10px 12px", background: C.bg + "88", borderRadius: 8, border: `1px solid ${C.border}44`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{n.title || "Untitled"}</span>
                {(n.ticker || (n.related_tickers && n.related_tickers.length > 0)) && (
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: C.blue, background: C.blue + "18",
                    padding: "1px 6px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace",
                  }}>{n.ticker || n.related_tickers[0]}</span>
                )}
                {n.source && <Pill label={n.source} color={C.textDim} small />}
                {n.analysis_date && <span style={{ fontSize: 10, color: C.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{fmtShortDate(n.analysis_date)}</span>}
              </div>
              <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.4 }}>
                <ExpandableText text={n.key_takeaway} limit={200} />
              </div>
              {n.notion_page_url && (
                <a href={n.notion_page_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{
                  display: "inline-block", marginTop: 4, fontSize: 10, color: C.blue, textDecoration: "none", fontWeight: 600,
                }}>Open in Notion →</a>
              )}
            </div>
          ))}
        </CollapsibleSection>
      ))}
      {data.length === 0 && <EmptyState message="No research notes" />}
    </Card>
  );
};

// ─── Trade Journal Explorer ────────────────────────────────────
const TradeExplorer = ({ data, onBack }) => {
  const grouped = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today - 7 * 86400000);
    const groups = { today: [], thisWeek: [], older: [] };
    data.forEach((t) => {
      const d = new Date(t.trade_date || t.created_at || 0);
      if (d >= today) groups.today.push(t);
      else if (d >= weekAgo) groups.thisWeek.push(t);
      else groups.older.push(t);
    });
    return groups;
  }, [data]);

  const TradeRow = ({ t }) => {
    const [open, setOpen] = useState(false);
    const isBuy = (t.action || t.direction || "").toLowerCase().includes("buy");
    const bgColor = BG_ALIGNED_COLORS[t.bg_aligned] || C.textDim;
    return (
      <div style={{
        background: C.bg + "88", borderRadius: 8, border: `1px solid ${C.border}44`, cursor: "pointer",
      }} onClick={() => setOpen(!open)}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px" }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>{isBuy ? "🟢" : "🔴"}</span>
          <span style={{
            fontSize: 14, fontWeight: 800, color: C.text, minWidth: 48,
            fontFamily: "'JetBrains Mono', monospace",
          }}>{t.ticker}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: isBuy ? C.green : C.red, textTransform: "uppercase" }}>
            {t.action || t.direction || "—"}
          </span>
          <div style={{ flex: 1, fontSize: 11, color: C.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
            {t.quantity && <span>{t.quantity} </span>}
            {t.price && <span>@ ${t.price}</span>}
          </div>
          {t.bg_aligned && <Pill label={t.bg_aligned.replace(/_/g, " ")} color={bgColor} small />}
          {t.reconciled && <Pill label="reconciled" color={C.green} small />}
          <span style={{ fontSize: 10, color: C.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
            {t.trade_date ? fmtDate(t.trade_date) : ago(t.created_at)}
          </span>
        </div>
        {open && (
          <div style={{ padding: "0 12px 10px 48px", fontSize: 12, color: C.textDim, lineHeight: 1.5 }}>
            {t.thesis_reference && <div><span style={{ fontWeight: 600, color: C.text }}>Thesis: </span>{t.thesis_reference}</div>}
            {t.rationale && <div><span style={{ fontWeight: 600, color: C.text }}>Rationale: </span>{t.rationale}</div>}
            {t.bg_aligned && <div><span style={{ fontWeight: 600, color: C.text }}>BG2 Alignment: </span><span style={{ color: bgColor }}>{t.bg_aligned}</span></div>}
            {t.reconciled_at && <div><span style={{ fontWeight: 600, color: C.text }}>Reconciled: </span>{fmtDate(t.reconciled_at)}</div>}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <BackButton onClick={onBack} />
        <SectionTitle icon="💹" title="Trade Journal" count={data.length} />
      </div>
      {grouped.today.length > 0 && (
        <CollapsibleSection title="Today" count={grouped.today.length} color={C.green}>
          {grouped.today.map((t, i) => <TradeRow key={i} t={t} />)}
        </CollapsibleSection>
      )}
      {grouped.thisWeek.length > 0 && (
        <CollapsibleSection title="This Week" count={grouped.thisWeek.length} color={C.blue}>
          {grouped.thisWeek.map((t, i) => <TradeRow key={i} t={t} />)}
        </CollapsibleSection>
      )}
      {grouped.older.length > 0 && (
        <CollapsibleSection title="Older" count={grouped.older.length} color={C.textDim} defaultOpen={grouped.today.length === 0 && grouped.thisWeek.length === 0}>
          {grouped.older.map((t, i) => <TradeRow key={i} t={t} />)}
        </CollapsibleSection>
      )}
      {data.length === 0 && <EmptyState message="No trades logged" />}
    </Card>
  );
};

// ─── Brain Entries Explorer ────────────────────────────────────
const BrainEntriesExplorer = ({ data, onBack }) => {
  const byCategory = useMemo(() => {
    const groups = {};
    data.forEach((e) => {
      const c = e.category || "uncategorized";
      if (!groups[c]) groups[c] = [];
      groups[c].push(e);
    });
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  }, [data]);

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <BackButton onClick={onBack} />
        <SectionTitle icon="🧠" title="Brain Entries" count={data.length} />
      </div>
      <div style={{ fontSize: 12, color: C.textDim, marginBottom: 16 }}>
        Deep storage — showing category structure and sample previews. {byCategory.length} categories total.
      </div>
      {byCategory.map(([cat, entries]) => (
        <CollapsibleSection key={cat} title={cat.replace(/_/g, " ")} count={entries.length} color={C.teal} defaultOpen={false}>
          {entries.slice(0, 8).map((e, i) => (
            <div key={i} style={{
              padding: "8px 10px", background: C.bg + "88", borderRadius: 8,
              border: `1px solid ${C.border}44`, fontSize: 12, color: C.textDim, lineHeight: 1.4,
            }}>
              <ExpandableText text={e.raw_text || e.processed_text || e.content || "—"} limit={150} />
              <div style={{ marginTop: 4, fontSize: 10, color: C.textMuted }}>{ago(e.created_at)}</div>
            </div>
          ))}
          {entries.length > 8 && (
            <div style={{ fontSize: 11, color: C.textDim, padding: 8, textAlign: "center" }}>
              + {entries.length - 8} more entries
            </div>
          )}
        </CollapsibleSection>
      ))}
      {data.length === 0 && <EmptyState message="No brain entries" />}
    </Card>
  );
};

// ─── Position Events Explorer ──────────────────────────────────
const PositionEventsExplorer = ({ data, onBack }) => (
  <Card>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <BackButton onClick={onBack} />
      <SectionTitle icon="📅" title="Position Events" count={data.length} />
    </div>
    <div style={{ position: "relative", paddingLeft: 20 }}>
      {/* Timeline line */}
      <div style={{
        position: "absolute", left: 8, top: 0, bottom: 0, width: 2,
        background: `linear-gradient(to bottom, ${C.blue}, ${C.border})`,
      }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.slice(0, 50).map((e, i) => (
          <div key={i} style={{
            position: "relative", padding: "10px 12px", background: C.bg + "88",
            borderRadius: 8, border: `1px solid ${C.border}44`,
          }}>
            {/* Timeline dot */}
            <div style={{
              position: "absolute", left: -16, top: 14, width: 10, height: 10,
              borderRadius: "50%", background: C.card, border: `2px solid ${C.blue}`,
            }} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <span style={{
                fontSize: 14, fontWeight: 800, color: C.text,
                fontFamily: "'JetBrains Mono', monospace",
              }}>{e.ticker}</span>
              <Pill label={e.event_type?.replace(/_/g, " ") || "event"} color={C.orange} small />
              <span style={{ fontSize: 10, color: C.textDim, marginLeft: "auto", fontFamily: "'JetBrains Mono', monospace" }}>
                {fmtDate(e.created_at)}
              </span>
            </div>
            {(e.old_value || e.new_value) && (
              <div style={{ fontSize: 12, color: C.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
                <span style={{ color: C.red }}>{e.old_value || "—"}</span>
                <span style={{ color: C.textMuted }}> → </span>
                <span style={{ color: C.green }}>{e.new_value || "—"}</span>
              </div>
            )}
            {e.reason && (
              <div style={{ fontSize: 12, color: C.textDim, marginTop: 4, lineHeight: 1.4 }}>{e.reason}</div>
            )}
            {e.source && (
              <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>via {e.source}</div>
            )}
          </div>
        ))}
      </div>
    </div>
    {data.length === 0 && <EmptyState message="No position events recorded" />}
  </Card>
);

// ─── Sources Explorer ──────────────────────────────────────────
const SourcesExplorer = ({ data, onBack }) => (
  <Card>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <BackButton onClick={onBack} />
      <SectionTitle icon="📚" title="Sources" count={data.length} />
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map((s, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
          background: C.bg + "88", borderRadius: 8, border: `1px solid ${C.border}44`,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s.name || s.source_name || "—"}</span>
          {s.type && <Pill label={s.type} color={C.textDim} small />}
          {s.reliability && <Pill label={s.reliability} color={s.reliability === "high" ? C.green : C.yellow} small />}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: C.textDim }}>{ago(s.created_at)}</span>
        </div>
      ))}
      {data.length === 0 && <EmptyState message="No sources tracked" />}
    </div>
  </Card>
);

// ─── IBKR Snapshots Explorer ───────────────────────────────────
const IBKRExplorer = ({ data, onBack }) => {
  const byDate = useMemo(() => {
    const groups = {};
    data.forEach((s) => {
      const d = s.snapshot_date || fmtDate(s.created_at);
      if (!groups[d]) groups[d] = [];
      groups[d].push(s);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [data]);

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <BackButton onClick={onBack} />
        <SectionTitle icon="🏦" title="IBKR Snapshots" count={data.length} />
      </div>
      {byDate.map(([date, snaps]) => (
        <CollapsibleSection key={date} title={date} count={snaps.length} color={C.green} defaultOpen={byDate.indexOf([date, snaps]) === 0}>
          {snaps.map((s, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
              background: C.bg + "88", borderRadius: 8, border: `1px solid ${C.border}44`,
            }}>
              <span style={{
                fontSize: 14, fontWeight: 800, color: C.text, minWidth: 48,
                fontFamily: "'JetBrains Mono', monospace",
              }}>{s.ticker}</span>
              <div style={{ flex: 1, display: "flex", gap: 12, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                <span style={{ color: C.textDim }}>Qty: <span style={{ color: C.text }}>{fmtNum(s.quantity)}</span></span>
                <span style={{ color: C.textDim }}>Cost: <span style={{ color: C.text }}>{fmtMoney(s.cost_basis)}</span></span>
                <span style={{ color: C.textDim }}>Mkt: <span style={{ color: C.text }}>{fmtMoney(s.market_value)}</span></span>
              </div>
              {s.unrealized_pnl != null && (
                <span style={{
                  fontSize: 12, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                  color: s.unrealized_pnl >= 0 ? C.green : C.red,
                }}>{s.unrealized_pnl >= 0 ? "+" : ""}{fmtMoney(s.unrealized_pnl)}</span>
              )}
            </div>
          ))}
        </CollapsibleSection>
      ))}
      {data.length === 0 && <EmptyState message="No IBKR snapshots" />}
    </Card>
  );
};

// ─── Device Activity Explorer ──────────────────────────────────
const DeviceExplorer = ({ data, onBack }) => (
  <Card>
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
      <BackButton onClick={onBack} />
      <SectionTitle icon="🖥️" title="Device Activity" count={data.length} />
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map((d, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
          background: C.bg + "88", borderRadius: 8, border: `1px solid ${C.border}44`,
        }}>
          <span style={{ fontSize: 18 }}>{(d.device || "").toLowerCase().includes("mini") ? "🖥️" : "💻"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{d.task_name || "—"}</span>
              {d.status && <span style={{
                fontSize: 10, color: d.status === "completed" ? C.green : d.status === "failed" ? C.red : C.yellow,
              }}>{d.status === "completed" ? "✓" : d.status === "failed" ? "✗" : "⟳"}</span>}
            </div>
            <div style={{ fontSize: 11, color: C.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {d.summary || d.result_summary || "—"}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: C.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{ago(d.created_at)}</div>
            <div style={{ fontSize: 9, color: C.textDim }}>{d.device}</div>
          </div>
        </div>
      ))}
      {data.length === 0 && <EmptyState message="No device activity" />}
    </div>
  </Card>
);

// ═══════════════════════════════════════════════════════════════
// BRAIN STATS (Redesigned)
// ═══════════════════════════════════════════════════════════════

const BrainStats = ({ data, onBack }) => {
  // Positions by Tier (donut)
  const tierData = useMemo(() => {
    const map = {};
    data.positions.forEach((p) => {
      const t = p.tier || "untiered";
      map[t] = (map[t] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name: name.toUpperCase(), value }));
  }, [data.positions]);

  // PW-IRR Distribution (histogram)
  const irrData = useMemo(() => {
    const buckets = { "< 0%": 0, "0-8%": 0, "8-12%": 0, "12-20%": 0, "20%+": 0 };
    data.positions.forEach((p) => {
      if (p.pw_irr == null) return;
      const v = Number(p.pw_irr);
      if (v < 0) buckets["< 0%"]++;
      else if (v < 8) buckets["0-8%"]++;
      else if (v < 12) buckets["8-12%"]++;
      else if (v < 20) buckets["12-20%"]++;
      else buckets["20%+"]++;
    });
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [data.positions]);

  // Research by week (bar chart)
  const researchByWeek = useMemo(() => {
    const weeks = {};
    data.researchNotes.forEach((n) => {
      const d = new Date(n.analysis_date || n.created_at || 0);
      const weekStart = new Date(d);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const key = weekStart.toISOString().slice(0, 10);
      weeks[key] = (weeks[key] || 0) + 1;
    });
    return Object.entries(weeks).sort((a, b) => a[0].localeCompare(b[0])).slice(-12).map(([week, count]) => ({
      week: fmtShortDate(week), count,
    }));
  }, [data.researchNotes]);

  // Trades by day
  const tradesByDay = useMemo(() => {
    const days = {};
    data.trades.forEach((t) => {
      const d = (t.trade_date || t.created_at || "").slice(0, 10);
      if (d) days[d] = (days[d] || 0) + 1;
    });
    return Object.entries(days).sort((a, b) => a[0].localeCompare(b[0])).slice(-20).map(([day, count]) => ({
      day: fmtShortDate(day), count,
    }));
  }, [data.trades]);

  // BG2 alignment breakdown
  const bgAlignData = useMemo(() => {
    const map = {};
    data.trades.forEach((t) => {
      const a = t.bg_aligned || "unknown";
      map[a] = (map[a] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }));
  }, [data.trades]);

  const chartLabel = ({ name, percent, cx, cy, midAngle, outerRadius }) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = outerRadius + 16;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill={C.textDim} textAnchor={x > cx ? "start" : "end"} dominantBaseline="central" style={{ fontSize: 9 }}>
        {`${name} ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <BackButton onClick={onBack} />
        <SectionTitle icon="📈" title="Brain Stats" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {/* Positions by Tier */}
        {tierData.length > 0 && (
          <div style={{ background: C.bg + "88", borderRadius: 10, padding: 14, border: `1px solid ${C.border}44` }}>
            <div style={{ fontSize: 11, color: C.textDim, textAlign: "center", marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>
              Positions by Tier
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={tierData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value" nameKey="name" label={chartLabel} labelLine={false} isAnimationActive={false}>
                  {tierData.map((d, i) => <Cell key={i} fill={TIER_COLORS[d.name.toLowerCase()] || PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* PW-IRR Distribution */}
        {irrData.some((d) => d.value > 0) && (
          <div style={{ background: C.bg + "88", borderRadius: 10, padding: 14, border: `1px solid ${C.border}44` }}>
            <div style={{ fontSize: 11, color: C.textDim, textAlign: "center", marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>
              PW-IRR Distribution
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={irrData} margin={{ left: 0, right: 0, top: 8, bottom: 4 }}>
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: C.textDim }} />
                <YAxis hide />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {irrData.map((d, i) => {
                    const colors = [C.red, C.yellow, C.orange, C.green, C.blue];
                    return <Cell key={i} fill={colors[i] || C.blue} />;
                  })}
                </Bar>
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text }} cursor={{ fill: C.border + "33" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Research Activity */}
        {researchByWeek.length > 0 && (
          <div style={{ background: C.bg + "88", borderRadius: 10, padding: 14, border: `1px solid ${C.border}44` }}>
            <div style={{ fontSize: 11, color: C.textDim, textAlign: "center", marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>
              Research Activity (by week)
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={researchByWeek} margin={{ left: 0, right: 0, top: 8, bottom: 4 }}>
                <XAxis dataKey="week" tick={{ fontSize: 8, fill: C.textDim }} />
                <YAxis hide />
                <Bar dataKey="count" fill={C.purple} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text }} cursor={{ fill: C.border + "33" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Trade Activity */}
        {tradesByDay.length > 0 && (
          <div style={{ background: C.bg + "88", borderRadius: 10, padding: 14, border: `1px solid ${C.border}44` }}>
            <div style={{ fontSize: 11, color: C.textDim, textAlign: "center", marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>
              Trade Activity (by day)
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={tradesByDay} margin={{ left: 0, right: 0, top: 8, bottom: 4 }}>
                <XAxis dataKey="day" tick={{ fontSize: 8, fill: C.textDim }} />
                <YAxis hide />
                <Bar dataKey="count" fill={C.orange} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text }} cursor={{ fill: C.border + "33" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* BG2 Alignment */}
        {bgAlignData.length > 0 && (
          <div style={{ background: C.bg + "88", borderRadius: 10, padding: 14, border: `1px solid ${C.border}44` }}>
            <div style={{ fontSize: 11, color: C.textDim, textAlign: "center", marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>
              BG2 Alignment
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={bgAlignData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value" nameKey="name" label={chartLabel} labelLine={false} isAnimationActive={false}>
                  {bgAlignData.map((d, i) => <Cell key={i} fill={BG_ALIGNED_COLORS[d.name.replace(/ /g, "_")] || PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════
// BRAIN PULSE (top status bar)
// ═══════════════════════════════════════════════════════════════

const BrainPulse = ({ counts, lastActivity, loading }) => {
  const stats = [
    { label: "Positions", value: counts.positions, icon: "📊" },
    { label: "Theses", value: counts.theses, icon: "🎯" },
    { label: "Research", value: counts.research_notes, icon: "📝" },
    { label: "Trades", value: counts.trade_journal, icon: "💹" },
    { label: "Brain", value: counts.brain_entries, icon: "🧠" },
    { label: "Events", value: counts.position_events, icon: "📅" },
  ];
  return (
    <Card style={{ background: `linear-gradient(135deg, ${C.card} 0%, #162040 100%)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <div style={{
          width: 10, height: 10, borderRadius: "50%",
          background: loading ? C.yellow : C.green,
          boxShadow: loading ? `0 0 8px ${C.yellow}` : `0 0 8px ${C.green}`,
          animation: loading ? undefined : "pulse 2s infinite",
        }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>
          {loading ? "Syncing brain…" : "Brain is alive"}
        </span>
        <span style={{ fontSize: 11, color: C.textDim, marginLeft: "auto", fontFamily: "'JetBrains Mono', monospace" }}>
          {lastActivity ? ago(lastActivity) : "—"}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13 }}>{s.icon}</div>
            <div style={{
              fontSize: 18, fontWeight: 700, color: C.text,
              fontFamily: "'JetBrains Mono', monospace",
            }}>{loading ? "—" : s.value}</div>
            <div style={{ fontSize: 9, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </Card>
  );
};

// ═══════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════

export default function BrainDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState("map"); // "map" | table name | "stats"

  const [data, setData] = useState({
    brainEntries: [], positions: [], researchNotes: [],
    theses: [], trades: [], taskActivity: [],
    positionEvents: [], ibkrSnapshots: [], sources: [],
    counts: {
      brain_entries: 0, positions: 0, research_notes: 0, theses: 0,
      trade_journal: 0, position_events: 0, ibkr_snapshots: 0,
      task_activity: 0, sources: 0,
    },
    lastActivity: null,
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        brainEntries, positions, researchNotes, theses, trades, taskActivity,
        positionEvents, ibkrSnapshots, sources,
        cBrain, cPos, cRes, cThes, cTrade, cEvents, cIBKR, cTask, cSources,
      ] = await Promise.all([
        sb("brain_entries", "select=*&order=created_at.desc&limit=200").catch(() => []),
        sb("positions", "select=*&order=ticker.asc").catch(() => []),
        sb("research_notes", "select=*&order=created_at.desc&limit=100").catch(() => []),
        sb("theses", "select=*&order=created_at.desc").catch(() => []),
        sb("trade_journal", "select=*&order=trade_date.desc.nullslast,created_at.desc&limit=100").catch(() => []),
        sb("task_activity", "select=*&order=created_at.desc&limit=30").catch(() => []),
        sb("position_events", "select=*&order=created_at.desc&limit=100").catch(() => []),
        sb("ibkr_snapshots", "select=*&order=snapshot_date.desc,ticker.asc&limit=200").catch(() => []),
        sb("sources", "select=*&order=created_at.desc").catch(() => []),
        sbCount("brain_entries"),
        sbCount("positions"),
        sbCount("research_notes"),
        sbCount("theses"),
        sbCount("trade_journal"),
        sbCount("position_events").catch(() => 0),
        sbCount("ibkr_snapshots").catch(() => 0),
        sbCount("task_activity"),
        sbCount("sources").catch(() => 0),
      ]);

      const allDates = [
        ...brainEntries.map((e) => e.created_at),
        ...researchNotes.map((e) => e.created_at),
        ...trades.map((e) => e.created_at),
        ...positionEvents.map((e) => e.created_at),
      ].filter(Boolean).sort().reverse();

      setData({
        brainEntries, positions, researchNotes, theses, trades, taskActivity,
        positionEvents, ibkrSnapshots, sources,
        counts: {
          brain_entries: cBrain, positions: cPos, research_notes: cRes, theses: cThes,
          trade_journal: cTrade, position_events: cEvents, ibkr_snapshots: cIBKR,
          task_activity: cTask, sources: cSources,
        },
        lastActivity: allDates[0] || null,
      });
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Navigation
  const navigate = (v) => { setView(v); setSearch(""); window.scrollTo(0, 0); };
  const goHome = () => navigate("map");

  // Quick nav tabs for table views
  const tableNav = [
    { id: "map", label: "Brain Map", icon: "🗺️" },
    { id: "positions", label: "Positions", icon: "📊" },
    { id: "theses", label: "Theses", icon: "🎯" },
    { id: "research", label: "Research", icon: "📝" },
    { id: "trades", label: "Trades", icon: "💹" },
    { id: "brain", label: "Brain", icon: "🧠" },
    { id: "events", label: "Events", icon: "📅" },
    { id: "stats", label: "Stats", icon: "📈" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.text,
      fontFamily: "Inter, -apple-system, sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        position: "relative", zIndex: 50, background: C.bg,
        borderBottom: `1px solid ${C.border}33`, padding: "12px 16px",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div onClick={goHome} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <span style={{ fontSize: 22 }}>🧠</span>
              <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>Brain Explorer</span>
            </div>
            <button onClick={fetchAll} disabled={loading} style={{
              background: loading ? C.border : C.blue, border: "none", color: "#fff",
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              cursor: loading ? "default" : "pointer", opacity: loading ? 0.6 : 1,
            }}>{loading ? "↻ Syncing…" : "↻ Refresh"}</button>
          </div>
          <SearchBar value={search} onChange={setSearch} />
        </div>
      </div>

      {/* Nav Bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 45, background: C.bg + "EE",
        backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}33`,
        overflowX: "auto", WebkitOverflowScrolling: "touch",
      }}>
        <div style={{ display: "flex", gap: 2, padding: "6px 16px", maxWidth: 960, margin: "0 auto" }}>
          {tableNav.map((t) => (
            <button key={t.id} onClick={() => navigate(t.id)} style={{
              background: view === t.id ? C.blue + "22" : "transparent",
              border: view === t.id ? `1px solid ${C.blue}44` : "1px solid transparent",
              color: view === t.id ? C.blue : C.textDim, borderRadius: 8,
              padding: "6px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600,
              whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4,
            }}>
              <span style={{ fontSize: 13, pointerEvents: "none" }}>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "12px 16px 80px", display: "flex", flexDirection: "column", gap: 12 }}>
        {error && (
          <Card style={{ borderColor: C.red + "44" }}>
            <div style={{ color: C.red, fontSize: 13 }}>⚠ Error loading data: {error}</div>
          </Card>
        )}

        <BrainPulse counts={data.counts} lastActivity={data.lastActivity} loading={loading} />

        {/* Search results overlay */}
        {search.trim() && <SearchResults query={search} data={data} onNavigate={navigate} />}

        {/* Views */}
        {!search.trim() && view === "map" && <BrainMap data={data} counts={data.counts} onNavigate={navigate} />}
        {!search.trim() && view === "positions" && <PositionsExplorer data={data.positions} onBack={goHome} />}
        {!search.trim() && view === "theses" && <ThesesExplorer data={data.theses} onBack={goHome} />}
        {!search.trim() && view === "research" && <ResearchExplorer data={data.researchNotes} onBack={goHome} />}
        {!search.trim() && view === "trades" && <TradeExplorer data={data.trades} onBack={goHome} />}
        {!search.trim() && view === "brain" && <BrainEntriesExplorer data={data.brainEntries} onBack={goHome} />}
        {!search.trim() && view === "events" && <PositionEventsExplorer data={data.positionEvents} onBack={goHome} />}
        {!search.trim() && view === "sources" && <SourcesExplorer data={data.sources || []} onBack={goHome} />}
        {!search.trim() && view === "ibkr" && <IBKRExplorer data={data.ibkrSnapshots} onBack={goHome} />}
        {!search.trim() && view === "devices" && <DeviceExplorer data={data.taskActivity} onBack={goHome} />}
        {!search.trim() && view === "stats" && <BrainStats data={data} onBack={goHome} />}
      </div>

      <div style={{ height: 20 }} />
    </div>
  );
}
