import { useState, useEffect, useCallback, useMemo } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

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
const trunc = (s, n = 100) => s ? (s.length > n ? s.slice(0, n) + "…" : s) : "—";

// ─── Color Palette ─────────────────────────────────────────────
const C = {
  bg: "#0F1419", card: "#1B2A4A", cardHover: "#1F3156", border: "#2A3F5F",
  blue: "#2B7DE9", blueLight: "#4A9AF5", text: "#E8ECF1", textDim: "#8899AA",
  green: "#34D399", yellow: "#FBBF24", red: "#F87171", purple: "#A78BFA",
  orange: "#FB923C", teal: "#2DD4BF", pink: "#F472B6",
};

const SOURCE_COLORS = {
  brain_entries: C.purple, research_notes: C.blue,
  trade_journal: C.green, task_activity: C.orange,
};

const STATUS_COLORS = {
  holding: C.green, adding: C.blue, trimming: C.yellow,
  watching_to_exit: C.red, watching: C.textDim, closed: C.textDim,
};

const CONFIDENCE_COLORS = { high: C.green, medium: C.yellow, low: C.red, shaken: C.red };
const CATEGORY_COLORS = {
  company: C.blue, earnings: C.green, sector: C.purple,
  filing: C.orange, transcript_analysis: C.teal,
};

const PIE_COLORS = [C.blue, C.purple, C.green, C.orange, C.teal, C.yellow, C.pink, C.red];

// ─── Reusable Components ───────────────────────────────────────
const Pill = ({ label, color = C.blue, small }) => (
  <span style={{
    display: "inline-block", padding: small ? "1px 6px" : "2px 10px",
    borderRadius: 999, fontSize: small ? 10 : 11, fontWeight: 600,
    background: color + "22", color, letterSpacing: 0.3,
    textTransform: "uppercase", whiteSpace: "nowrap",
  }}>{label}</span>
);

const Card = ({ children, style }) => (
  <div style={{
    background: C.card, borderRadius: 12, padding: 16,
    border: `1px solid ${C.border}`, ...style,
  }}>{children}</div>
);

const SectionTitle = ({ icon, title, count }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
    <span style={{ fontSize: 18 }}>{icon}</span>
    <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0, letterSpacing: 0.3 }}>{title}</h2>
    {count != null && <span style={{
      fontSize: 11, color: C.textDim, background: C.border + "66",
      padding: "2px 8px", borderRadius: 99, fontFamily: "'JetBrains Mono', monospace",
    }}>{count}</span>}
  </div>
);

const ExpandableText = ({ text, limit = 100 }) => {
  const [open, setOpen] = useState(false);
  if (!text) return <span style={{ color: C.textDim }}>—</span>;
  if (text.length <= limit) return <span>{text}</span>;
  return (
    <span>
      {open ? text : trunc(text, limit)}{" "}
      <span onClick={() => setOpen(!open)} style={{
        color: C.blue, cursor: "pointer", fontSize: 11, fontWeight: 600,
      }}>{open ? "less" : "more"}</span>
    </span>
  );
};

// ─── Brain Pulse ───────────────────────────────────────────────
const BrainPulse = ({ counts, lastActivity, loading }) => {
  const stats = [
    { label: "Entries", value: counts.brain_entries, icon: "🧠" },
    { label: "Positions", value: counts.positions, icon: "📊" },
    { label: "Research", value: counts.research_notes, icon: "📝" },
    { label: "Theses", value: counts.theses, icon: "🎯" },
    { label: "Trades", value: counts.trade_journal, icon: "💹" },
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 14 }}>{s.icon}</div>
            <div style={{
              fontSize: 20, fontWeight: 700, color: C.text,
              fontFamily: "'JetBrains Mono', monospace",
            }}>{loading ? "—" : s.value}</div>
            <div style={{ fontSize: 10, color: C.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </Card>
  );
};

// ─── Activity Feed ─────────────────────────────────────────────
const ActivityFeed = ({ items }) => (
  <Card>
    <SectionTitle icon="⚡" title="Activity Feed" count={items.length} />
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.slice(0, 20).map((it, i) => (
        <div key={i} style={{
          display: "flex", gap: 10, alignItems: "flex-start",
          padding: "8px 0", borderBottom: i < items.length - 1 ? `1px solid ${C.border}33` : "none",
        }}>
          <div style={{
            width: 3, minHeight: 32, borderRadius: 2, marginTop: 2,
            background: SOURCE_COLORS[it._source] || C.textDim,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <Pill label={it._source.replace("_", " ")} color={SOURCE_COLORS[it._source]} small />
              {it._label && <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{it._label}</span>}
            </div>
            <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.4 }}>
              {trunc(it._text, 120)}
            </div>
          </div>
          <span style={{
            fontSize: 10, color: C.textDim, whiteSpace: "nowrap",
            fontFamily: "'JetBrains Mono', monospace", flexShrink: 0,
          }}>{ago(it.created_at)}</span>
        </div>
      ))}
      {items.length === 0 && <div style={{ color: C.textDim, fontSize: 13, textAlign: "center", padding: 16 }}>No activity yet</div>}
    </div>
  </Card>
);

// ─── Positions ─────────────────────────────────────────────────
const Positions = ({ data }) => {
  const [sort, setSort] = useState("ticker");
  const sorted = useMemo(() => [...data].sort((a, b) => {
    if (sort === "ticker") return (a.ticker || "").localeCompare(b.ticker || "");
    if (sort === "status") return (a.current_status || "").localeCompare(b.current_status || "");
    if (sort === "reviewed") return new Date(b.last_reviewed || 0) - new Date(a.last_reviewed || 0);
    return 0;
  }), [data, sort]);

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <SectionTitle icon="📊" title="Portfolio Positions" count={data.length} />
        <div style={{ display: "flex", gap: 4 }}>
          {["ticker", "status", "reviewed"].map((s) => (
            <button key={s} onClick={() => setSort(s)} style={{
              background: sort === s ? C.blue + "33" : "transparent",
              border: `1px solid ${sort === s ? C.blue : C.border}`,
              color: sort === s ? C.blue : C.textDim, borderRadius: 6,
              padding: "3px 8px", fontSize: 10, cursor: "pointer",
              textTransform: "uppercase", fontWeight: 600,
            }}>{s}</button>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {sorted.map((p, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
            background: C.bg + "88", borderRadius: 8, border: `1px solid ${C.border}44`,
          }}>
            <span style={{
              fontSize: 16, fontWeight: 800, color: C.text, minWidth: 56,
              fontFamily: "'JetBrains Mono', monospace",
            }}>{p.ticker}</span>
            <Pill label={p.current_status?.replace(/_/g, " ")} color={STATUS_COLORS[p.current_status] || C.textDim} small />
            <div style={{ flex: 1, fontSize: 11, color: C.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.entry_thesis || "—"}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: C.text }}>
                {p.entry_price ? `$${p.entry_price}` : "—"} → {p.target_price ? `$${p.target_price}` : "—"}
              </div>
              <div style={{ fontSize: 10, color: C.textDim }}>{p.last_reviewed ? fmtDate(p.last_reviewed) : ""}</div>
            </div>
          </div>
        ))}
        {data.length === 0 && <div style={{ color: C.textDim, fontSize: 13, textAlign: "center", padding: 20 }}>No active positions</div>}
      </div>
    </Card>
  );
};

// ─── Thesis Tracker ────────────────────────────────────────────
const ThesisCard = ({ t }) => {
  const [open, setOpen] = useState(false);
  const cc = CONFIDENCE_COLORS[t.confidence_level] || C.textDim;
  return (
    <div style={{
      background: C.bg + "88", borderRadius: 10, padding: 14,
      border: `1px solid ${C.border}44`,
      borderLeft: `3px solid ${cc}`,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 6, lineHeight: 1.4 }}>
        {t.thesis_statement || "Untitled thesis"}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
        <Pill label={t.confidence_level || "?"} color={cc} small />
        {t.status && <Pill label={t.status} color={t.status === "active" ? C.green : t.status === "invalidated" ? C.red : C.yellow} small />}
        {t.time_horizon && <Pill label={t.time_horizon} color={C.textDim} small />}
      </div>
      {t.linked_tickers && t.linked_tickers.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
          {(Array.isArray(t.linked_tickers) ? t.linked_tickers : [t.linked_tickers]).map((tk, i) => (
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

const ThesisTracker = ({ data }) => (
  <Card>
    <SectionTitle icon="🎯" title="Thesis Tracker" count={data.length} />
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map((t, i) => <ThesisCard key={i} t={t} />)}
      {data.length === 0 && <div style={{ color: C.textDim, fontSize: 13, textAlign: "center", padding: 20 }}>No theses tracked</div>}
    </div>
  </Card>
);

// ─── Research Notes ────────────────────────────────────────────
const ResearchNotes = ({ data }) => (
  <Card>
    <SectionTitle icon="📝" title="Recent Research" count={data.length} />
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.slice(0, 15).map((n, i) => (
        <div key={i} style={{
          padding: "10px 12px", background: C.bg + "88", borderRadius: 8,
          border: `1px solid ${C.border}44`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{n.title || "Untitled"}</span>
            {n.source && <Pill label={n.source} color={C.textDim} small />}
            {n.category && <Pill label={n.category} color={CATEGORY_COLORS[n.category] || C.textDim} small />}
          </div>
          <div style={{ fontSize: 12, color: C.textDim, lineHeight: 1.4, marginBottom: 4 }}>
            <ExpandableText text={n.key_takeaway} limit={150} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            {n.related_tickers && (Array.isArray(n.related_tickers) ? n.related_tickers : []).map((tk, j) => (
              <span key={j} style={{
                fontSize: 10, fontWeight: 700, color: C.blue, background: C.blue + "18",
                padding: "1px 5px", borderRadius: 3, fontFamily: "'JetBrains Mono', monospace",
              }}>{tk}</span>
            ))}
            <span style={{ fontSize: 10, color: C.textDim, marginLeft: "auto", fontFamily: "'JetBrains Mono', monospace" }}>
              {ago(n.created_at)}
            </span>
          </div>
        </div>
      ))}
      {data.length === 0 && <div style={{ color: C.textDim, fontSize: 13, textAlign: "center", padding: 20 }}>No research notes</div>}
    </div>
  </Card>
);

// ─── Trade Journal ─────────────────────────────────────────────
const TradeJournal = ({ data }) => (
  <Card>
    <SectionTitle icon="💹" title="Trade Journal" count={data.length} />
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.slice(0, 30).map((t, i) => {
        const isBuy = (t.action || t.direction || "").toLowerCase().includes("buy");
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
            background: C.bg + "88", borderRadius: 8, border: `1px solid ${C.border}44`,
          }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>{isBuy ? "🟢" : "🔴"}</span>
            <span style={{
              fontSize: 14, fontWeight: 800, color: C.text, minWidth: 48,
              fontFamily: "'JetBrains Mono', monospace",
            }}>{t.ticker}</span>
            <span style={{
              fontSize: 11, fontWeight: 600, color: isBuy ? C.green : C.red,
              textTransform: "uppercase",
            }}>{t.action || t.direction || "—"}</span>
            <div style={{ flex: 1, fontSize: 11, color: C.textDim }}>
              {t.quantity && <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{t.quantity} </span>}
              {t.price && <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>@ ${t.price}</span>}
            </div>
            <span style={{ fontSize: 10, color: C.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
              {t.trade_date ? fmtDate(t.trade_date) : ago(t.created_at)}
            </span>
          </div>
        );
      })}
      {data.length === 0 && <div style={{ color: C.textDim, fontSize: 13, textAlign: "center", padding: 20 }}>No trades logged</div>}
    </div>
  </Card>
);

// ─── Device Activity ───────────────────────────────────────────
const DeviceActivity = ({ data }) => (
  <Card>
    <SectionTitle icon="🖥️" title="Device Activity" count={data.length} />
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.slice(0, 10).map((d, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
          background: C.bg + "88", borderRadius: 8, border: `1px solid ${C.border}44`,
        }}>
          <span style={{ fontSize: 18 }}>
            {(d.device || "").toLowerCase().includes("mini") ? "🖥️" : "💻"}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{d.task_name || "—"}</span>
              {d.status && <span style={{
                fontSize: 10,
                color: d.status === "completed" ? C.green : d.status === "failed" ? C.red : C.yellow,
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
      {data.length === 0 && <div style={{ color: C.textDim, fontSize: 13, textAlign: "center", padding: 20 }}>No device activity</div>}
    </div>
  </Card>
);

// ─── Brain Stats Charts ────────────────────────────────────────
const BrainStats = ({ brainEntries, positions, researchNotes }) => {
  const catData = useMemo(() => {
    const map = {};
    brainEntries.forEach((e) => { const c = e.category || "uncategorized"; map[c] = (map[c] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [brainEntries]);

  const statusData = useMemo(() => {
    const map = {};
    positions.forEach((p) => { const s = p.current_status || "unknown"; map[s] = (map[s] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [positions]);

  const resCatData = useMemo(() => {
    const map = {};
    researchNotes.forEach((n) => { const c = n.category || "other"; map[c] = (map[c] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [researchNotes]);

  const chartLabel = ({ name, percent }) => percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : "";

  if (catData.length === 0 && statusData.length === 0 && resCatData.length === 0) return null;

  return (
    <Card>
      <SectionTitle icon="📈" title="Brain Stats" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        {catData.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: C.textDim, textAlign: "center", marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>
              Entries by Category
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={catData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value" label={chartLabel} labelLine={false} style={{ fontSize: 9 }}>
                  {catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {statusData.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: C.textDim, textAlign: "center", marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>
              Positions by Status
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value" label={chartLabel} labelLine={false} style={{ fontSize: 9 }}>
                  {statusData.map((d, i) => <Cell key={i} fill={STATUS_COLORS[d.name] || PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {resCatData.length > 0 && (
          <div>
            <div style={{ fontSize: 11, color: C.textDim, textAlign: "center", marginBottom: 4, textTransform: "uppercase", fontWeight: 600 }}>
              Research by Category
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={resCatData} layout="vertical" margin={{ left: 60, right: 8, top: 4, bottom: 4 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: C.textDim }} width={55} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {resCatData.map((d, i) => <Cell key={i} fill={CATEGORY_COLORS[d.name] || PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Bar>
                <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 11, color: C.text }} cursor={{ fill: C.border + "33" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Card>
  );
};

// ─── Search Bar ────────────────────────────────────────────────
const SearchBar = ({ value, onChange }) => (
  <div style={{ position: "relative" }}>
    <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 16, opacity: 0.5 }}>🔍</span>
    <input
      type="text" value={value} onChange={(e) => onChange(e.target.value)}
      placeholder="Search brain… (ticker, keyword, topic)"
      style={{
        width: "100%", padding: "12px 12px 12px 40px", borderRadius: 10,
        background: C.card, border: `1px solid ${C.border}`, color: C.text,
        fontSize: 14, outline: "none", fontFamily: "Inter, sans-serif",
        boxSizing: "border-box",
      }}
    />
  </div>
);

// ─── Main App ──────────────────────────────────────────────────
export default function BrainDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [data, setData] = useState({
    brainEntries: [], positions: [], researchNotes: [],
    theses: [], trades: [], taskActivity: [],
    counts: { brain_entries: 0, positions: 0, research_notes: 0, theses: 0, trade_journal: 0 },
    lastActivity: null,
  });
  const [activeTab, setActiveTab] = useState("feed");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [brainEntries, positions, researchNotes, theses, trades, taskActivity,
        cBrain, cPos, cRes, cThes, cTrade] = await Promise.all([
        sb("brain_entries", "select=*&order=created_at.desc&limit=100").catch(() => []),
        sb("positions", "select=*&order=ticker.asc").catch(() => []),
        sb("research_notes", "select=*&order=created_at.desc&limit=50").catch(() => []),
        sb("theses", "select=*&order=created_at.desc").catch(() => []),
        sb("trade_journal", "select=*&order=trade_date.desc.nullslast,created_at.desc&limit=50").catch(() => []),
        sb("task_activity", "select=*&order=created_at.desc&limit=20").catch(() => []),
        sbCount("brain_entries"),
        sbCount("positions"),
        sbCount("research_notes"),
        sbCount("theses"),
        sbCount("trade_journal"),
      ]);

      const allDates = [
        ...brainEntries.map((e) => e.created_at),
        ...researchNotes.map((e) => e.created_at),
        ...trades.map((e) => e.created_at),
        ...taskActivity.map((e) => e.created_at),
      ].filter(Boolean).sort().reverse();

      setData({
        brainEntries, positions, researchNotes, theses, trades, taskActivity,
        counts: { brain_entries: cBrain, positions: cPos, research_notes: cRes, theses: cThes, trade_journal: cTrade },
        lastActivity: allDates[0] || null,
      });
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Build unified activity feed
  const activityFeed = useMemo(() => {
    const items = [];
    data.brainEntries.forEach((e) => items.push({
      ...e, _source: "brain_entries", _label: e.category,
      _text: e.raw_text || e.processed_text || e.content || "",
    }));
    data.researchNotes.forEach((e) => items.push({
      ...e, _source: "research_notes", _label: e.title,
      _text: e.key_takeaway || e.summary || "",
    }));
    data.trades.forEach((e) => items.push({
      ...e, _source: "trade_journal", _label: `${e.ticker} ${e.action || e.direction || ""}`,
      _text: `${e.quantity || ""} @ $${e.price || "?"} — ${e.thesis_reference || e.rationale || ""}`,
    }));
    data.taskActivity.forEach((e) => items.push({
      ...e, _source: "task_activity", _label: `${e.device || ""} · ${e.task_name || ""}`,
      _text: e.summary || e.result_summary || "",
    }));
    items.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return items;
  }, [data]);

  // Search filter
  const q = search.toLowerCase().trim();
  const filter = useCallback((items) => {
    if (!q) return items;
    return items.filter((it) => JSON.stringify(it).toLowerCase().includes(q));
  }, [q]);

  const filteredFeed = useMemo(() => filter(activityFeed), [filter, activityFeed]);
  const filteredPositions = useMemo(() => {
    const active = data.positions.filter((p) =>
      ["holding", "adding", "trimming", "watching_to_exit"].includes(p.current_status)
    );
    return filter(active);
  }, [filter, data.positions]);
  const filteredTheses = useMemo(() => filter(data.theses), [filter, data.theses]);
  const filteredResearch = useMemo(() => filter(data.researchNotes), [filter, data.researchNotes]);
  const filteredTrades = useMemo(() => filter(data.trades), [filter, data.trades]);
  const filteredTask = useMemo(() => filter(data.taskActivity), [filter, data.taskActivity]);

  const tabs = [
    { id: "feed", label: "Feed", icon: "⚡" },
    { id: "positions", label: "Positions", icon: "📊" },
    { id: "theses", label: "Theses", icon: "🎯" },
    { id: "research", label: "Research", icon: "📝" },
    { id: "trades", label: "Trades", icon: "💹" },
    { id: "stats", label: "Stats", icon: "📈" },
    { id: "devices", label: "Devices", icon: "🖥️" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.text,
      fontFamily: "Inter, -apple-system, sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50, background: C.bg + "EE",
        backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}33`,
        padding: "12px 16px",
      }}>
        <div style={{ maxWidth: 960, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 22 }}>🧠</span>
              <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5 }}>Investment Brain</span>
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

      {/* Tab Bar */}
      <div style={{
        position: "sticky", top: 95, zIndex: 40, background: C.bg + "EE",
        backdropFilter: "blur(12px)", borderBottom: `1px solid ${C.border}33`,
        overflowX: "auto", WebkitOverflowScrolling: "touch",
      }}>
        <div style={{
          display: "flex", gap: 2, padding: "6px 16px", maxWidth: 960, margin: "0 auto",
        }}>
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              background: activeTab === t.id ? C.blue + "22" : "transparent",
              border: activeTab === t.id ? `1px solid ${C.blue}44` : "1px solid transparent",
              color: activeTab === t.id ? C.blue : C.textDim, borderRadius: 8,
              padding: "6px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600,
              whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4,
            }}>
              <span style={{ fontSize: 13 }}>{t.icon}</span> {t.label}
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

        {activeTab === "feed" && <ActivityFeed items={filteredFeed} />}
        {activeTab === "positions" && <Positions data={filteredPositions} />}
        {activeTab === "theses" && <ThesisTracker data={filteredTheses} />}
        {activeTab === "research" && <ResearchNotes data={filteredResearch} />}
        {activeTab === "trades" && <TradeJournal data={filteredTrades} />}
        {activeTab === "stats" && <BrainStats brainEntries={data.brainEntries} positions={data.positions} researchNotes={data.researchNotes} />}
        {activeTab === "devices" && <DeviceActivity data={filteredTask} />}
      </div>

      {/* Bottom spacer for mobile */}
      <div style={{ height: 20 }} />
    </div>
  );
}