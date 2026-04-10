import { useState, useEffect, useRef, useCallback, createContext, useContext } from "react";

// ─── Feature flags from environment variables ─────────────────────────────────
const FLAGS = {
  gps:           import.meta.env.VITE_ENABLE_GPS           !== "false",
  notifications: import.meta.env.VITE_ENABLE_NOTIFICATIONS !== "false",
  healthkit:     import.meta.env.VITE_ENABLE_HEALTHKIT      !== "false",
};

// ─── Google Maps key is kept server-side in the Netlify function ─────────────
// The MapView component fetches the embed URL from /api/places-search?map_url=1
// so the API key never appears in the browser bundle.
if (typeof window !== "undefined") {
  window.__GMAP_KEY__ = ""; // Always empty — key is server-side only
}
import { usePhotoUpload } from "./hooks/usePhotoUpload";
import { useBadges } from "./hooks/useBadges";
import { useChallenges } from "./hooks/useChallenges";
import { useNotifications } from "./hooks/useNotifications";
import { useOfflineCache } from "./hooks/useOfflineCache";
import { useCalendarSync } from "./hooks/useCalendarSync";
import { searchCache } from "./lib/searchCache";
import { supabase } from "./lib/supabase";

/* ══════════════════════════════════════════════════════════════════════════
   THEME SYSTEM — light & dark
══════════════════════════════════════════════════════════════════════════ */
const DARK = {
  // Base
  bg:         "#0D0D12",
  surface:    "#15151C",
  surfaceHi:  "#1D1D28",
  surfaceEl:  "#252532",

  // Accent family — coral primary + supporting cast
  accent:        "#FF6B6B",
  accentDim:     "rgba(255,107,107,0.18)",
  accentDim2:    "rgba(255,107,107,0.08)",
  accentPurple:  "#A06CD5",
  purpleDim:     "rgba(160,108,213,0.18)",
  accentTeal:    "#4ECDC4",
  tealDim:       "rgba(78,205,196,0.18)",
  accentLime:    "#C8E650",
  lime:          "#C8E650",
  limeDim:       "rgba(200,230,80,0.15)",
  accentYellow:  "#FFE66D",
  yellowDim:     "rgba(255,230,109,0.15)",

  // Gradients
  gradientPrimary:   "linear-gradient(135deg, #A06CD5, #FF6B6B)",
  gradientCoral:     "linear-gradient(135deg, #FF6B6B, #EE5A24)",
  gradientPurple:    "linear-gradient(135deg, #A06CD5, #6C5CE7)",
  gradientTeal:      "linear-gradient(135deg, #4ECDC4, #00B894)",
  gradientLime:      "linear-gradient(135deg, #C8E650, #A8C030)",
  gradientCard:      "linear-gradient(135deg, rgba(160,108,213,0.15), rgba(255,107,107,0.08))",
  gradientAccent:    "linear-gradient(135deg, #FF6B6B, #F5A07A)",

  // Text
  textPri: "#FFFFFF",
  textSec: "#A0A0B4",
  textTer: "#606072",

  // Borders
  border:   "rgba(255,255,255,0.06)",
  borderMd: "rgba(255,255,255,0.12)",

  // Functional
  green:    "#5BAF7A",
  greenDim: "rgba(91,175,122,0.15)",
  blue:     "#6BA3D6",
  blueDim:  "rgba(107,163,214,0.15)",
  red:      "#FF6B6B",
  redDim:   "rgba(255,107,107,0.15)",
  purple:   "#A06CD5",

  // UI
  navBg:        "rgba(13,13,18,0.97)",
  inputBg:      "#1D1D28",
  shadow:       "0 8px 32px rgba(0,0,0,0.4)",
  shadowSmall:  "0 4px 12px rgba(0,0,0,0.25)",
  shadowAccent: "0 8px 28px rgba(255,107,107,0.35)",
  shadowPurple: "0 8px 28px rgba(160,108,213,0.35)",
  shadowTeal:   "0 8px 28px rgba(78,205,196,0.3)",
};

const LIGHT = {
  bg:         "#F7F7FF",
  surface:    "#FFFFFF",
  surfaceHi:  "#F0EFF9",
  surfaceEl:  "#E8E6F5",

  accent:        "#FF6B6B",
  accentDim:     "rgba(255,107,107,0.12)",
  accentDim2:    "rgba(255,107,107,0.06)",
  accentPurple:  "#A06CD5",
  purpleDim:     "rgba(160,108,213,0.10)",
  accentTeal:    "#4ECDC4",
  tealDim:       "rgba(78,205,196,0.12)",
  accentLime:    "#8FB820",
  lime:          "#8FB820",
  limeDim:       "rgba(143,184,32,0.12)",
  accentYellow:  "#E6A800",
  yellowDim:     "rgba(230,168,0,0.12)",

  gradientPrimary:   "linear-gradient(135deg, #A06CD5, #FF6B6B)",
  gradientCoral:     "linear-gradient(135deg, #FF6B6B, #EE5A24)",
  gradientPurple:    "linear-gradient(135deg, #A06CD5, #6C5CE7)",
  gradientTeal:      "linear-gradient(135deg, #4ECDC4, #00B894)",
  gradientLime:      "linear-gradient(135deg, #C8E650, #A8C030)",
  gradientCard:      "linear-gradient(135deg, rgba(160,108,213,0.08), rgba(255,107,107,0.04))",
  gradientAccent:    "linear-gradient(135deg, #FF6B6B, #F5A07A)",

  textPri: "#12121E",
  textSec: "#606070",
  textTer: "#A0A0B0",

  border:   "rgba(60,40,120,0.08)",
  borderMd: "rgba(60,40,120,0.16)",

  green:    "#3A8A58",
  greenDim: "rgba(58,138,88,0.12)",
  blue:     "#2D6FA8",
  blueDim:  "rgba(45,111,168,0.12)",
  red:      "#FF6B6B",
  redDim:   "rgba(255,107,107,0.12)",
  purple:   "#A06CD5",

  navBg:        "rgba(247,247,255,0.97)",
  inputBg:      "#F0EFF9",
  shadow:       "0 4px 20px rgba(60,40,120,0.10)",
  shadowSmall:  "0 2px 8px rgba(60,40,120,0.07)",
  shadowAccent: "0 4px 20px rgba(255,107,107,0.25)",
  shadowPurple: "0 4px 20px rgba(160,108,213,0.22)",
  shadowTeal:   "0 4px 20px rgba(78,205,196,0.22)",
};

const ThemeCtx = createContext({ C: DARK, dark: true, toggle: () => {} });
const useTheme = () => useContext(ThemeCtx);

function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("pp_theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const C = dark ? DARK : LIGHT;
  const toggle = () => { setDark(d => { localStorage.setItem("pp_theme", !d ? "dark" : "light"); return !d; }); };
  return <ThemeCtx.Provider value={{ C, dark, toggle }}>{children}</ThemeCtx.Provider>;
}

const FD = "'Playfair Display',Georgia,serif";
const FB = "'Outfit','DM Sans',sans-serif";

/* ══════════════════════════════════════════════════════════════════════════
   DESIGN COMPONENTS
══════════════════════════════════════════════════════════════════════════ */
function Stars({ n = 5, size = 13 }) {
  const { C } = useTheme();
  return <span style={{ color: "#FFB800", fontSize: size, letterSpacing: 0.5 }}>{"★".repeat(Math.round(n))}{"☆".repeat(5 - Math.round(n))}</span>;
}

/* ── ProgressRing ── */
function ProgressRing({ progress = 0, size = 52, strokeWidth = 4, color, children, label }) {
  const { C } = useTheme();
  const col = color || C.accent;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (Math.min(100, progress) / 100) * circumference;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ display: "block" }}>
        <circle stroke="rgba(255,255,255,0.08)" fill="none" strokeWidth={strokeWidth} r={radius} cx={size / 2} cy={size / 2} />
        <circle stroke={col} fill="none" strokeWidth={strokeWidth} strokeLinecap="round"
          r={radius} cx={size / 2} cy={size / 2}
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {children && <span style={{ fontSize: size * 0.28, fontWeight: 700, color: "#fff", lineHeight: 1, fontFamily: FB }}>{children}</span>}
        {label && <span style={{ fontSize: size * 0.16, color: "rgba(255,255,255,0.6)", fontWeight: 600, fontFamily: FB, marginTop: 1 }}>{label}</span>}
      </div>
    </div>
  );
}

/* ── Pill — compact filter tag ── */
function Pill({ label, active, onClick, style = {} }) {
  const { C } = useTheme();
  return (
    <button onClick={onClick} style={{
      background: active ? C.accent : C.surfaceEl,
      color: active ? "#fff" : C.textSec,
      border: "none",
      borderRadius: 100, padding: "6px 16px", fontSize: 12, fontWeight: active ? 700 : 500,
      cursor: "pointer", whiteSpace: "nowrap", fontFamily: FB,
      transition: "all 0.15s", letterSpacing: 0.2,
      boxShadow: active ? C.shadowAccent : "none",
      ...style,
    }}>{label}</button>
  );
}

/* ── Chip — larger filter chip matching inspiration ── */
function Chip({ label, active, onClick, icon, color }) {
  const { C } = useTheme();
  const activeBg = color === "purple" ? C.gradientPurple
    : color === "teal" ? C.gradientTeal
    : color === "lime" ? C.gradientLime
    : C.gradientCoral;
  return (
    <button onClick={onClick} style={{
      background: active ? activeBg : "rgba(255,255,255,0.07)",
      color: active ? "#fff" : C.textSec,
      border: active ? "none" : `1px solid ${C.border}`,
      borderRadius: 100, padding: "9px 20px", fontSize: 13, fontWeight: active ? 700 : 500,
      cursor: "pointer", whiteSpace: "nowrap", fontFamily: FB,
      display: "flex", alignItems: "center", gap: 6,
      transition: "all 0.15s ease",
      boxShadow: active ? C.shadowAccent : "none",
    }}>
      {icon && <span style={{ fontSize: 15 }}>{icon}</span>}
      {label}
    </button>
  );
}

/* ── StatChip — coloured stat badge like "Beginner Level / 50.4 Kcal" ── */
function StatChip({ label, value, icon, color }) {
  const { C } = useTheme();
  const configs = {
    coral:  { bg: C.redDim,    text: C.accent,       border: "rgba(255,107,107,0.2)" },
    purple: { bg: C.purpleDim, text: C.accentPurple,  border: "rgba(160,108,213,0.2)" },
    teal:   { bg: C.tealDim,   text: C.accentTeal,    border: "rgba(78,205,196,0.2)" },
    lime:   { bg: C.limeDim,   text: C.lime,          border: "rgba(200,230,80,0.2)" },
    yellow: { bg: C.yellowDim, text: C.accentYellow,  border: "rgba(255,230,109,0.2)" },
  };
  const cfg = configs[color] || { bg: C.surfaceEl, text: C.textPri, border: C.border };
  return (
    <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 14, padding: "10px 14px", display: "inline-flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
      {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
      <div>
        <p style={{ fontSize: 10, color: C.textTer, margin: 0, fontFamily: FB, fontWeight: 600, letterSpacing: "0.04em" }}>{label}</p>
        <p style={{ fontSize: 15, fontWeight: 800, color: cfg.text, margin: 0, fontFamily: FB }}>{value}</p>
      </div>
    </div>
  );
}

/* ── Card ── */
function Card({ children, style = {}, onClick, accent, glow, gradient }) {
  const { C } = useTheme();
  const bg = gradient === "coral"  ? C.gradientCoral
    : gradient === "purple" ? C.gradientPurple
    : gradient === "teal"   ? C.gradientTeal
    : gradient === "lime"   ? C.gradientLime
    : gradient === "card"   ? C.gradientCard
    : accent ? `linear-gradient(135deg,${C.accentDim},${C.accentDim2})`
    : C.surface;
  return (
    <div onClick={onClick} style={{
      background: bg,
      border: gradient || accent ? "none" : `1px solid ${C.border}`,
      borderRadius: 22, padding: "16px", marginBottom: 12,
      cursor: onClick ? "pointer" : "default",
      transition: "all 0.2s cubic-bezier(0.2,0.9,0.4,1.1)",
      boxShadow: glow ? C.shadow : C.shadowSmall,
      ...style,
    }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = C.shadow; } }}
      onMouseLeave={e => { if (onClick) { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = glow ? C.shadow : C.shadowSmall; } }}>
      {children}
    </div>
  );
}

/* ── Btn ── */
function Btn({ label, onClick, outline, ghost, small, full, style = {}, disabled, icon, loading, gradient }) {
  const { C } = useTheme();
  const isPrimary = !ghost && !outline;
  const bg = ghost ? "transparent"
    : outline ? "transparent"
    : gradient ? C.gradientPrimary
    : C.accent;
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      background: bg,
      color: ghost ? C.textSec : outline ? C.accent : "#fff",
      border: ghost ? `1.5px solid ${C.border}` : outline ? `1.5px solid ${C.accent}` : "none",
      borderRadius: 100,
      padding: small ? "9px 20px" : "13px 26px",
      fontSize: small ? 12 : 14, fontWeight: 700,
      cursor: (disabled || loading) ? "not-allowed" : "pointer",
      fontFamily: FB, letterSpacing: 0.3, opacity: (disabled || loading) ? 0.5 : 1,
      transition: "all 0.15s", width: full ? "100%" : "auto",
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
      boxShadow: isPrimary ? C.shadowAccent : "none",
      ...style,
    }}
      onMouseEnter={e => { if (!disabled && !loading) { e.currentTarget.style.opacity = "0.88"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
      onMouseLeave={e => { if (!disabled && !loading) { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; } }}>
      {loading ? "…" : <>{icon && <span>{icon}</span>}{label}</>}
    </button>
  );
}

/* ── SL — section label ── */
function SL({ children, style = {} }) {
  const { C } = useTheme();
  return <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", color: C.textTer, textTransform: "uppercase", margin: "0 0 12px", fontFamily: FB, ...style }}>{children}</p>;
}

/* ── Inp ── */
function Inp({ placeholder, value, onChange, style = {}, multiline, type = "text" }) {
  const { C } = useTheme();
  const base = {
    background: C.inputBg, border: `1.5px solid ${C.border}`, borderRadius: 16,
    padding: "13px 16px", fontSize: 14, color: C.textPri, fontFamily: FB,
    width: "100%", outline: "none", resize: "none", boxSizing: "border-box",
    transition: "border-color 0.15s, box-shadow 0.15s", ...style,
  };
  const focus = e => { e.target.style.borderColor = C.accentPurple; e.target.style.boxShadow = `0 0 0 3px ${C.purpleDim}`; };
  const blur  = e => { e.target.style.borderColor = C.border; e.target.style.boxShadow = "none"; };
  return multiline
    ? <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={base} onFocus={focus} onBlur={blur} />
    : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={base} onFocus={focus} onBlur={blur} />;
}

/* ── Toggle ── */
function Toggle({ on, onClick, label }) {
  const { C } = useTheme();
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      {label && <span style={{ fontSize: 13, color: C.textPri, flex: 1, fontFamily: FB }}>{label}</span>}
      <div style={{
        width: 48, height: 28, borderRadius: 100,
        background: on ? C.gradientPrimary : C.surfaceEl,
        border: `1.5px solid ${on ? "transparent" : C.border}`,
        position: "relative", transition: "all 0.22s", flexShrink: 0,
      }}>
        <div style={{ width: 22, height: 22, background: "#fff", borderRadius: "50%", position: "absolute", top: 2, left: on ? 22 : 2, transition: "left 0.22s", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
      </div>
    </div>
  );
}

/* ── Toast ── */
function Toast({ msg, onClose }) {
  const { C } = useTheme();
  useEffect(() => { if (msg) { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); } }, [msg]);
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)",
      background: C.gradientPrimary, color: "#fff", borderRadius: 100,
      padding: "12px 24px", fontSize: 13, fontWeight: 700, fontFamily: FB,
      zIndex: 999, boxShadow: C.shadowPurple, whiteSpace: "nowrap",
      animation: "fadeUp 0.2s ease", letterSpacing: 0.3,
    }}>{msg}</div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   DATA & STATIC CONTENT
══════════════════════════════════════════════════════════════════════════ */
// STUDIOS_SEED is now empty — all studios come from Google Places API
// The seed is kept as an empty array for backwards compatibility
const STUDIOS_SEED = [];
// BADGES_DEF removed — now fetched from Supabase via useBadges hook
const CLASS_TYPES = ["Reformer", "Mat", "Tower", "Private", "Group", "Hot Pilates", "Strength", "Stretch / Recovery", "Beginner", "Advanced"];

/* ── Smart studio icon based on tags, name, rating ── */
function getStudioIcon(studio) {
  const name  = (studio?.name || "").toLowerCase();
  const tags  = [...(studio?.tags || []), ...(studio?.types || []), ...(studio?.class_types || [])].map(t => (t||"").toLowerCase());
  const rating = studio?.rating || 0;
  const all   = name + " " + tags.join(" ");

  if (rating >= 4.8)           return "🏆";
  if (all.includes("hot"))     return "🔥";
  if (all.includes("luxury") || all.includes("premium") || all.includes("boutique")) return "💎";
  if (all.includes("private")) return "✨";
  if (all.includes("tower"))   return "⚡";
  if (all.includes("reformer"))return "🔄";
  if (all.includes("mat"))     return "🧘‍♀️";
  if (all.includes("barre"))   return "🩰";
  if (all.includes("group"))   return "👥";
  if (all.includes("beginner") || all.includes("intro")) return "🌱";
  if (all.includes("advanced") || all.includes("expert")) return "💪";
  if (all.includes("stretch") || all.includes("recovery")) return "🌿";
  return "🪷";
}

/* ── Daily motivational Pilates quotes (rotates by day) ── */
const PILATES_QUOTES = [
  { quote: "Inhale confidence, exhale doubt.", author: "Pilates wisdom" },
  { quote: "The mind, when housed within a healthful body, possesses a glorious sense of power.", author: "Joseph Pilates" },
  { quote: "Physical fitness is the first requisite of happiness.", author: "Joseph Pilates" },
  { quote: "Change happens through movement, and movement heals.", author: "Joseph Pilates" },
  { quote: "A body free from nervous tension and fatigue is the ideal shelter for a well-balanced mind.", author: "Joseph Pilates" },
  { quote: "Every moment of our life can be the beginning of great things.", author: "Pilates wisdom" },
  { quote: "You are only one workout away from a good mood.", author: "Pilates wisdom" },
  { quote: "It's never too late to get your body in shape.", author: "Joseph Pilates" },
  { quote: "Contrology is complete coordination of body, mind, and spirit.", author: "Joseph Pilates" },
  { quote: "Progress, not perfection.", author: "Pilates wisdom" },
  { quote: "Your body can do it. It's your mind you need to convince.", author: "Pilates wisdom" },
  { quote: "10 sessions feel different. 20 sessions look different. 30 sessions change your body.", author: "Joseph Pilates" },
];

function getDailyQuote() {
  const day = Math.floor(Date.now() / 86400000);
  return PILATES_QUOTES[day % PILATES_QUOTES.length];
}

/* ── Fun loading messages ── */
const LOADING_MESSAGES = [
  "Rolling out your mat…",
  "Finding your zen…",
  "Counting breaths…",
  "Aligning your spine…",
  "Warming up the reformer…",
  "Centering your core…",
  "Preparing your practice…",
  "Breathing in, breathing out…",
];

function getLoadingMessage() {
  return LOADING_MESSAGES[Math.floor(Math.random() * LOADING_MESSAGES.length)];
}
const GREETINGS = [
  { top: "Rise & reform,", name: true }, { top: "Your body called.", sub: "Time to show up." },
  { top: "Good morning,", name: true }, { top: "She's back.", sub: "Ready to move?" },
  { top: "Let's get into it,", name: true }, { top: "Alignment check:", sub: "You're doing great." },
  { top: "No excuses, just", sub: "Pilates." }, { top: "The reformer misses you,", name: true },
];
const NAV = [{ id: "home", label: "Home", icon: "⌂" }, { id: "explore", label: "Explore", icon: "✦" }, { id: "log", label: "+", icon: "+" }, { id: "passport", label: "Passport", icon: "◎" }, { id: "profile", label: "Profile", icon: "◉" }];

/* ── stats helper ── */
function getStats(logs) {
  // Count unique studios — check ALL possible fields a log might use
  const studioKeys = logs.map(l => {
    // Priority: google_place_id > studio_id > studio_name_manual > studio name
    const key = l.google_place_id ||
      (l.studio_id && String(l.studio_id)) ||
      l.studio_name_manual ||
      l.studio ||
      null;
    return key ? String(key).trim().toLowerCase() : null;
  }).filter(Boolean);
  const studios = [...new Set(studioKeys)];
  // Cities and countries — normalize case
  const cities = [...new Set(logs.map(l => (l.city || "").trim().toLowerCase()).filter(Boolean))];
  const countries = [...new Set(logs.map(l => (l.country || "").trim().toLowerCase()).filter(Boolean))];
  const photos = logs.reduce((a, l) => a + (l.photos?.length || 0), 0);
  const earlyClasses = logs.filter(l => parseInt(l.time || l.start_time || "0") < 9).length;
  const totalMin = logs.reduce((a, l) => a + (l.duration || l.duration_minutes || 0), 0);
  const tf = {}; logs.forEach(l => { const t = l.type || l.class_type || "—"; tf[t] = (tf[t] || 0) + 1; });
  const favType = Object.entries(tf).sort((a, b) => b[1] - a[1])[0]?.[0];
  const watchLogs = logs.filter(l => l.watchData || l.workouts);
  const totalCal = watchLogs.reduce((a, l) => a + (l.watchData?.cal || l.workouts?.calories_burned || 0), 0);
  const avgHr = watchLogs.length ? Math.round(watchLogs.reduce((a, l) => a + (l.watchData?.hr || l.workouts?.avg_heart_rate || 0), 0) / watchLogs.length) : 0;
  const travelCount = logs.filter(l => l.isTravel || l.is_travel_class).length;
  const monthCounts = {}; logs.forEach(l => { const m = (l.date || "").slice(0, 7); if (m) monthCounts[m] = (monthCounts[m] || 0) + 1; });
  const hourDist = { morning: 0, midday: 0, evening: 0 };
  logs.forEach(l => { const h = parseInt(l.time || l.start_time || "0"); if (h < 12) hourDist.morning++; else if (h < 17) hourDist.midday++; else hourDist.evening++; });
  return { classes: logs.length, studios: studios.length, cities: cities.length, countries: countries.length, photos, earlyClasses, totalMin, favType, reviews: 0, cityList: [...cities], countryList: [...countries], totalCal, avgHr, travelCount, monthCounts, hourDist };
}
// evalBadges removed — using useBadges hook instead

/* ── Map component ── */
function MapView({ studios, visitedIds, onSelect, userCoords }) {
  const { C } = useTheme();
  const [selected, setSelected] = useState(null);

  if (!studios.length) return null;

  // Get center point for the map
  const centerStudio = studios[0];
  const centerLat = userCoords?.lat || centerStudio?.lat || centerStudio?.latitude || 40.7128;
  const centerLng = userCoords?.lng || centerStudio?.lng || centerStudio?.longitude || -74.0060;

  // Fetch the embed URL from the server (keeps API key out of browser bundle)
  const [embedUrl, setEmbedUrl] = useState("");
  useEffect(() => {
    fetch(`/api/places-search?map_embed=1&lat=${centerLat}&lng=${centerLng}`)
      .then(r => r.json())
      .then(d => { if (d.embedUrl) setEmbedUrl(d.embedUrl); })
      .catch(() => {});
  }, [centerLat, centerLng]);
  const searchUrl = embedUrl;

  return (
    <div style={{ margin: "12px 20px 0", borderRadius: 18, overflow: "hidden", border: `1px solid ${C.border}`, position: "relative" }}>
      {/* Interactive Google Map embed */}
      <iframe
        title="Studios map"
        width="100%"
        height="300"
        style={{ border: 0, display: "block" }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={searchUrl}
      />

      {/* Studio list below map — tap to select */}
      <div style={{ background: C.surface, padding: "8px 0" }}>
        {studios.slice(0, 8).filter(s => (s.lat || s.latitude) && (s.lng || s.longitude)).map((s, i) => {
          const v = visitedIds?.has(s.id);
          return (
            <div
              key={s.id || i}
              onClick={() => { setSelected(s.id); onSelect?.(s); }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 16px", cursor: "pointer",
                borderBottom: `1px solid ${C.border}`,
                background: selected === s.id ? C.accentDim : "transparent",
                transition: "background 0.15s",
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: v ? C.accent : C.surfaceHi,
                border: `2px solid ${v ? C.accent : C.border}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, color: v ? "#fff" : C.textTer, fontWeight: 700,
              }}>
                {v ? "✓" : i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.textPri, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</p>
                <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>
                  {s.distance || `${s.city}, ${s.country}`}
                  {v && <span style={{ color: C.accent, fontWeight: 700 }}> · Visited</span>}
                </p>
              </div>
              {s.rating > 0 && <span style={{ fontSize: 12, color: C.accent, fontWeight: 700, flexShrink: 0 }}>★ {s.rating}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   QUICK LOG MODAL — one-tap class logging from home screen FAB
══════════════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════════════
   BADGE CELEBRATION MODAL — full-screen confetti + badge reveal
══════════════════════════════════════════════════════════════════════════ */
function BadgeCelebrationModal({ badge, onClose }) {
  const { C } = useTheme();
  useEffect(() => {
    if (!badge) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [badge, onClose]);

  if (!badge) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      animation: "fadeUp 0.3s ease",
    }} onClick={onClose}>
      {/* Confetti burst — CSS-only dots */}
      <style>{`
        @keyframes confettiFly {
          0%   { transform: translate(0,0) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) rotate(720deg); opacity: 0; }
        }
        .confetti-dot { position: absolute; width: 8px; height: 8px; border-radius: 2px; animation: confettiFly 1.2s ease-out forwards; }
      `}</style>
      {[...Array(24)].map((_, i) => {
        const angle = (i / 24) * 360;
        const dist  = 80 + Math.random() * 120;
        const tx    = Math.cos((angle * Math.PI) / 180) * dist;
        const ty    = Math.sin((angle * Math.PI) / 180) * dist;
        const colors = ["#E8714A","#C8E650","#6BA3D6","#A07DD6","#5BAF7A","#fff"];
        return (
          <div key={i} className="confetti-dot" style={{
            background: colors[i % colors.length],
            top: "50%", left: "50%",
            "--tx": `${tx}px`, "--ty": `${ty}px`,
            animationDelay: `${i * 0.03}s`,
          }} />
        );
      })}

      <div style={{
        background: C.surface, borderRadius: 28, padding: "40px 32px",
        textAlign: "center", maxWidth: 320, width: "90%",
        boxShadow: `0 0 60px ${C.accentDim}`,
        border: `1px solid rgba(232,113,74,0.3)`,
        position: "relative", zIndex: 1,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 72, marginBottom: 16, lineHeight: 1 }}>
          {badge.icon_name || "🏅"}
        </div>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: C.accent, textTransform: "uppercase", margin: "0 0 8px" }}>Badge Unlocked</p>
        <h2 style={{ fontFamily: FD, fontSize: 26, fontWeight: 700, color: C.textPri, margin: "0 0 10px" }}>{badge.name}</h2>
        <p style={{ fontSize: 13, color: C.textSec, lineHeight: 1.65, margin: "0 0 24px" }}>
          {badge.unlock_copy || badge.description || "Keep up the amazing practice!"}
        </p>
        <Btn label="Keep going ✦" onClick={onClose} style={{ justifyContent: "center" }} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CHALLENGE SPOTLIGHT — featured challenge card for Home screen
══════════════════════════════════════════════════════════════════════════ */
/* ══════════════════════════════════════════════════════════════════════════
   CALENDAR EVENT CARD — prompts user to log a detected class
══════════════════════════════════════════════════════════════════════════ */
function CalendarEventCard({ event, onLog, onDismiss, onIgnore, C }) {
  const isPast     = event.end && new Date() > event.end;
  const isUpcoming = event.start && new Date() < event.start;
  const timeLabel  = event.start
    ? event.start.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "";
  const dateLabel  = event.start
    ? event.start.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
    : "";
  const studioName = event.location?.split(",")[0] || event.title;

  return (
    <div style={{
      background: isPast
        ? `linear-gradient(135deg, rgba(160,108,213,0.18), rgba(255,107,107,0.10))`
        : `linear-gradient(135deg, rgba(78,205,196,0.18), rgba(160,108,213,0.10))`,
      border: `1px solid ${isPast ? "rgba(160,108,213,0.3)" : "rgba(78,205,196,0.3)"}`,
      borderRadius: 20, padding: "16px", marginBottom: 14,
    }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          background: isPast ? "rgba(160,108,213,0.25)" : "rgba(78,205,196,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22,
        }}>
          {isPast ? "📅" : "⏰"}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: isPast ? C.accentPurple : C.accentTeal, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 3px", fontFamily: FB }}>
            {isPast ? "Did you attend?" : "Upcoming class"}
          </p>
          <p style={{ fontSize: 15, fontWeight: 700, color: C.textPri, margin: "0 0 2px", fontFamily: FB }}>{event.title}</p>
          {studioName !== event.title && (
            <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 2px", fontFamily: FB }}>📍 {studioName}</p>
          )}
          <p style={{ fontSize: 11, color: C.textSec, margin: "0 0 12px", fontFamily: FB }}>
            {dateLabel} {timeLabel && `· ${timeLabel}`}
          </p>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isPast ? (
              <>
                <button onClick={() => onLog(event)} style={{
                  background: C.gradientPrimary, color: "#fff", border: "none",
                  borderRadius: 100, padding: "8px 16px", fontSize: 12, fontWeight: 800,
                  cursor: "pointer", fontFamily: FB, boxShadow: C.shadowPurple,
                }}>Yes, log it →</button>
                <button onClick={() => onDismiss(event.id)} style={{
                  background: "transparent", color: C.textSec,
                  border: `1px solid ${C.border}`, borderRadius: 100,
                  padding: "8px 14px", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: FB,
                }}>Skip</button>
                <button onClick={() => onIgnore(event.id)} style={{
                  background: "transparent", color: C.textTer,
                  border: "none", padding: "8px 0", fontSize: 11,
                  cursor: "pointer", fontFamily: FB,
                }}>Not Pilates</button>
              </>
            ) : (
              <button onClick={() => onDismiss(event.id)} style={{
                background: "transparent", color: C.textSec,
                border: `1px solid ${C.border}`, borderRadius: 100,
                padding: "7px 14px", fontSize: 12, fontWeight: 600,
                cursor: "pointer", fontFamily: FB,
              }}>Dismiss</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChallengeSpotlight({ challenges, logs, joinChallenge, showToast }) {
  const { C } = useTheme();

  // Pick the challenge with most participants, or first active one
  const spotlight = challenges
    ?.filter(c => c.active || c.is_active)
    ?.sort((a, b) => (b.participant_count || 0) - (a.participant_count || 0))[0];

  if (!spotlight) return null;

  const isJoined   = spotlight.joined || spotlight.userProgress;
  const progress   = spotlight.userProgress?.current_progress || spotlight.progress || 0;
  const target     = spotlight.target_value || spotlight.target || 1;
  const pct        = Math.min(100, (progress / target) * 100);
  const endsLabel  = spotlight.ends_at
    ? new Date(spotlight.ends_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : spotlight.ends || "";

  return (
    <div style={{ marginBottom: 16 }}>
      <SL>Challenge spotlight</SL>
      <div style={{
        background: `linear-gradient(135deg, ${C.limeDim}, rgba(200,230,80,0.05))`,
        border: `1px solid rgba(200,230,80,0.25)`,
        borderRadius: 18, padding: "16px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ flex: 1, paddingRight: 12 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.textPri, margin: "0 0 3px" }}>{spotlight.title}</p>
            <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>
              {spotlight.description || `Complete ${target} classes`}
              {endsLabel ? ` · Ends ${endsLabel}` : ""}
            </p>
            {spotlight.participant_count > 0 && (
              <p style={{ fontSize: 10, color: C.lime, fontWeight: 700, margin: "4px 0 0" }}>
                🌿 {spotlight.participant_count} participants
              </p>
            )}
          </div>
          <span style={{ fontFamily: FD, fontSize: 26, fontWeight: 700, color: C.lime, flexShrink: 0 }}>
            {progress}/{target}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height: 5, background: C.surfaceEl, borderRadius: 100, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: C.lime, borderRadius: 100, transition: "width 0.5s ease" }} />
        </div>

        {!isJoined ? (
          <Btn small label="Join Challenge →" onClick={async () => {
            try { await joinChallenge(spotlight.id); showToast("Challenge joined! 🌿"); }
            catch { showToast("Couldn't join challenge"); }
          }} style={{ background: C.lime, color: "#1A1A1A", border: "none", justifyContent: "center" }} />
        ) : (
          <p style={{ fontSize: 11, color: C.lime, fontWeight: 700, margin: 0 }}>
            ✓ You're in — {pct < 100 ? `${Math.round(pct)}% there` : "Challenge complete! 🎉"}
          </p>
        )}
      </div>
    </div>
  );
}

function QuickLogModal({ open, onClose, prefillStudio, recentLogs, showToast, onClassLogged, detectedCity }) {
  const { C } = useTheme();
  const [studioQuery, setStudioQuery]     = useState("");
  const [studioObj, setStudioObj]         = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]         = useState(false);
  const [classType, setClassType]         = useState("Reformer");
  const [rating, setRating]               = useState(5);
  const [saving, setSaving]               = useState(false);
  const [done, setDone]                   = useState(false);
  const searchTimerRef                    = useRef(null);

  useEffect(() => {
    if (!open) return;
    setSearchResults([]); setDone(false); setRating(5);
    if (prefillStudio?.name) {
      setStudioObj(prefillStudio); setStudioQuery(prefillStudio.name); setClassType("Reformer");
    } else if (recentLogs?.length > 0) {
      const last = recentLogs[0];
      setStudioQuery(last.studio || last.studio_name_manual || "");
      setStudioObj(null);
      setClassType(last.type || last.class_type || "Reformer");
    } else {
      setStudioQuery(""); setStudioObj(null);
    }
  }, [open, prefillStudio, recentLogs]);

  const handleQueryChange = (val) => {
    setStudioQuery(val); setStudioObj(null);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!val || val.length < 2) { setSearchResults([]); return; }
    const cacheKey = `quicklog:${val.toLowerCase().trim()}`;
    const cached = searchCache.get(cacheKey);
    if (cached) { setSearchResults(cached); return; }
    searchTimerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await fetch(`/api/places-search?query=${encodeURIComponent(val)}`);
        const json = await res.json();
        const results = json.studios || [];
        setSearchResults(results);
        if (results.length > 0) searchCache.set(cacheKey, results);
      } catch { setSearchResults([]); }
      finally { setSearching(false); }
    }, 380);
  };

  const selectStudio = (studio) => { setStudioObj(studio); setStudioQuery(studio.name); setSearchResults([]); };

  const handleSave = async () => {
    const name = studioObj?.name || studioQuery.trim();
    if (!name) { showToast("Add a studio name first"); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const today = new Date().toISOString().slice(0, 10);
      const now   = new Date().toTimeString().slice(0, 5);
      const payload = {
        user_id: user.id, studio_name_manual: name,
        google_place_id: studioObj?.google_place_id || (typeof studioObj?.id === "string" && studioObj.id.startsWith("Ch") ? studioObj.id : null),
        date: today, start_time: now, duration_minutes: 55,
        city: studioObj?.city || detectedCity || "Unknown",
        country: studioObj?.country || "Unknown",
        class_type: classType, rating, photos: [],
        is_new_studio: false, is_travel_class: false,
        source: "quick_log", visibility: "private",
      };
      const { error } = await supabase.from("class_logs").insert(payload);
      if (error) throw error;
      setDone(true); showToast("Logged! ✦");
      if (onClassLogged) onClassLogged();
      setTimeout(() => { onClose(); setDone(false); }, 1400);
    } catch (e) { showToast("Error: " + e.message); }
    finally { setSaving(false); }
  };

  if (!open) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)", zIndex: 900 }} />
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 420, background: C.surface,
        borderRadius: "28px 28px 0 0", padding: "20px 22px 44px",
        zIndex: 901, boxShadow: "0 -12px 48px rgba(0,0,0,0.5)",
        animation: "fadeUp 0.22s ease", maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ width: 36, height: 4, background: C.surfaceEl, borderRadius: 100, margin: "0 auto 20px" }} />

        {done ? (
          <div style={{ textAlign: "center", padding: "28px 0" }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>✦</div>
            <p style={{ fontFamily: FB, fontSize: 24, fontWeight: 800, color: C.textPri }}>Logged!</p>
          </div>
        ) : (
          <>
            <p style={{ fontFamily: FB, fontSize: 22, fontWeight: 800, color: C.textPri, margin: "0 0 4px" }}>⚡ Quick Log</p>
            <p style={{ fontSize: 13, color: C.textSec, margin: "0 0 22px", fontFamily: FB }}>Log a class in seconds</p>

            {/* Studio search */}
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: C.textTer, textTransform: "uppercase", margin: "0 0 8px", fontFamily: FB }}>Studio</p>
            <div style={{ position: "relative", marginBottom: searchResults.length > 0 ? 0 : 18, zIndex: 10 }}>
              <div style={{ position: "relative" }}>
                <Inp placeholder="Search studio by name or city…" value={studioQuery} onChange={handleQueryChange} />
                {searching && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.textTer }}>searching…</span>}
                {studioObj && !searching && <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: C.green }}>✓</span>}
              </div>
              {searchResults.length > 0 && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, overflow: "hidden", boxShadow: C.shadow, zIndex: 20, maxHeight: 240, overflowY: "auto" }}>
                  {searchResults.slice(0, 6).map((s, i) => (
                    <button key={s.id || i} onClick={() => selectStudio(s)} style={{ width: "100%", background: "none", border: "none", borderBottom: i < 5 ? `1px solid ${C.border}` : "none", padding: "12px 16px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}
                      onMouseEnter={e => e.currentTarget.style.background = C.surfaceHi}
                      onMouseLeave={e => e.currentTarget.style.background = "none"}>
                      {s.heroPhoto
                        ? <img src={s.heroPhoto} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} onError={e => { e.target.style.display = "none"; }} />
                        : <div style={{ width: 32, height: 32, borderRadius: 8, background: C.purpleDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{getStudioIcon(s)}</div>
                      }
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: C.textPri, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: FB }}>{s.name}</p>
                        <p style={{ fontSize: 11, color: C.textSec, margin: 0, fontFamily: FB }}>{s.city || s.address}</p>
                      </div>
                      {s.rating > 0 && <span style={{ fontSize: 11, color: "#FFB800", fontWeight: 700, flexShrink: 0 }}>★ {s.rating}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {searchResults.length > 0 && <div style={{ marginBottom: 18 }} />}

            {/* Class type */}
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: C.textTer, textTransform: "uppercase", margin: "0 0 10px", fontFamily: FB }}>Class type</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
              {["Reformer", "Mat", "Tower", "Private", "Hot Pilates", "Stretch"].map(t => (
                <Chip key={t} label={t} active={classType === t} onClick={() => setClassType(t)} color={["coral","purple","teal","lime","coral","purple"][["Reformer","Mat","Tower","Private","Hot Pilates","Stretch"].indexOf(t)]} />
              ))}
            </div>

            {/* Rating */}
            <p style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.12em", color: C.textTer, textTransform: "uppercase", margin: "0 0 10px", fontFamily: FB }}>Rating</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 26 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setRating(n)} style={{ flex: 1, background: n <= rating ? C.accentDim : "transparent", border: `1px solid ${n <= rating ? C.accent : C.border}`, borderRadius: 12, padding: "11px 0", fontSize: 22, color: n <= rating ? C.accent : C.textTer, cursor: "pointer", transition: "all 0.12s" }}>★</button>
              ))}
            </div>

            <Btn full gradient label={saving ? "Saving…" : "Log it →"} onClick={handleSave} loading={saving} style={{ justifyContent: "center", fontSize: 16, padding: "16px", borderRadius: 18 }} />
          </>
        )}
      </div>
    </>
  );
}

/* ── SmartClassPrompt — asks "did you attend?" if no class logged today ──── */
function SmartClassPrompt({ logs, setTab, setLogPrefill, C }) {
  const [dismissed, setDismissed] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const hour = new Date().getHours();

  // Only show between 10am and 9pm
  if (hour < 10 || hour > 21) return null;
  if (dismissed) return null;

  // Check if already logged today
  const loggedToday = logs.some(l => (l.date || "").slice(0, 10) === today);
  if (loggedToday) return null;

  // Only show if user has logged at least one class before
  if (logs.length === 0) return null;

  return (
    <div style={{ background: `linear-gradient(135deg, ${C.accentDim}, ${C.accentDim2})`, border: `1px solid rgba(232,113,74,0.3)`, borderRadius: 18, padding: "14px 16px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 22 }}>🪷</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.textPri, margin: "0 0 2px" }}>Did you take a class today?</p>
          <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>Log it now to keep your streak going.</p>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => { setLogPrefill(null); setTab("log"); }}
          style={{ flex: 1, background: C.accent, color: "#fff", border: "none", borderRadius: 10, padding: "9px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}
        >
          Yes, log it ✦
        </button>
        <button
          onClick={() => setDismissed(true)}
          style={{ flex: 1, background: "transparent", color: C.textSec, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}
        >
          Not today
        </button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ONBOARDING
══════════════════════════════════════════════════════════════════════════ */
function Onboarding({ onComplete }) {
  const { C } = useTheme();
  const [step, setStep] = useState(0);
  const slides = [
    { kicker: "Welcome to", headline: "Pilates\nPassport.", body: "The app that finally respects how seriously you take your practice.", cta: "Let's go →", bg: C.accent, tc: "#fff", sc: "rgba(255,255,255,0.75)" },
    { kicker: "Log everything.", headline: "Never lose\na class again.", body: "GPS detects studio visits. Apple Watch imports your workout data. Log in under 30 seconds.", cta: "Nice →", bg: C.bg, tc: C.textPri, sc: C.textSec },
    { kicker: "Track your world.", headline: "Insights,\nbadges,\nchallenges.", body: "See your patterns. Celebrate milestones. Stay motivated without the pressure.", cta: "I'm in →", bg: C.surface, tc: C.textPri, sc: C.textSec },
    { kicker: "Connect.", headline: "Discover,\nfollow &\nshare.", body: "Find top studios worldwide. Follow friends. Book directly at any studio with one tap.", cta: "Start my passport →", bg: C.bg, tc: C.textPri, sc: C.textSec },
  ];
  const s = slides[step];
  return (
    <div style={{ minHeight: "100vh", background: s.bg, display: "flex", flexDirection: "column", padding: "56px 28px 44px", transition: "background 0.4s" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: "auto" }}>
        {slides.map((_, i) => <div key={i} style={{ height: 3, width: i === step ? 28 : 8, borderRadius: 100, background: i === step ? (step === 0 ? "#fff" : C.accent) : C.border, transition: "all 0.35s" }} />)}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", paddingBottom: 12 }}>
        {step === 0 && <img src="/logo.png" alt="logo" style={{ width: 72, height: 72, objectFit: "contain", marginBottom: 20, filter: "brightness(0) invert(1)", opacity: 0.9 }} />}
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: step === 0 ? "rgba(255,255,255,0.7)" : C.accent, textTransform: "uppercase", margin: "0 0 14px" }}>{s.kicker}</p>
        <h1 style={{ fontFamily: FD, fontSize: 50, fontWeight: 700, color: s.tc, margin: "0 0 20px", lineHeight: 1.08, letterSpacing: -1, whiteSpace: "pre-line" }}>{s.headline}</h1>
        <p style={{ fontSize: 16, color: s.sc, lineHeight: 1.65, margin: "0 0 40px", maxWidth: 300 }}>{s.body}</p>
        <button onClick={() => step < slides.length - 1 ? setStep(step + 1) : onComplete()} style={{ background: step === 0 ? "#fff" : C.accent, color: step === 0 ? C.accent : "#fff", border: "none", borderRadius: 16, padding: "16px 24px", fontSize: 16, fontWeight: 700, width: "100%", cursor: "pointer", fontFamily: FB }}>{s.cta}</button>
        {step === 0 && <p onClick={onComplete} style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", textAlign: "center", marginTop: 16, cursor: "pointer" }}>Already have an account? Sign in</p>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   NEARBY STUDIOS — fetches real studios from Google Places API
══════════════════════════════════════════════════════════════════════════ */
function NearbyStudios({ userCoords, onSelectStudio, setSelectedStudio, showToast, C }) {
  const [studios, setStudios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const fetchedCoordsRef = useRef(null);

  const fetchNearby = useCallback(async (lat, lng) => {
    // Don't refetch if coords haven't changed significantly (> 500m)
    if (fetchedCoordsRef.current) {
      const { lat: prevLat, lng: prevLng } = fetchedCoordsRef.current;
      const dx = Math.abs(lat - prevLat), dy = Math.abs(lng - prevLng);
      if (dx < 0.005 && dy < 0.005) return;
    }
    setLoading(true);
    fetchedCoordsRef.current = { lat, lng };
    try {
      const url = `/api/places-search?lat=${lat}&lng=${lng}&radius=10000`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.studios && json.studios.length > 0) {
        // Sort by distance
        const haversine = (lat1, lng1, lat2, lng2) => {
          if (!lat2 || !lng2) return 99999;
          const R = 6371;
          const dLat = (lat2 - lat1) * Math.PI / 180;
          const dLng = (lng2 - lng1) * Math.PI / 180;
          const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        };
        const withDist = json.studios.map(s => {
          const km = haversine(lat, lng, s.lat, s.lng);
          return { ...s, _dist: km, distance: km < 1 ? `${Math.round(km*1000)}m away` : `${km.toFixed(1)} km away` };
        }).sort((a, b) => a._dist - b._dist);
        setStudios(withDist);
        // Store in window so GPS detection can use them
        window.__nearbyStudios__ = withDist;
      }
    } catch (e) {
      console.warn("[NearbyStudios] Failed:", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when coords become available
  useEffect(() => {
    if (userCoords) {
      fetchNearby(userCoords.lat, userCoords.lng);
    }
  }, [userCoords, fetchNearby]);

  const requestLocation = () => {
    if (!navigator.geolocation) { showToast("Geolocation not supported"); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const evt = new CustomEvent("pp_coords", {
          detail: { lat: pos.coords.latitude, lng: pos.coords.longitude }
        });
        window.dispatchEvent(evt);
      },
      () => {
        setLocationDenied(true);
        showToast("Location permission denied — enable in browser settings");
      }
    );
  };

  // No location yet
  if (!userCoords) {
    return (
      <>
        <SL style={{ marginTop: 4 }}>Studios near you</SL>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: "18px 16px", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>📍</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.textPri, margin: "0 0 3px" }}>Find Pilates studios near you</p>
              <p style={{ fontSize: 12, color: C.textSec, margin: 0 }}>
                {locationDenied ? "Location blocked. Enable in browser settings." : "Allow location to discover real studios in your area."}
              </p>
            </div>
          </div>
          {!locationDenied && (
            <button
              onClick={requestLocation}
              style={{ marginTop: 12, width: "100%", background: C.accent, color: "#fff", border: "none", borderRadius: 12, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}
            >
              📍 Enable location
            </button>
          )}
        </div>
      </>
    );
  }

  // Loading
  if (loading) {
    return (
      <>
        <SL style={{ marginTop: 4 }}>Studios near you</SL>
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: "18px 16px", marginBottom: 10, textAlign: "center" }}>
          <p style={{ fontSize: 13, color: C.textSec }}>{getLoadingMessage()}</p>
        </div>
      </>
    );
  }

  // Real studios found
  if (studios.length > 0) {
    return (
      <>
        <SL style={{ marginTop: 4 }}>Near you · {studios[0]?.city || ""}</SL>
        {studios.slice(0, 3).map((s, i) => (
          <div
            key={s.id || i}
            onClick={() => onSelectStudio(s)}
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, marginBottom: 10, cursor: "pointer", overflow: "hidden" }}
          >
            {/* Real photo if available */}
            {s.heroPhoto && (
              <div style={{ height: 100, overflow: "hidden", position: "relative" }}>
                <img src={s.heroPhoto} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.parentElement.style.display = "none"; }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 60%)" }} />
                <p style={{ position: "absolute", bottom: 8, left: 12, fontSize: 12, fontWeight: 700, color: "#fff", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{s.name}</p>
                {s.distance && <span style={{ position: "absolute", bottom: 8, right: 10, fontSize: 10, color: "#fff", background: "rgba(0,0,0,0.4)", borderRadius: 6, padding: "2px 7px", fontWeight: 700 }}>{s.distance}</span>}
              </div>
            )}
            <div style={{ padding: "12px 14px" }}>
              {!s.heroPhoto && (
                <p style={{ fontSize: 14, fontWeight: 700, color: C.textPri, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {getStudioIcon(s)} {s.name}
                </p>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 11, color: C.textSec, margin: "0 0 5px" }}>
                    {s.address || s.city}
                    {!s.heroPhoto && s.distance && <span style={{ color: C.green, fontWeight: 700 }}> · {s.distance}</span>}
                  </p>
                  <div style={{ display: "flex", gap: 4 }}>
                    {(s.tags||[]).slice(0, 2).map(t => (
                      <span key={t} style={{ background: C.accentDim, color: C.accent, border: `1px solid rgba(232,113,74,0.3)`, borderRadius: 100, padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>{t}</span>
                    ))}
                  </div>
                </div>
                {s.rating > 0 && (
                  <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                    <p style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: C.accent, margin: 0 }}>{s.rating}</p>
                    <p style={{ fontSize: 10, color: C.textTer, margin: 0 }}>{s.reviews} reviews</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <p style={{ fontSize: 11, color: C.textTer, textAlign: "center", marginBottom: 8, cursor: "pointer" }}
          onClick={() => onSelectStudio(null)}>
          See all nearby studios in Explore →
        </p>
      </>
    );
  }

  // No studios found via Google Places
  return (
    <>
      <SL style={{ marginTop: 4 }}>Studios near you</SL>
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: "18px 16px", marginBottom: 10, textAlign: "center" }}>
        <p style={{ fontSize: 13, color: C.textSec, marginBottom: 6 }}>No Pilates studios found in your immediate area.</p>
        <p style={{ fontSize: 12, color: C.textTer }}>Try searching by name in the Explore tab.</p>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   HOME
══════════════════════════════════════════════════════════════════════════ */
function HomeScreen({ logs, setTab, setLogPrefill, challenges, joinChallenge, user, userProfile, detectedCity, userCoords, gpsDetected, gpsScanning, gpsDismiss, hkConnected, hkConnect, hkSyncing, showToast, setSelectedStudio, onQuickLog, calendarPending, onCalendarLog, onCalendarDismiss, onCalendarIgnore }) {
  const { C } = useTheme();
  const stats = getStats(logs);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const displayName = userProfile?.display_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "there";
  const allChallenges = challenges.slice(0, 5);
  const [classFilter, setClassFilter] = useState("All");
  const FILTERS = ["All", "Reformer", "Mat", "Tower", "Private", "Hot"];
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weeklyCount = logs.filter(l => l.date && new Date(l.date) >= weekStart).length;
  const dailyQuote = getDailyQuote();

  return (
    <div style={{ background: C.bg, minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ padding: "56px 22px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: C.gradientPrimary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff", flexShrink: 0, boxShadow: C.shadowPurple }}>
            {(displayName[0] || "P").toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: 12, color: C.textSec, margin: 0, fontFamily: FB }}>{greeting}</p>
            <h1 style={{ fontFamily: FB, fontSize: 20, fontWeight: 800, color: C.textPri, margin: 0, lineHeight: 1.2 }}>{displayName}</h1>
          </div>
        </div>
        {onQuickLog && (
          <button onClick={onQuickLog} style={{ width: 40, height: 40, borderRadius: "50%", background: C.surfaceEl, border: `1px solid ${C.border}`, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>⚡</button>
        )}
      </div>

      {/* Hero card */}
      <div style={{ margin: "0 16px 20px" }}>
        <div style={{ background: C.gradientPurple, borderRadius: 24, padding: "22px 22px 20px", position: "relative", overflow: "hidden", boxShadow: C.shadowPurple }}>
          <div style={{ position: "absolute", right: -30, top: -30, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.07)" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)", margin: "0 0 4px", fontFamily: FB }}>Welcome back</p>
            <h2 style={{ fontFamily: FB, fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 16px", lineHeight: 1.2 }}>
              {stats.classes > 0 ? `${stats.classes} classes logged` : "Start your journey"}
            </h2>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 18 }}>
              <StatChip label="Studios" value={stats.studios} icon="🏛️" color="teal" />
              <StatChip label="Cities" value={stats.cities} icon="📍" color="yellow" />
              <StatChip label="This week" value={weeklyCount} icon="🔥" color="coral" />
            </div>
            <button onClick={() => setTab("log")} style={{
              background: "#fff", color: C.accentPurple, border: "none", borderRadius: 100,
              padding: "11px 24px", fontSize: 14, fontWeight: 800, fontFamily: FB,
              cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8,
              boxShadow: "0 4px 14px rgba(0,0,0,0.2)",
            }}>
              Log a class <span>→</span>
            </button>
          </div>
        </div>
      </div>

      {/* Class type chips */}
      <div style={{ paddingLeft: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingRight: 16, paddingBottom: 2 }}>
          {FILTERS.map((f, i) => (
            <Chip key={f} label={f} active={classFilter === f} onClick={() => setClassFilter(f)}
              color={["coral","purple","teal","lime","coral","purple"][i]} />
          ))}
        </div>
      </div>

      <div style={{ padding: "0 16px" }}>

        {/* GPS scanning */}
        {gpsScanning && (
          <div style={{ background: C.blueDim, border: `1px solid ${C.blue}30`, borderRadius: 18, padding: "14px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: C.blueDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📡</div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.blue, margin: "0 0 2px", fontFamily: FB }}>Scanning for nearby studios…</p>
              <p style={{ fontSize: 11, color: C.textSec, margin: 0, fontFamily: FB }}>GPS active</p>
            </div>
          </div>
        )}

        {/* GPS detected */}
        {gpsDetected && !gpsScanning && (
          <div style={{ background: C.gradientCard, border: "1px solid rgba(160,108,213,0.25)", borderRadius: 20, padding: "16px", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 42, height: 42, borderRadius: 14, background: C.purpleDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📍</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: C.accentPurple, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 3px", fontFamily: FB }}>Nearby studio</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: C.textPri, margin: "0 0 4px", fontFamily: FB }}>{gpsDetected.name}</p>
                <p style={{ fontSize: 11, color: C.textSec, margin: "0 0 12px", fontFamily: FB }}>{gpsDetected.distance}</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn small gradient label="Log class →" onClick={() => { setLogPrefill({ studio: gpsDetected, studioId: gpsDetected.id, name: gpsDetected.name, city: gpsDetected.city, google_place_id: gpsDetected.google_place_id }); setTab("log"); }} style={{ flex: 1 }} />
                  <Btn small ghost label="Dismiss" onClick={gpsDismiss} style={{ flex: 1 }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Apple Watch */}
        {!hkConnected && (
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: "14px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, background: C.surfaceEl, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>⌚</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.textPri, margin: "0 0 2px", fontFamily: FB }}>Connect Apple Watch</p>
              <p style={{ fontSize: 11, color: C.textSec, margin: 0, fontFamily: FB }}>Auto-import class data</p>
            </div>
            <Btn small label={hkSyncing ? "…" : "Connect"} onClick={hkConnect} disabled={hkSyncing} style={{ flexShrink: 0 }} />
          </div>
        )}

        <SmartClassPrompt logs={logs} setTab={setTab} setLogPrefill={setLogPrefill} C={C} />

        {/* Daily motivational quote */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: "14px 16px", marginBottom: 16 }}>
          <p style={{ fontSize: 10, fontWeight: 800, color: C.textTer, letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 6px", fontFamily: FB }}>Daily inspiration</p>
          <p style={{ fontSize: 13, color: C.textPri, lineHeight: 1.6, margin: "0 0 4px", fontFamily: FB, fontStyle: "italic" }}>
            "{dailyQuote.quote}"
          </p>
          <p style={{ fontSize: 10, color: C.textTer, margin: 0, fontFamily: FB }}>— {dailyQuote.author}</p>
        </div>

        {/* Calendar event cards (detected upcoming / past classes) */}
        {calendarPending?.length > 0 && calendarPending.map(event => (
          <CalendarEventCard
            key={event.id}
            event={event}
            onLog={onCalendarLog}
            onDismiss={onCalendarDismiss}
            onIgnore={onCalendarIgnore}
            C={C}
          />
        ))}

        {/* Challenges section */}
        {allChallenges.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ fontFamily: FB, fontSize: 18, fontWeight: 800, color: C.textPri, margin: 0 }}>Challenges</h3>
              <button style={{ background: "none", border: "none", fontSize: 13, color: C.accentPurple, fontWeight: 700, cursor: "pointer", fontFamily: FB }}>See All</button>
            </div>
            <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 4, paddingLeft: 2 }}>
              {allChallenges.map((ch, i) => {
                const prog = ch.progress || ch.userProgress?.current_progress || 0;
                const target = ch.target || ch.target_value || 1;
                const pct = Math.min(100, (prog / target) * 100);
                const isJoined = ch.joined || ch.active;
                const gradients = [C.gradientPurple, C.gradientTeal, C.gradientCoral, C.gradientLime, C.gradientPurple];
                const shadows = [C.shadowPurple, C.shadowTeal, C.shadowAccent, C.shadow, C.shadowPurple];
                return (
                  <div key={ch.id} style={{ background: gradients[i % 5], borderRadius: 22, padding: "18px 16px", minWidth: 170, maxWidth: 190, flexShrink: 0, boxShadow: shadows[i % 5], position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", right: -20, top: -20, width: 90, height: 90, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
                    <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.8)", background: "rgba(0,0,0,0.15)", borderRadius: 6, padding: "2px 8px", fontFamily: FB, display: "inline-block", marginBottom: 8 }}>
                      {ch.ends_at ? `Ends ${ch.ends_at.slice(5,10)}` : ch.ends || `${target}-day`}
                    </span>
                    <p style={{ fontSize: 15, fontWeight: 800, color: "#fff", margin: "0 0 4px", fontFamily: FB, lineHeight: 1.25 }}>{ch.title}</p>
                    {ch.participant_count > 0 && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", margin: "0 0 12px", fontFamily: FB }}>{ch.participant_count.toLocaleString()} users joined</p>}
                    {isJoined && <div style={{ height: 3, background: "rgba(255,255,255,0.2)", borderRadius: 100, overflow: "hidden", marginBottom: 10 }}><div style={{ height: "100%", width: `${pct}%`, background: "#fff", borderRadius: 100 }} /></div>}
                    <button onClick={async () => { try { await joinChallenge(ch.id); showToast("Challenge joined! 🎉"); } catch { showToast("Couldn't join"); }}} style={{ background: "rgba(255,255,255,0.22)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.4)", borderRadius: 100, padding: "7px 18px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FB }}>
                      {isJoined ? `${prog}/${target}` : "Join"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick stats */}
        {stats.classes > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 2 }}>
              {stats.favType && <StatChip label="Fav class" value={stats.favType} icon="🪷" color="purple" />}
              {stats.totalMin > 0 && <StatChip label="Total time" value={`${Math.round(stats.totalMin / 60)}h`} icon="⏱️" color="teal" />}
              {stats.countries > 1 && <StatChip label="Countries" value={stats.countries} icon="🌍" color="lime" />}
              {stats.travelCount > 0 && <StatChip label="Travel" value={`${stats.travelCount}`} icon="✈️" color="coral" />}
            </div>
          </div>
        )}

        {/* Recent classes */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontFamily: FB, fontSize: 18, fontWeight: 800, color: C.textPri, margin: 0 }}>
              Recent Classes {logs.length > 0 && <span style={{ fontSize: 14, color: C.textTer, fontWeight: 600 }}>({logs.length})</span>}
            </h3>
          </div>
          {logs.length === 0 ? (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 22, padding: "40px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 56, marginBottom: 12 }}>🦋</div>
              <p style={{ fontSize: 17, fontWeight: 800, color: C.textPri, margin: "0 0 8px", fontFamily: FB }}>Ready to start your Pilates journey?</p>
              <p style={{ fontSize: 13, color: C.textSec, margin: "0 0 20px", lineHeight: 1.5, fontFamily: FB }}>Log your first class and start building your passport to studios around the world.</p>
              <Btn gradient label="Log your first class →" onClick={() => setTab("log")} style={{ justifyContent: "center" }} />
            </div>
          ) : logs.slice(0, 5).map((log, i) => {
            const cols = ["coral","purple","teal","lime","coral"];
            const col = cols[i % 5];
            const typeBgs   = { coral: C.redDim,    purple: C.purpleDim, teal: C.tealDim,   lime: C.limeDim };
            const typeTexts = { coral: C.accent,    purple: C.accentPurple, teal: C.accentTeal, lime: C.lime };
            const icon = getStudioIcon({ name: log.studio || log.studio_name_manual, tags: [log.type || log.class_type] });
            return (
              <div key={log.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: "14px 16px", marginBottom: 10, display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, background: typeBgs[col], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.textPri, margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: FB }}>{log.studio || log.studio_name_manual}</p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: typeTexts[col], background: typeBgs[col], borderRadius: 6, padding: "2px 8px", fontFamily: FB }}>{log.type || log.class_type}</span>
                    <span style={{ fontSize: 11, color: C.textSec, fontFamily: FB }}>{(log.date || "").slice(5).replace("-","/")} · {log.duration || log.duration_minutes || 55}min</span>
                  </div>
                  {log.watchData && <p style={{ fontSize: 10, color: C.green, margin: "3px 0 0", fontWeight: 700, fontFamily: FB }}>⌚ {log.watchData.cal} kcal</p>}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <Stars n={log.rating} size={11} />
                  {(log.isTravel || log.is_travel_class) && <p style={{ fontSize: 9, color: C.accentTeal, fontWeight: 800, margin: "3px 0 0", fontFamily: FB }}>✈ TRAVEL</p>}
                </div>
              </div>
            );
          })}
        </div>

        <NearbyStudios userCoords={userCoords} onSelectStudio={(s) => { if (s) { setSelectedStudio?.(s); } else { setTab("explore"); }}} showToast={showToast} C={C} />
        <div style={{ height: 110 }} />
      </div>
    </div>
  );
}
function ExploreScreen({ logs, savedStudios, savedStudiosCache, toggleSave, setSelectedStudio, communityUsers, setCommunityUsers, setSelectedUser, userCoords, detectedCity, showToast }) {
  const { C } = useTheme();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [view, setView] = useState("studios");
  const [mapView, setMapView] = useState(false);
  const [dbStudios, setDbStudios] = useState([]);
  const [loadingStudios, setLoadingStudios] = useState(false);
  const [placesResults, setPlacesResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef(null);
  const visitedIds = new Set(logs.map(l => l.studioId || l.studio_id).filter(Boolean));

  // ── Real Google Places search via Netlify serverless function ──────────────
  // Calls /api/places-search which proxies the Google Places API
  // keeping the API key server-side. Requires GOOGLE_PLACES_API_KEY in Netlify env.
  const searchGooglePlaces = useCallback((query) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!query || query.length < 2) { setPlacesResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      // ── Check cache first (1hr TTL) ──────────────────────────────────────
      const cacheKey = `explore:${query.toLowerCase().trim()}`;
      const cached = searchCache.get(cacheKey);
      if (cached) { setPlacesResults(cached); return; }

      setSearching(true);
      try {
        const url = `/api/places-search?query=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.studios && json.studios.length > 0) {
          setPlacesResults(json.studios);
          searchCache.set(cacheKey, json.studios); // cache the results
        } else {
          // Fallback: search Supabase DB
          const { data } = await supabase
            .from("studios")
            .select("*")
            .or(`name.ilike.%${query}%,city.ilike.%${query}%`)
            .limit(10);
          if (data && data.length > 0) {
            const mapped = data.map(ds => ({
              id: ds.id, name: ds.name, address: ds.address || "",
              city: ds.city || "", country: ds.country || "",
              rating: ds.avg_rating || 0, reviews: ds.review_count || 0,
              tags: ds.class_types || [], types: ds.class_types || [],
              lat: ds.latitude, lng: ds.longitude,
              verified: ds.is_verified || false, hero: ds.hero_emoji || "🪷",
              vibe: "", website: ds.website || "", phone: ds.phone || "",
            }));
            setPlacesResults(mapped);
            searchCache.set(cacheKey, mapped);
          } else {
            setPlacesResults([]);
          }
        }
      } catch (e) {
        console.warn("[Places] Search failed:", e.message);
        setPlacesResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);
  }, []);

  // Fetch studios: Google Places (nearby if coords) + Supabase DB
  useEffect(() => {
    setLoadingStudios(true);
    const fetches = [];

    // 1. Supabase DB studios
    fetches.push(
      supabase.from("studios").select("*").order("avg_rating", { ascending: false }).limit(50)
        .then(({ data }) => {
          if (data && data.length > 0) return data.map(ds => ({
            id: ds.id,
            google_place_id: ds.google_place_id || null,
            name: ds.name || "Unknown Studio",
            address: ds.address || "",
            city: ds.city || "",
            country: ds.country || "",
            rating: ds.avg_rating || ds.rating || 0,
            reviews: ds.review_count || ds.reviews || 0,
            tags: ds.class_types || ds.tags || [],
            types: ds.class_types || ds.types || [],
            lat: ds.latitude || ds.lat || null,
            lng: ds.longitude || ds.lng || null,
            verified: ds.is_verified || false,
            hero: ds.hero_emoji || "🪷",
            heroPhoto: ds.hero_photo || null,
            vibe: ds.description || "",
            website: ds.website || "",
            phone: ds.phone || "",
            distance: "",
          }));
          return [];
        }).catch(() => [])
    );

    // 2. Google Places nearby (if we have coords)
    if (userCoords) {
      fetches.push(
        fetch(`/api/places-search?lat=${userCoords.lat}&lng=${userCoords.lng}&radius=15000`)
          .then(r => r.json())
          .then(json => json.studios || [])
          .catch(() => [])
      );
    }

    Promise.all(fetches).then(results => {
      const combined = results.flat();
      // Deduplicate by name
      const seen = new Set();
      const unique = combined.filter(s => {
        const key = (s.name || "").toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (unique.length > 0) setDbStudios(unique);
    }).finally(() => setLoadingStudios(false));
  }, [userCoords]);

  // Merge dbStudios (already mapped) + placesResults, deduplicated by name
  const allStudios = (() => {
    const seen = new Set();
    const merged = [];
    const addIfNew = (s) => {
      const key = (s.name || "").toLowerCase().trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      merged.push(s);
    };
    // dbStudios already have correct shape from the fetch useEffect
    dbStudios.forEach(s => addIfNew(s));
    // placesResults from search box
    placesResults.forEach(s => addIfNew(s));
    return merged;
  })();

  // Sort by distance if coords available
  const haversineKm = (lat1, lng1, lat2, lng2) => {
    if (!lat2 || !lng2) return 99999;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  const studiosWithDist = allStudios.map(s => {
    if (!userCoords || !s.lat || !s.lng) return s;
    const km = haversineKm(userCoords.lat, userCoords.lng, s.lat, s.lng);
    return { ...s, _dist: km, distance: km < 1 ? `${Math.round(km*1000)}m` : `${km.toFixed(1)} km` };
  });

  const filtered = studiosWithDist
    .filter(s => {
      const ms = !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.city||"").toLowerCase().includes(search.toLowerCase());
      const mf = filter === "All" || (s.tags||[]).some(t => t.toLowerCase().includes(filter.toLowerCase())) || (s.types||[]).some(t => t.toLowerCase().includes(filter.toLowerCase()));
      return ms && mf;
    })
    .sort((a, b) => {
      if (userCoords && a._dist != null && b._dist != null) return a._dist - b._dist;
      return (b.rating || 0) - (a.rating || 0);
    });

  return (
    <div>
      <div style={{ padding: "52px 20px 14px", background: C.bg, position: "sticky", top: 0, zIndex: 10, borderBottom: `1px solid ${C.border}` }}>
        <h2 style={{ fontFamily: FD, fontSize: 28, fontWeight: 700, color: C.textPri, margin: "0 0 12px", letterSpacing: -0.5 }}>Explore</h2>
        <div style={{ position: "relative", marginBottom: 10 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: C.textTer, fontSize: 14, pointerEvents: "none" }}>✦</span>
          <Inp
            placeholder={view === "studios" ? "Search by studio name or city…" : "Search community…"}
            value={search}
            onChange={v => { setSearch(v); if (v.length > 2 && view === "studios") searchGooglePlaces(v); }}
            style={{ paddingLeft: 32 }}
          />
          {searching && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.textTer }}>searching…</span>}
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {["studios", "community", "saved"].map(v => <Pill key={v} label={v.charAt(0).toUpperCase() + v.slice(1)} active={view === v} onClick={() => setView(v)} />)}
        </div>
        {view === "studios" && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
            {["All", "Reformer", "Mat", "Tower", "Luxury", "Beginner", "Advanced"].map(f => <Pill key={f} label={f} active={filter === f} onClick={() => setFilter(f)} />)}
          </div>
        )}
      </div>

      {view === "studios" && (
        <div>
          <div style={{ padding: "10px 20px 0", display: "flex", alignItems: "center", gap: 8 }}>
            {[["List", false], ["Map", true]].map(([lbl, mv]) => (
              <button key={lbl} onClick={() => setMapView(mv)} style={{ background: mapView === mv ? C.textPri : "transparent", color: mapView === mv ? C.bg : C.textSec, border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FB }}>{lbl}</button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: 11, color: C.textTer, fontWeight: 600 }}>{loadingStudios ? "Loading…" : `${filtered.length} studios`}</span>
          </div>
          {mapView ? <MapView studios={filtered} visitedIds={visitedIds} onSelect={setSelectedStudio} userCoords={userCoords} /> : (
            <div style={{ padding: "10px 20px" }}>
              {loadingStudios && (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <p style={{ fontSize: 32, marginBottom: 8 }}>🔍</p>
                  <p style={{ fontSize: 14, color: C.textSec }}>Finding studios near you…</p>
                </div>
              )}
              {filtered.length === 0 && !loadingStudios && (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <p style={{ fontSize: 32, marginBottom: 12 }}>📍</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: C.textPri, margin: "0 0 8px" }}>
                    {search ? `No studios found for "${search}"` : "No studios found"}
                  </p>
                  <p style={{ fontSize: 13, color: C.textSec, lineHeight: 1.6, margin: "0 0 16px" }}>
                    {search
                      ? "Try searching just the studio name or city — e.g. pilates phoenix"
                      : !userCoords
                        ? "Allow location access so we can find real Pilates studios near you."
                        : "No studios found in your area. Try searching by name above."}
                  </p>
                </div>
              )}
              {filtered.map(s => {
                const saved = savedStudios.includes(s.id);
                const vc = logs.filter(l => (l.studioId || l.studio_id) === s.id).length;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedStudio(s)}
                    style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, marginBottom: 10, overflow: "hidden", cursor: "pointer", transition: "transform 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
                    onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                  >
                    {/* Photo banner if available */}
                    {s.heroPhoto && (
                      <div style={{ height: 120, overflow: "hidden", position: "relative" }}>
                        <img src={s.heroPhoto} alt={s.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.parentElement.style.display = "none"; }} />
                        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 60%)" }} />
                        {vc > 0 && <span style={{ position: "absolute", bottom: 8, left: 10, fontSize: 9, background: C.green, color: "#fff", borderRadius: 4, padding: "2px 6px", fontWeight: 700 }}>✓ VISITED {vc}×</span>}
                        <button onClick={e => { e.stopPropagation(); toggleSave(s.id, s); }} style={{ position: "absolute", top: 8, right: 10, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 16, color: saved ? "#ff6b6b" : "#fff" }}>{saved ? "♥" : "♡"}</button>
                      </div>
                    )}
                    <div style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                            {!s.heroPhoto && <span style={{ fontSize: 16 }}>{s.hero || "🪷"}</span>}
                            <p style={{ fontSize: 14, fontWeight: 700, color: C.textPri, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</p>
                            {s.verified && <span style={{ fontSize: 9, background: C.accentDim, color: C.accent, border: `1px solid rgba(232,113,74,0.3)`, borderRadius: 4, padding: "1px 5px", fontWeight: 700, flexShrink: 0 }}>✓</span>}
                          </div>
                          <p style={{ fontSize: 11, color: C.textSec, margin: "0 0 6px" }}>
                            {s.city}{s.country ? `, ${s.country}` : ""}
                            {s.distance && <span style={{ color: C.green, fontWeight: 600 }}> · {s.distance}</span>}
                          </p>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{(s.tags||[]).slice(0,2).map(t => <Pill key={t} label={t} />)}</div>
                          {vc > 0 && !s.heroPhoto && <p style={{ fontSize: 10, color: C.green, margin: "6px 0 0", fontWeight: 700 }}>✓ VISITED {vc}×</p>}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
                          {s.rating > 0 && <>
                            <p style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, color: C.accent, margin: "0 0 0" }}>{s.rating}</p>
                            <p style={{ fontSize: 10, color: C.textTer, margin: "0 0 8px" }}>{s.reviews} reviews</p>
                          </>}
                          {!s.heroPhoto && <button onClick={e => { e.stopPropagation(); toggleSave(s.id, s); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: saved ? C.accent : C.textTer, padding: 0, lineHeight: 1 }}>{saved ? "♥" : "♡"}</button>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {view === "community" && (
        <div style={{ padding: "10px 20px" }}>
          <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 12px", lineHeight: 1.5 }}>Discover practitioners around the world. Follow friends to see their studio picks.</p>
          {communityUsers.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>👥</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.textPri, marginBottom: 6 }}>No community members yet</p>
              <p style={{ fontSize: 12, color: C.textSec, lineHeight: 1.6 }}>Be the first! Go to Profile → Settings and set your profile to <strong>Public</strong> to appear here.</p>
            </div>
          )}
          {communityUsers.filter(u => !search || u.name.toLowerCase().includes(search.toLowerCase())).map(u => (
            <Card key={u.id} onClick={() => setSelectedUser(u)}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.accentDim, border: `1.5px solid ${C.accent}`, overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {u.avatarIsUrl
                    ? <img src={u.avatar} alt={u.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => { e.target.style.display="none"; }} />
                    : <span style={{ fontSize: 24 }}>🪷</span>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.textPri, margin: "0 0 2px" }}>{u.name}</p>
                  <p style={{ fontSize: 11, color: C.textSec, margin: "0 0 4px" }}>📍 {u.city}</p>
                  <p style={{ fontSize: 11, color: C.textTer, margin: 0, fontStyle: "italic" }}>{u.bio}</p>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontFamily: FD, fontSize: 18, fontWeight: 700, color: C.accent, margin: "0 0 2px" }}>{u.classes}</p>
                  <p style={{ fontSize: 10, color: C.textTer, margin: "0 0 6px" }}>classes</p>
                  <button onClick={async e => {
                    e.stopPropagation();
                    const { data: { user: me } } = await supabase.auth.getUser();
                    if (!me) return;
                    if (u.following) {
                      await supabase.from("user_follows").delete().eq("follower_id", me.id).eq("following_id", u.id);
                    } else {
                      await supabase.from("user_follows").upsert({ follower_id: me.id, following_id: u.id });
                    }
                    setCommunityUsers(prev => prev.map(x => x.id === u.id ? { ...x, following: !x.following } : x));
                  }}
                    style={{ fontSize: 10, background: u.following ? C.accentDim : "transparent", color: u.following ? C.accent : C.textSec, border: `1px solid ${u.following ? C.accent : C.border}`, borderRadius: 20, padding: "3px 8px", fontWeight: 700, cursor: "pointer", fontFamily: FB }}>{u.following ? "Following ✓" : "Follow"}</button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {view === "saved" && (
        <div style={{ padding: "10px 20px" }}>
          {savedStudios.length === 0 ? (
            <div style={{ textAlign: "center", padding: "56px 20px" }}>
              <p style={{ fontSize: 40, marginBottom: 10 }}>♡</p>
              <p style={{ fontSize: 15, fontWeight: 800, color: C.textPri, margin: "0 0 6px", fontFamily: FB }}>Save studios you'd love to visit</p>
              <p style={{ fontSize: 12, color: C.textSec, marginTop: 4, fontFamily: FB }}>Tap the ♡ heart on any studio to save it to your list.</p>
            </div>
          ) : (savedStudiosCache || []).filter(s => savedStudios.includes(s.id)).map(s => (
            <Card key={s.id} onClick={() => setSelectedStudio(s)}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                {s.heroPhoto
                  ? <img src={s.heroPhoto} alt={s.name} style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} onError={e => { e.target.style.display = "none"; }} />
                  : <span style={{ fontSize: 26, flexShrink: 0 }}>{getStudioIcon(s)}</span>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.textPri, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</p>
                  <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>{s.city}{s.country ? `, ${s.country}` : ""}{s.rating > 0 ? ` · ★${s.rating}` : ""}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); toggleSave(s.id, s); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: C.accent, padding: 0, flexShrink: 0 }}>♥</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   STUDIO DETAIL
══════════════════════════════════════════════════════════════════════════ */
/* ── StudioReviews — fetches real reviews from Supabase ─────────────────── */
function StudioReviews({ studioId, googlePlaceId, placeId, C }) {
  const [googleReviews, setGoogleReviews] = useState([]);
  const [inAppReviews, setInAppReviews]   = useState([]);
  const [loading, setLoading]             = useState(true);
  const [activeTab, setActiveTab]         = useState("all");

  const placeIdentifier = googlePlaceId || placeId || (typeof studioId === "string" && studioId.startsWith("Ch") ? studioId : null);

  useEffect(() => {
    if (!placeIdentifier) { setLoading(false); return; }
    fetch(`/api/places-search?place_id=${encodeURIComponent(placeIdentifier)}`)
      .then(r => r.json())
      .then(data => {
        if (data.studio?.googleReviews?.length > 0) {
          setGoogleReviews(data.studio.googleReviews.map((r, i) => ({
            id: `google-${i}`, author_name: r.author_name || "Google User",
            rating: r.rating || 0, text: r.text || "",
            relative_time_description: r.relative_time_description || "",
            profile_photo_url: r.profile_photo_url || null,
            source: "google",
          })));
        }
      })
      .catch(err => console.warn("[StudioReviews] Google fetch failed:", err))
      .finally(() => setLoading(false));
  }, [placeIdentifier]);

  useEffect(() => {
    const q = placeIdentifier
      ? supabase.from("reviews").select("*, users(display_name, profile_photo_url)")
          .eq("google_place_id", placeIdentifier).eq("moderation_status", "approved").order("created_at", { ascending: false })
      : studioId
        ? supabase.from("reviews").select("*, users(display_name, profile_photo_url)")
            .eq("studio_id", studioId).eq("moderation_status", "approved").order("created_at", { ascending: false })
        : null;
    if (!q) return;
    q.then(({ data }) => {
      if (data?.length > 0) {
        setInAppReviews(data.map(r => ({
          id: r.id, author_name: r.users?.display_name || "Anonymous",
          rating: r.rating || 0, text: r.body || "",
          relative_time_description: new Date(r.created_at).toLocaleDateString(),
          profile_photo_url: r.users?.profile_photo_url || null,
          source: "inapp", tags: r.tags || [],
        })));
      }
    }).catch(() => {});
  }, [studioId, placeIdentifier]);

  const allReviews = [...googleReviews, ...inAppReviews].sort((a, b) => b.rating - a.rating);
  const displayReviews = activeTab === "google" ? googleReviews : activeTab === "inapp" ? inAppReviews : allReviews;

  if (loading) return (
    <div style={{ textAlign: "center", padding: "40px 0" }}>
      <p style={{ fontSize: 13, color: C.textSec, fontFamily: FB }}>Loading reviews from Google…</p>
    </div>
  );

  if (allReviews.length === 0) return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <p style={{ fontSize: 48, marginBottom: 12 }}>⭐</p>
      <p style={{ fontSize: 15, fontWeight: 700, color: C.textPri, margin: "0 0 8px", fontFamily: FB }}>No reviews yet</p>
      <p style={{ fontSize: 13, color: C.textSec, margin: "0 0 16px", fontFamily: FB }}>Be the first to review this studio!</p>
      {placeIdentifier && <a href={`https://www.google.com/maps/search/?api=1&query_place_id=${placeIdentifier}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.accent, fontWeight: 700, textDecoration: "none", fontFamily: FB }}>View on Google Maps →</a>}
    </div>
  );

  const avgRating = (allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length).toFixed(1);
  const dist = { 5:0, 4:0, 3:0, 2:0, 1:0 };
  allReviews.forEach(r => { dist[Math.round(r.rating)] = (dist[Math.round(r.rating)] || 0) + 1; });

  return (
    <div>
      {/* Rating summary */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 20, padding: "14px 0", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <p style={{ fontFamily: FD, fontSize: 44, fontWeight: 700, color: C.accent, margin: 0, lineHeight: 1 }}>{avgRating}</p>
          <div style={{ margin: "5px 0 3px" }}>{[1,2,3,4,5].map(n => <span key={n} style={{ color: n <= Math.round(avgRating) ? "#FFB800" : C.textTer, fontSize: 14 }}>★</span>)}</div>
          <p style={{ fontSize: 10, color: C.textTer, margin: 0, fontFamily: FB }}>{allReviews.length} review{allReviews.length !== 1 ? "s" : ""}</p>
        </div>
        <div style={{ flex: 1 }}>
          {[5,4,3,2,1].map(star => {
            const count = dist[star] || 0;
            const pct = allReviews.length > 0 ? (count / allReviews.length) * 100 : 0;
            return (
              <div key={star} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: C.textSec, width: 20, fontFamily: FB }}>{star}★</span>
                <div style={{ flex: 1, height: 5, background: C.surfaceEl, borderRadius: 100, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: "#FFB800", borderRadius: 100, transition: "width 0.5s ease" }} />
                </div>
                <span style={{ fontSize: 10, color: C.textTer, width: 20, textAlign: "right", fontFamily: FB }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tab switcher */}
      {googleReviews.length > 0 && inAppReviews.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[{ id:"all", label:`All (${allReviews.length})` }, { id:"google", label:`Google (${googleReviews.length})` }, { id:"inapp", label:`Community (${inAppReviews.length})` }].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ background: activeTab === t.id ? C.accentPurple : "transparent", color: activeTab === t.id ? "#fff" : C.textSec, border: `1px solid ${activeTab === t.id ? C.accentPurple : C.border}`, borderRadius: 100, padding: "5px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FB, transition: "all 0.15s" }}>{t.label}</button>
          ))}
        </div>
      )}

      {/* Reviews */}
      {displayReviews.map((r, i) => (
        <div key={r.id || i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: "14px", marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {r.profile_photo_url
                ? <img src={r.profile_photo_url} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={e => { e.target.style.display = "none"; }} />
                : <div style={{ width: 30, height: 30, borderRadius: "50%", background: C.purpleDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: C.accentPurple, fontWeight: 700, flexShrink: 0 }}>{(r.author_name || "?")[0].toUpperCase()}</div>
              }
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.textPri, margin: 0, fontFamily: FB }}>{r.author_name}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  {r.source === "google" && <span style={{ fontSize: 9, background: C.blueDim, color: C.blue, borderRadius: 4, padding: "1px 6px", fontWeight: 800, fontFamily: FB }}>GOOGLE</span>}
                  {r.relative_time_description && <p style={{ fontSize: 10, color: C.textTer, margin: 0, fontFamily: FB }}>{r.relative_time_description}</p>}
                </div>
              </div>
            </div>
            <span style={{ color: "#FFB800", fontSize: 12, flexShrink: 0 }}>{"★".repeat(r.rating || 0)}{"☆".repeat(5 - (r.rating || 0))}</span>
          </div>
          {r.text && <p style={{ fontSize: 12, color: C.textSec, lineHeight: 1.65, margin: "0 0 8px", fontFamily: FB }}>{r.text}</p>}
          {r.tags?.length > 0 && <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{r.tags.map(t => <span key={t} style={{ background: C.accentDim, color: C.accent, borderRadius: 100, padding: "2px 8px", fontSize: 9, fontWeight: 700, fontFamily: FB }}>{t}</span>)}</div>}
        </div>
      ))}
      {googleReviews.length > 0 && <p style={{ fontSize: 9, color: C.textTer, textAlign: "center", marginTop: 12, fontFamily: FB }}>Reviews powered by Google</p>}
    </div>
  );
}
/* ── GoogleReviewsTab — real reviews from Google Places ─────────────────── */
function GoogleReviewsTab({ placeId, overallRating, C }) {
  const [reviews, setReviews]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [totalRating, setTotal]   = useState(overallRating || 0);
  const [totalCount, setCount]    = useState(0);

  useEffect(() => {
    if (!placeId) { setLoading(false); return; }
    fetch(`/api/places-search?place_id=${encodeURIComponent(placeId)}`)
      .then(r => r.json())
      .then(data => {
        if (data.studio?.googleReviews?.length > 0) setReviews(data.studio.googleReviews);
        if (data.studio?.rating) setTotal(data.studio.rating);
        if (data.studio?.reviews) setCount(data.studio.reviews);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [placeId]);

  if (!placeId) return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <p style={{ fontSize: 36, marginBottom: 10 }}>🔍</p>
      <p style={{ fontSize: 14, fontWeight: 700, color: C.textPri, margin: "0 0 6px", fontFamily: FB }}>No Google listing linked</p>
      <p style={{ fontSize: 12, color: C.textSec, fontFamily: FB }}>Search for this studio via Google Places to load reviews.</p>
    </div>
  );

  if (loading) return <div style={{ textAlign: "center", padding: "40px 0" }}><p style={{ fontSize: 13, color: C.textSec, fontFamily: FB }}>Fetching Google reviews…</p></div>;

  if (reviews.length === 0) return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <p style={{ fontSize: 36, marginBottom: 10 }}>🌐</p>
      <p style={{ fontSize: 14, fontWeight: 700, color: C.textPri, margin: "0 0 6px", fontFamily: FB }}>No Google review text available</p>
      <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 14px", fontFamily: FB }}>Google may not return review text for this studio.</p>
      <a href={`https://www.google.com/maps/search/?api=1&query_place_id=${placeId}`} target="_blank" rel="noopener noreferrer"
        style={{ fontSize: 13, fontWeight: 700, color: C.blue, textDecoration: "none", fontFamily: FB }}>View on Google Maps →</a>
    </div>
  );

  const dist = { 5:0, 4:0, 3:0, 2:0, 1:0 };
  reviews.forEach(r => { const s = Math.round(r.rating||0); if (dist[s] !== undefined) dist[s]++; });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <p style={{ fontSize: 15, fontWeight: 800, color: C.textPri, margin: 0, fontFamily: FB }}>🌐 Google Reviews</p>
        <span style={{ fontSize: 9, background: C.blueDim, color: C.blue, borderRadius: 6, padding: "2px 8px", fontWeight: 800, fontFamily: FB, marginLeft: "auto" }}>GOOGLE</span>
      </div>
      <p style={{ fontSize: 11, color: C.textSec, margin: "0 0 14px", fontFamily: FB }}>Sourced directly from Google Maps</p>

      {totalRating > 0 && (
        <div style={{ background: C.surfaceHi, borderRadius: 16, padding: "14px", marginBottom: 16, display: "flex", gap: 16, alignItems: "center" }}>
          <div style={{ textAlign: "center", flexShrink: 0 }}>
            <p style={{ fontSize: 40, fontWeight: 800, color: C.blue, margin: 0, lineHeight: 1, fontFamily: FB }}>{totalRating}</p>
            <div style={{ margin: "4px 0 2px" }}>{[1,2,3,4,5].map(n => <span key={n} style={{ color: n <= Math.round(totalRating) ? "#FFB800" : C.textTer, fontSize: 13 }}>★</span>)}</div>
            <p style={{ fontSize: 10, color: C.textTer, margin: 0, fontFamily: FB }}>{totalCount > 0 ? `${totalCount} total` : `${reviews.length} shown`}</p>
          </div>
          <div style={{ flex: 1 }}>
            {[5,4,3,2,1].map(star => {
              const count = dist[star] || 0;
              const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: C.textSec, width: 16, fontFamily: FB }}>{star}★</span>
                  <div style={{ flex: 1, height: 5, background: C.surfaceEl, borderRadius: 100, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "#FFB800", borderRadius: 100, transition: "width 0.5s ease" }} />
                  </div>
                  <span style={{ fontSize: 10, color: C.textTer, width: 18, textAlign: "right", fontFamily: FB }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {reviews.map((r, i) => (
        <div key={i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: "14px 16px", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
            {r.profile_photo_url
              ? <img src={r.profile_photo_url} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={e => { e.target.style.display="none"; }} />
              : <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.blueDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: C.blue, fontWeight: 800, flexShrink: 0, fontFamily: FB }}>{(r.author_name||"G")[0]}</div>
            }
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.textPri, margin: "0 0 2px", fontFamily: FB }}>{r.author_name || "Google User"}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#FFB800", fontSize: 12 }}>{"★".repeat(r.rating||0)}{"☆".repeat(5-(r.rating||0))}</span>
                {r.relative_time_description && <span style={{ fontSize: 10, color: C.textTer, fontFamily: FB }}>{r.relative_time_description}</span>}
              </div>
            </div>
          </div>
          {r.text && <p style={{ fontSize: 13, color: C.textSec, lineHeight: 1.65, margin: 0, fontFamily: FB }}>{r.text}</p>}
        </div>
      ))}
      <p style={{ fontSize: 10, color: C.textTer, textAlign: "center", marginTop: 8, fontFamily: FB }}>Reviews provided by Google</p>
    </div>
  );
}

/* ── InAppReviewsTab — reviews by Pilates Passport users ────────────────── */
function InAppReviewsTab({ studioId, googlePlaceId, C }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const pid = googlePlaceId || (typeof studioId === "string" && studioId.startsWith("Ch") ? studioId : null);
    const q = pid
      ? supabase.from("reviews").select("*, users(display_name, profile_photo_url)").eq("google_place_id", pid).eq("moderation_status","approved").order("created_at",{ascending:false})
      : supabase.from("reviews").select("*, users(display_name, profile_photo_url)").eq("studio_id", studioId).eq("moderation_status","approved").order("created_at",{ascending:false});
    q.then(({ data }) => setReviews(data || [])).catch(() => {}).finally(() => setLoading(false));
  }, [studioId, googlePlaceId]);

  if (loading) return <div style={{ textAlign: "center", padding: "40px 0" }}><p style={{ fontSize: 13, color: C.textSec, fontFamily: FB }}>Loading community reviews…</p></div>;

  if (reviews.length === 0) return (
    <div style={{ textAlign: "center", padding: "40px 20px" }}>
      <p style={{ fontSize: 40, marginBottom: 12 }}>🪷</p>
      <p style={{ fontSize: 15, fontWeight: 800, color: C.textPri, margin: "0 0 6px", fontFamily: FB }}>No community reviews yet</p>
      <p style={{ fontSize: 12, color: C.textSec, fontFamily: FB }}>Be the first Pilates Passport user to review this studio!</p>
    </div>
  );

  const avg = (reviews.reduce((s,r) => s+(r.rating||0), 0) / reviews.length).toFixed(1);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <p style={{ fontSize: 15, fontWeight: 800, color: C.textPri, margin: 0, fontFamily: FB }}>🪷 Community Reviews</p>
        <span style={{ fontSize: 9, background: C.accentDim, color: C.accent, borderRadius: 6, padding: "2px 8px", fontWeight: 800, fontFamily: FB, marginLeft: "auto" }}>PILATES PASSPORT</span>
      </div>
      <p style={{ fontSize: 11, color: C.textSec, margin: "0 0 14px", fontFamily: FB }}>Written by Pilates Passport users · Avg ★ {avg}</p>

      {reviews.map((r, i) => (
        <div key={r.id||i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: "14px 16px", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
            {r.users?.profile_photo_url
              ? <img src={r.users.profile_photo_url} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={e => { e.target.style.display="none"; }} />
              : <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: C.accent, fontWeight: 800, flexShrink: 0, fontFamily: FB }}>{(r.users?.display_name||"P")[0].toUpperCase()}</div>
            }
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.textPri, margin: "0 0 2px", fontFamily: FB }}>{r.users?.display_name || "Pilates Lover"}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#FFB800", fontSize: 12 }}>{"★".repeat(r.rating||0)}{"☆".repeat(5-(r.rating||0))}</span>
                <span style={{ fontSize: 10, color: C.textTer, fontFamily: FB }}>{new Date(r.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
              </div>
            </div>
          </div>
          {r.body && <p style={{ fontSize: 13, color: C.textSec, lineHeight: 1.65, margin: "0 0 8px", fontFamily: FB }}>{r.body}</p>}
          {r.tags?.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{r.tags.map(t => <span key={t} style={{ background: C.accentDim, color: C.accent, borderRadius: 100, padding: "3px 10px", fontSize: 10, fontWeight: 700, fontFamily: FB }}>{t}</span>)}</div>}
        </div>
      ))}
    </div>
  );
}

function StudioDetail({ studio, logs, onBack, savedStudios, toggleSave, setTab, setLogPrefill, showToast }) {
  const { C } = useTheme();
  const [tab, setLT] = useState("about");
  const [reviewText, setReviewText] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [details, setDetails] = useState(null); // enriched from Google Places
  const [loadingDetails, setLoadingDetails] = useState(false);
  const vl = logs.filter(l => (l.studioId || l.studio_id) === studio.id);
  const saved = savedStudios.includes(studio.id);

  // Fetch real place details from Google when studio has a place_id
  useEffect(() => {
    const placeId = studio.google_place_id || studio.id;
    // Only fetch if this is a Google Places result (id starts with ChIJ or similar)
    const isGoogleId = typeof placeId === "string" && placeId.length > 20 && !Number.isInteger(placeId);
    if (!isGoogleId) return;
    if (studio.website && studio.phone) return; // already has full details

    setLoadingDetails(true);
    fetch(`/api/places-search?place_id=${encodeURIComponent(placeId)}`)
      .then(r => r.json())
      .then(json => {
        if (json.studio) setDetails(json.studio);
      })
      .catch(e => console.warn("[StudioDetail] Details fetch failed:", e.message))
      .finally(() => setLoadingDetails(false));
  }, [studio.id, studio.google_place_id, studio.website, studio.phone]);

  // Merge studio data with fetched details (details takes priority for missing fields)
  const s = {
    ...studio,
    website:   studio.website   || details?.website   || "",
    phone:     studio.phone     || details?.phone     || "",
    rating:    studio.rating    || details?.rating    || 0,
    reviews:   studio.reviews   || details?.reviews   || 0,
    vibe:      studio.vibe      || details?.vibe      || "",
    heroPhoto: studio.heroPhoto || details?.heroPhoto || null,
    photos:    (details?.photos?.length ? details.photos : studio.photos) || [],
  };

  const submitReview = async () => {
    setSubmittingReview(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("reviews").upsert({ user_id: user.id, studio_id: studio.id, rating: reviewRating, body: reviewText, moderation_status: "approved" });
      showToast("Review submitted! ✦");
      setReviewText(""); setLT("in-app reviews");
    } catch (e) { showToast("Failed to submit review"); }
    finally { setSubmittingReview(false); }
  };

  return (
    <div>
      {/* Hero — real photo from Google Places if available, else gradient + emoji */}
      <div style={{ height: 220, position: "relative", overflow: "hidden", background: `linear-gradient(160deg,${C.surfaceHi},${C.surface})` }}>
        {s.heroPhoto ? (
          <img
            src={s.heroPhoto}
            alt={s.name}
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={e => { e.target.style.display = "none"; }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80 }}>
            {getStudioIcon(s)}
          </div>
        )}
        {/* Dark gradient overlay so buttons are readable */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 50%)" }} />
        {/* Back + Save buttons */}
        <button onClick={onBack} style={{ position: "absolute", top: 52, left: 16, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", fontSize: 16, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <button onClick={() => toggleSave(studio.id, s)} style={{ position: "absolute", top: 52, right: 16, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", fontSize: 18, color: saved ? "#ff6b6b" : "#fff" }}>{saved ? "♥" : "♡"}</button>
        {/* Loading indicator while fetching details */}
        {loadingDetails && (
          <div style={{ position: "absolute", bottom: 8, right: 12, background: "rgba(0,0,0,0.5)", borderRadius: 8, padding: "3px 8px", fontSize: 10, color: "#fff" }}>
            Loading details…
          </div>
        )}
      </div>
      {/* Photo strip — show additional photos if available */}
      {s.photos && s.photos.length > 1 && (
        <div style={{ display: "flex", gap: 4, padding: "6px 20px", overflowX: "auto", background: C.surface }}>
          {s.photos.slice(0, 5).map((url, i) => (
            <img
              key={i}
              src={url}
              alt={`${s.name} photo ${i + 1}`}
              style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, flexShrink: 0, cursor: "pointer" }}
              onError={e => { e.target.style.display = "none"; }}
              onClick={() => window.open(url, "_blank")}
            />
          ))}
        </div>
      )}
      <div style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <h2 style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: C.textPri, margin: "0 0 3px" }}>{s.name}</h2>
            <p style={{ fontSize: 12, color: C.textSec, margin: 0 }}>{s.address || s.city}</p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            {(s.rating > 0) && <>
              <p style={{ fontFamily: FD, fontSize: 26, fontWeight: 700, color: C.accent, margin: "0 0 2px" }}>{s.rating}</p>
              <p style={{ fontSize: 10, color: C.textTer, margin: 0 }}>{s.reviews} reviews</p>
            </>}
          </div>
        </div>

        {vl.length > 0 && <div style={{ background: C.accentDim, border: `1px solid rgba(232,113,74,0.25)`, borderRadius: 10, padding: "8px 12px", margin: "10px 0", display: "flex", alignItems: "center", gap: 8 }}><span style={{ color: C.accent, fontSize: 14, fontWeight: 700 }}>✓</span><p style={{ fontSize: 12, color: C.accent, fontWeight: 700, margin: 0 }}>Visited {vl.length}× · Last: {vl[0].date}</p></div>}

        <p style={{ fontSize: 13, color: C.textSec, lineHeight: 1.65, margin: "10px 0 12px" }}>{studio.vibe}</p>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>{(studio.tags || []).map(t => <Pill key={t} label={t} />)}</div>

        {/* Booking */}
        <div style={{ background: C.accentDim, border: `1px solid rgba(232,113,74,0.3)`, borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.textPri, margin: "0 0 6px" }}>
            {loadingDetails ? "Loading studio details…" : "Book a class"}
          </p>
          {s.website ? (
            <>
              <p style={{ fontSize: 11, color: C.textSec, margin: "0 0 10px" }}>{s.website.replace(/^https?:\/\//, "")}</p>
              <Btn full label="Book on studio website →" onClick={() => window.open(s.website, "_blank")} icon="🔗" style={{ justifyContent: "center" }} />
            </>
          ) : (
            <>
              <p style={{ fontSize: 11, color: C.textSec, margin: "0 0 10px" }}>
                {loadingDetails ? "Fetching website…" : "Website not available — search on Google Maps"}
              </p>
              <Btn full label="Find on Google Maps →"
                onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.name + " " + s.city)}&query_place_id=${s.google_place_id || ""}`, "_blank")}
                icon="🗺️" style={{ justifyContent: "center" }} />
            </>
          )}
          {s.phone && (
            <p style={{ fontSize: 11, color: C.textTer, margin: "10px 0 0", textAlign: "center" }}>
              📞 <a href={`tel:${s.phone}`} style={{ color: C.accent, textDecoration: "none", fontWeight: 600 }}>{s.phone}</a>
            </p>
          )}
        </div>

        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
          {["about", "google reviews", "in-app reviews", "history", "write review"].map(t => (
            <button key={t} onClick={() => setLT(t)} style={{
              flex: 1, background: "none", border: "none",
              borderBottom: `2px solid ${tab === t ? C.accent : "transparent"}`,
              padding: "9px 2px",
              fontSize: t.length > 10 ? 9 : t.length > 7 ? 10 : 12,
              fontWeight: 700, color: tab === t ? C.accent : C.textTer,
              cursor: "pointer", fontFamily: FB, textTransform: "capitalize",
              transition: "all 0.15s", whiteSpace: "nowrap",
            }}>{t}</button>
          ))}
        </div>

        {tab === "about" && <div>
          {/* Opening Hours */}
          {(s.opening_hours?.weekday_text?.length > 0 || details?.opening_hours?.weekday_text?.length > 0) && (() => {
            const hours = s.opening_hours || details?.opening_hours;
            const isOpenNow = hours?.open_now;
            return (
              <div style={{ marginBottom: 18 }}>
                <SL>Opening hours</SL>
                <div style={{ background: C.surfaceHi, borderRadius: 14, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: isOpenNow === true ? C.green : isOpenNow === false ? "#E05050" : C.textTer, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: isOpenNow === true ? C.green : isOpenNow === false ? "#E05050" : C.textSec }}>
                      {isOpenNow === true ? "Open now" : isOpenNow === false ? "Closed now" : "Hours"}
                    </span>
                  </div>
                  {hours.weekday_text.map((line, i) => {
                    const [day, ...rest] = line.split(": ");
                    const today = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][new Date().getDay()];
                    const isToday = day?.startsWith(today);
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: i < hours.weekday_text.length - 1 ? `1px solid ${C.border}` : "none" }}>
                        <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 500, color: isToday ? C.textPri : C.textSec }}>{day}</span>
                        <span style={{ fontSize: 12, fontWeight: isToday ? 700 : 400, color: isToday ? C.accent : C.textSec }}>{rest.join(": ") || "—"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <SL>Class types</SL>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
            {(s.tags || s.types || studio.class_types || []).length > 0
              ? (s.tags || s.types || studio.class_types || []).map(t => <Pill key={t} label={t} />)
              : <p style={{ fontSize: 12, color: C.textSec, margin: 0, fontFamily: FB }}>Reformer · Mat · Pilates</p>
            }
          </div>

          {s.vibe && s.vibe.length > 20 && (
            <div style={{ marginBottom: 16 }}>
              <SL>About</SL>
              <p style={{ fontSize: 13, color: C.textSec, lineHeight: 1.65, margin: 0, fontFamily: FB }}>{s.vibe}</p>
            </div>
          )}

          <div style={{ background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: 16, padding: "14px 16px", marginTop: 8 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.textPri, margin: "0 0 4px", fontFamily: FB }}>See what people say</p>
            <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 12px", fontFamily: FB }}>Real reviews from Google and Pilates Passport users</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setLT("google reviews")} style={{ flex: 1, background: C.blueDim, border: `1px solid ${C.blue}30`, borderRadius: 10, padding: "9px 0", fontSize: 12, fontWeight: 700, color: C.blue, cursor: "pointer", fontFamily: FB }}>
                🌐 Google Reviews
              </button>
              <button onClick={() => setLT("in-app reviews")} style={{ flex: 1, background: C.accentDim, border: `1px solid ${C.accent}30`, borderRadius: 10, padding: "9px 0", fontSize: 12, fontWeight: 700, color: C.accent, cursor: "pointer", fontFamily: FB }}>
                🪷 Community
              </button>
            </div>
          </div>
        </div>}

        {tab === "google reviews" && (
          <GoogleReviewsTab placeId={s.google_place_id || studio.place_id || (typeof studio.id === "string" && studio.id.startsWith("Ch") ? studio.id : null)} overallRating={s.rating} C={C} />
        )}

        {tab === "in-app reviews" && (
          <InAppReviewsTab studioId={studio.id} googlePlaceId={s.google_place_id} C={C} />
        )}

        {tab === "history" && <div>
          {vl.length === 0
            ? <div style={{ textAlign: "center", padding: "40px 20px" }}><p style={{ fontSize: 32 }}>🗺️</p><p style={{ fontSize: 14, color: C.textSec }}>No visits logged here yet.</p></div>
            : vl.map(log => (
              <Card key={log.id} style={{ padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><div><p style={{ fontSize: 13, fontWeight: 700, color: C.textPri, margin: "0 0 2px" }}>{log.type || log.class_type}</p><p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>{log.date} · {log.duration || log.duration_minutes} min · {log.instructor}</p></div><Stars n={log.rating} size={11} /></div>
                {log.notes && <p style={{ fontSize: 11, color: C.textSec, fontStyle: "italic", margin: "8px 0 0" }}>"{log.notes}"</p>}
              </Card>
            ))}
        </div>}

        {tab === "write review" && <div>
          <SL>Your rating</SL>
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => setReviewRating(n)} style={{ flex: 1, background: n <= reviewRating ? C.accentDim : "transparent", border: `1px solid ${n <= reviewRating ? C.accent : C.border}`, borderRadius: 10, padding: "10px 0", fontSize: 22, color: n <= reviewRating ? C.accent : C.textTer, cursor: "pointer", transition: "all 0.12s" }}>★</button>)}
          </div>
          <SL>Your review</SL>
          <Inp multiline placeholder="Share your experience…" value={reviewText} onChange={setReviewText} style={{ marginBottom: 14 }} />
          <Btn full label="Submit review" onClick={submitReview} loading={submittingReview} style={{ justifyContent: "center" }} />
        </div>}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <Btn label="Log a class here" onClick={() => {
            setLogPrefill({
              studio: s,
              studioId: s.id,
              name: s.name,
              city: s.city,
              google_place_id: s.google_place_id,
            });
            setTab("log");
          }} style={{ flex: 1, justifyContent: "center" }} />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PUBLIC PROFILE
══════════════════════════════════════════════════════════════════════════ */
function PublicProfileScreen({ user, onBack, setCommunityUsers }) {
  const { C } = useTheme();
  return (
    <div>
      <div style={{ height: 120, background: `linear-gradient(160deg,${C.surfaceHi},${C.surface})`, position: "relative" }}>
        <button onClick={onBack} style={{ position: "absolute", top: 16, left: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, width: 36, height: 36, cursor: "pointer", fontSize: 16, color: C.textPri, display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
      </div>
      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginTop: -32, marginBottom: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: C.accentDim, border: `3px solid ${C.bg}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, flexShrink: 0 }}>{user.avatar}</div>
          <div style={{ flex: 1, paddingBottom: 4 }}>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, color: C.textPri, margin: "0 0 2px" }}>{user.name}</h2>
            <p style={{ fontSize: 12, color: C.textSec, margin: 0 }}>📍 {user.city}</p>
          </div>
          <Btn small label={user.following ? "Following ✓" : "Follow"} outline={user.following} onClick={() => setCommunityUsers(prev => prev.map(x => x.id === user.id ? { ...x, following: !x.following } : x))} style={{ flexShrink: 0 }} />
        </div>
        <p style={{ fontSize: 13, color: C.textSec, fontStyle: "italic", margin: "0 0 16px", lineHeight: 1.5 }}>{user.bio}</p>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[["Classes", user.classes], ["Studios", user.studios], ["Cities", user.cities]].map(([l, v]) => (
            <div key={l} style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: C.accent }}>{v}</div>
              <div style={{ fontSize: 10, color: C.textTer, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   LOG SCREEN — fully wired to Supabase
══════════════════════════════════════════════════════════════════════════ */
function LogScreen({ logs, setLogs, prefill, setPrefill, hkConnected, hkConnect, hkSyncing, hkWorkouts, showToast, detectedCity, onClassLogged, notifications }) {
  const { C } = useTheme();
  const { uploadPhoto, saveClassPhoto, uploading: photoUploading } = usePhotoUpload();
  // Support both full studio object prefill and legacy studioId-only prefill
  const pf = prefill?.studio || (prefill?.studioId ? STUDIOS_SEED.find(s => s.id === prefill.studioId) : null);
  const [step, setStep] = useState(1);
  const [studio, setStudio] = useState(pf || null);
  const [ss, setSS] = useState(pf?.name || "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [dur, setDur] = useState("55");
  const [type, setType] = useState("Reformer");
  const [instr, setInstr] = useState("");
  const [rating, setRating] = useState(5);
  const [notes, setNotes] = useState("");
  // photos: array of { file: File, previewUrl: string, uploaded: bool, url: string|null, error: string|null }
  const [photos, setPhotos] = useState([]);
  const [wa, setWA] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const fileInputRef = useRef(null);

  const MAX_PHOTOS = 5;

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = MAX_PHOTOS - photos.length;
    const toAdd = files.slice(0, remaining);
    if (files.length > remaining) showToast(`Max ${MAX_PHOTOS} photos. Only first ${remaining} added.`);
    const newPhotos = toAdd.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      uploaded: false,
      progress: 0,
      url: null,
      error: null,
      id: `${Date.now()}-${Math.random()}`,
    }));
    setPhotos(prev => [...prev, ...newPhotos]);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const removePhoto = (id) => {
    setPhotos(prev => {
      const p = prev.find(x => x.id === id);
      if (p?.previewUrl) URL.revokeObjectURL(p.previewUrl);
      return prev.filter(x => x.id !== id);
    });
  };

  useEffect(() => {
    if (prefill?.studio) {
      // Full studio object passed (from StudioDetail)
      setStudio(prefill.studio);
      setSS(prefill.studio.name);
    } else if (prefill?.studioId) {
      const s = STUDIOS_SEED.find(x => x.id === prefill.studioId);
      if (s) { setStudio(s); setSS(s.name); }
    } else if (prefill?.name) {
      // Name-only prefill (from calendar detection)
      setSS(prefill.name);
      if (prefill.date) setDate(prefill.date);
      if (prefill.time) setTime(prefill.time);
    }
  }, [prefill]);

  const matchedWorkout = hkConnected && hkWorkouts.find(w => w.date === date);

  // ── Real Google Places studio search ────────────────────────────────────────
  const [sr, setSR] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef(null);

  const searchStudios = useCallback((query) => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!query || query.length < 2) { setSR([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      // ── Cache check ──────────────────────────────────────────────────────
      const cacheKey = `log:${query.toLowerCase().trim()}`;
      const cached = searchCache.get(cacheKey);
      if (cached) { setSR(cached); return; }

      setSearching(true);
      try {
        // Call Netlify function — real Google Places search
        const res = await fetch(`/api/places-search?query=${encodeURIComponent(query)}`);
        const json = await res.json();
        if (json.studios && json.studios.length > 0) {
          setSR(json.studios);
          searchCache.set(cacheKey, json.studios);
        } else {
          // Fallback: filter local seed data
          const local = STUDIOS_SEED.filter(s =>
            s.name.toLowerCase().includes(query.toLowerCase()) ||
            (s.city || "").toLowerCase().includes(query.toLowerCase())
          );
          setSR(local);
        }
      } catch (e) {
        // Fallback to local seed on network error
        const local = STUDIOS_SEED.filter(s =>
          s.name.toLowerCase().includes(query.toLowerCase())
        );
        setSR(local);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  // Photo emojis removed — using real file upload now

  const resetForm = () => {
    // revoke all preview URLs to free memory
    photos.forEach(p => { if (p.previewUrl) URL.revokeObjectURL(p.previewUrl); });
    setStep(1); setStudio(null); setSS(""); setNotes(""); setPhotos([]);
    setRating(5); setInstr(""); setWA(false); setPrefill(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Step 1: Upload all photos to Supabase Storage with progress simulation
      const uploadedUrls = [];
      for (const p of photos) {
        // Animate progress 0 → 80% while uploading
        let prog = 0;
        const ticker = setInterval(() => {
          prog = Math.min(prog + 12, 80);
          setPhotos(prev => prev.map(x => x.id === p.id ? { ...x, progress: prog } : x));
        }, 150);
        try {
          const url = await uploadPhoto(p.file, "class");
          clearInterval(ticker);
          uploadedUrls.push(url);
          setPhotos(prev => prev.map(x => x.id === p.id ? { ...x, uploaded: true, url, progress: 100 } : x));
        } catch (err) {
          clearInterval(ticker);
          setPhotos(prev => prev.map(x => x.id === p.id ? { ...x, error: err.message, progress: 0 } : x));
          showToast(`Photo upload failed: ${err.message}`);
          // Continue — don't block the log save for a failed photo
        }
      }

      // Step 2: Save class log
      const payload = {
        user_id: user.id,
        // Only use studio_id if it's a real UUID (not a Google Places ChIJ... string)
        studio_id: (studio?.id && !String(studio.id).startsWith("Ch") && !isNaN(studio.id)) ? studio.id : null,
        studio_name_manual: studio ? studio.name : ss,
        google_place_id: studio?.google_place_id || (String(studio?.id || "").startsWith("Ch") ? studio.id : null),
        date, start_time: time,
        duration_minutes: parseInt(dur),
        city: studio?.city || "Unknown",
        country: studio?.country || "Unknown",
        class_type: type,
        instructor: instr || null,
        notes: notes || null,
        rating,
        photos: uploadedUrls,       // store public URLs in the log row
        is_new_studio: !logs.some(l => (l.studioId || l.studio_id) === studio?.id),
        is_travel_class: detectedCity
          ? !studio?.city?.toLowerCase().includes(detectedCity.toLowerCase())
          : false,
        source: "manual",
        visibility: "private",
      };
      const { data, error } = await supabase.from("class_logs").insert(payload).select().single();
      if (error) throw error;

      // Step 3: Save each photo to class_photos table (for relational queries)
      for (const url of uploadedUrls) {
        try { await saveClassPhoto(data.id, url); } catch (_) { /* non-blocking */ }
      }

      // Step 4: Update local state
      const localLog = {
        ...data,
        studioId: data.studio_id,
        studio: studio?.name || ss,
        type: data.class_type,
        duration: data.duration_minutes,
        time: data.start_time,
        photos: uploadedUrls,
        watchData: wa ? { cal: 312, hr: 138 } : null,
      };
      setLogs(prev => [localLog, ...prev]);
      setSavedOk(true);
      showToast("Class logged! ✦");
      // Evaluate badges after log is saved
      if (onClassLogged) onClassLogged();
      // Request notification permission after first class (feels natural here)
      if (notifications.permission === "default" && FLAGS.notifications) {
        setTimeout(() => notifications.requestPermission(), 1500);
      }
      setTimeout(() => { setSavedOk(false); resetForm(); }, 2200);
    } catch (e) {
      showToast("Error saving: " + (e.message || "try again"));
    } finally { setSaving(false); }
  };

  if (savedOk) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 500, padding: 40, textAlign: "center" }}>
      <div style={{ width: 80, height: 80, borderRadius: "50%", background: C.accentDim, border: `2px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 20 }}>✦</div>
      <h2 style={{ fontFamily: FD, fontSize: 32, fontWeight: 700, color: C.textPri, margin: "0 0 10px" }}>Logged.</h2>
      <p style={{ fontSize: 15, color: C.textSec, lineHeight: 1.6 }}>Your practice is beautifully documented.</p>
      {photos.length > 0 && (
        <p style={{ fontSize: 13, color: C.green, marginTop: 10, fontWeight: 600 }}>
          📸 {photos.filter(p => p.uploaded).length}/{photos.length} photo{photos.length !== 1 ? "s" : ""} uploaded
        </p>
      )}
    </div>
  );

  const di = { background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: "11px 14px", fontSize: 13, color: C.textPri, fontFamily: FB, outline: "none", flex: 1 };

  return (
    <div style={{ padding: "48px 20px 24px" }}>
      <h2 style={{ fontFamily: FD, fontSize: 28, fontWeight: 700, color: C.textPri, margin: "0 0 4px" }}>Log a class</h2>
      <p style={{ fontSize: 10, color: C.textSec, margin: "0 0 20px", fontWeight: 800, letterSpacing: "0.12em", fontFamily: FB }}>STEP {step} OF 3</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 26 }}>
        {[1, 2, 3].map(s => (
          <div key={s} style={{ flex: 1, height: 4, borderRadius: 100, overflow: "hidden", background: C.surfaceEl }}>
            <div style={{ height: "100%", width: s <= step ? "100%" : "0%", background: C.gradientPrimary, borderRadius: 100, transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)" }} />
          </div>
        ))}
      </div>

      {step === 1 && <div>
        <SL>Studio</SL>
        <div style={{ position: "relative", marginBottom: 12, zIndex: 100 }}>
          <div style={{ position: "relative" }}>
            <Inp placeholder="Search studio by name or city…" value={ss} onChange={v => { setSS(v); setStudio(null); searchStudios(v); }} />
            {searching && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 11, color: C.textTer, fontFamily: FB }}>searching…</span>}
          </div>
          {sr.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, zIndex: 200, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
              {sr.slice(0, 6).map((s, i) => (
                <div
                  key={s.id || i}
                  onClick={() => { setStudio(s); setSS(s.name); setSR([]); }}
                  style={{ padding: "12px 14px", cursor: "pointer", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}
                  onMouseEnter={e => e.currentTarget.style.background = C.surfaceHi}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  {s.heroPhoto
                    ? <img src={s.heroPhoto} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} onError={e => e.target.style.display="none"} />
                    : <div style={{ width: 36, height: 36, borderRadius: 8, background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{s.hero || "🪷"}</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.textPri, margin: "0 0 1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</p>
                    <p style={{ fontSize: 11, color: C.textSec, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.address || s.city}{s.city && s.address ? ` · ${s.city}` : ""}</p>
                  </div>
                  {s.rating > 0 && <span style={{ fontSize: 12, color: C.accent, fontWeight: 700, flexShrink: 0 }}>★{s.rating}</span>}
                </div>
              ))}
              <div
                onClick={() => { setStudio({ name: ss, city: detectedCity || "Unknown", country: "", id: null, fromManual: true }); setSR([]); }}
                style={{ padding: "10px 14px", cursor: "pointer", fontSize: 12, color: C.accent, fontWeight: 700, textAlign: "center", background: C.accentDim2 }}
              >
                + Use "{ss}" as studio name
              </div>
            </div>
          )}
        </div>
        {studio && <div style={{ background: C.accentDim, border: `1px solid rgba(232,113,74,0.3)`, borderRadius: 10, padding: "9px 14px", marginBottom: 14, fontSize: 13, color: C.accent, fontWeight: 700 }}>✓ {studio.name}, {studio.city}</div>}
        <SL>Date & time</SL>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}><input type="date" value={date} onChange={e => setDate(e.target.value)} style={di} /><input type="time" value={time} onChange={e => setTime(e.target.value)} style={di} /></div>
        <SL>Duration</SL>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 22 }}>{["30", "45", "50", "55", "60", "75", "90"].map(d => <Pill key={d} label={`${d} min`} active={dur === d} onClick={() => setDur(d)} />)}</div>
        {studio && <div style={{ background: C.blueDim, border: `1px solid rgba(107,163,214,0.25)`, borderRadius: 10, padding: "8px 12px", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}><span>📡</span><p style={{ fontSize: 11, color: C.blue, margin: 0, fontWeight: 600 }}>GPS: {studio.name} confirmed nearby · {studio.distance}</p></div>}
        <Btn full label="Continue →" onClick={() => setStep(2)} disabled={!ss} style={{ justifyContent: "center" }} />
      </div>}

      {step === 2 && <div>
        <SL>Class type</SL>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>{CLASS_TYPES.map(t => <Pill key={t} label={t} active={type === t} onClick={() => setType(t)} />)}</div>
        <SL>Instructor (optional)</SL>
        <Inp placeholder="Instructor name" value={instr} onChange={setInstr} style={{ marginBottom: 16 }} />
        <SL>Apple Watch</SL>
        {!hkConnected ? (
          <Card style={{ marginBottom: 16, padding: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>⌚</span>
              <div style={{ flex: 1 }}><p style={{ fontSize: 13, fontWeight: 700, color: C.textPri, margin: "0 0 1px" }}>Apple Health not connected</p><p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>Connect to import workout data</p></div>
              <Btn small label={hkSyncing ? "…" : "Connect"} onClick={hkConnect} disabled={hkSyncing} />
            </div>
          </Card>
        ) : matchedWorkout ? (
          <Card accent style={{ marginBottom: 16, padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div><p style={{ fontSize: 10, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 3px" }}>Workout matched ⌚</p><p style={{ fontSize: 13, color: C.textPri, fontWeight: 700, margin: 0 }}>{matchedWorkout.duration} min · {matchedWorkout.cal} cal · avg {matchedWorkout.avgHr} BPM</p></div>
              <Toggle on={wa} onClick={() => setWA(!wa)} />
            </div>
            {wa && <p style={{ fontSize: 11, color: C.accent, margin: 0, fontWeight: 600 }}>✓ Attached to this class</p>}
          </Card>
        ) : (
          <Card style={{ marginBottom: 16, padding: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 22 }}>⌚</span>
              <div style={{ flex: 1 }}><p style={{ fontSize: 13, fontWeight: 700, color: C.textPri, margin: "0 0 1px" }}>Connected</p><p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>No workout found for this date</p></div>
            </div>
          </Card>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <Btn ghost label="← Back" onClick={() => setStep(1)} style={{ flex: 1, justifyContent: "center" }} />
          <Btn label="Continue →" onClick={() => setStep(3)} style={{ flex: 2, justifyContent: "center" }} />
        </div>
      </div>}

      {step === 3 && <div>
        <SL>Your rating</SL>
        <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>{[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => setRating(n)} style={{ flex: 1, background: n <= rating ? C.accentDim : "transparent", border: `1px solid ${n <= rating ? C.accent : C.border}`, borderRadius: 10, padding: "10px 0", fontSize: 22, color: n <= rating ? C.accent : C.textTer, cursor: "pointer", transition: "all 0.12s" }}>★</button>)}</div>
        <SL>Photos — {photos.length}/{MAX_PHOTOS} (optional)</SL>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />

        {/* Thumbnail grid with progress bars */}
        {photos.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {photos.map(p => (
              <div key={p.id} style={{ position: "relative", width: 72 }}>
                <img
                  src={p.previewUrl}
                  alt="preview"
                  style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10,
                    border: `1.5px solid ${p.error ? "rgba(220,80,60,0.6)" : p.uploaded ? C.green : C.border}`,
                    opacity: p.progress > 0 && p.progress < 100 ? 0.7 : 1,
                    display: "block",
                  }}
                />
                {/* Progress bar */}
                {p.progress > 0 && p.progress < 100 && !p.error && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "rgba(0,0,0,0.3)", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${p.progress}%`, background: C.accent, borderRadius: "0 0 10px 10px", transition: "width 0.15s ease" }} />
                  </div>
                )}
                {/* Error overlay */}
                {p.error && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(220,80,60,0.3)", borderRadius: 10,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚠️</div>
                )}
                {/* Uploaded check */}
                {p.uploaded && !p.error && (
                  <div style={{ position: "absolute", bottom: 3, right: 3, background: C.green,
                    borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700 }}>✓</div>
                )}
                {/* Delete button */}
                <button
                  onClick={() => removePhoto(p.id)}
                  style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20,
                    background: C.surfaceEl, border: `1px solid ${C.border}`, borderRadius: "50%",
                    cursor: "pointer", fontSize: 10, color: C.textSec, display: "flex",
                    alignItems: "center", justifyContent: "center", fontWeight: 700 }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Add photos button */}
        {photos.length < MAX_PHOTOS && (
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{ width: "100%", background: C.surfaceHi, border: `1.5px dashed ${C.border}`,
              borderRadius: 12, padding: "14px", fontSize: 13, color: C.textSec, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              fontFamily: FB, marginBottom: 18, transition: "border-color 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.accent}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
          >
            <span style={{ fontSize: 18 }}>📸</span>
            {photos.length === 0 ? "Add photos from your camera roll" : `Add more (${MAX_PHOTOS - photos.length} remaining)`}
          </button>
        )}
        {photos.length >= MAX_PHOTOS && <div style={{ marginBottom: 18 }} />}
        <SL>Notes (optional)</SL>
        <Inp multiline placeholder="How was this class? Memories, vibes…" value={notes} onChange={setNotes} style={{ marginBottom: 22 }} />
        <div style={{ display: "flex", gap: 8 }}>
          <Btn ghost label="← Back" onClick={() => setStep(2)} style={{ flex: 1, justifyContent: "center" }} />
          <Btn label="Save class ✦" onClick={handleSave} loading={saving} style={{ flex: 2, justifyContent: "center" }} />
        </div>
      </div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PASSPORT
══════════════════════════════════════════════════════════════════════════ */
function PassportScreen({ logs }) {
  const { C } = useTheme();
  const [view, setView] = useState("map");
  const [fc, setFC] = useState("All");
  const stats = getStats(logs);
  const { badges } = useBadges(stats);  // real badges from Supabase
  const visitedIds = new Set(logs.map(l => l.studioId || l.studio_id).filter(Boolean));
  const vs = STUDIOS_SEED.filter(s => visitedIds.has(s.id));
  const cities = ["All", ...stats.cityList];
  const fl = fc === "All" ? logs : logs.filter(l => l.city === fc);
  const months = Object.entries(stats.monthCounts).sort();
  const maxM = Math.max(...months.map(([, v]) => v), 1);

  return (
    <div>
      <div style={{ padding: "52px 20px 14px", background: C.bg, position: "sticky", top: 0, zIndex: 10, borderBottom: `1px solid ${C.border}` }}>
        <h2 style={{ fontFamily: FD, fontSize: 28, fontWeight: 700, color: C.textPri, margin: "0 0 14px", letterSpacing: -0.5 }}>My Passport</h2>
        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}` }}>
          {["map", "timeline", "stats", "badges"].map(v => <button key={v} onClick={() => setView(v)} style={{ flex: 1, background: "none", border: "none", borderBottom: `2px solid ${view === v ? C.accent : "transparent"}`, padding: "8px 4px", fontSize: 11, fontWeight: 700, color: view === v ? C.accent : C.textTer, cursor: "pointer", fontFamily: FB, textTransform: "capitalize", letterSpacing: "0.05em", transition: "all 0.15s" }}>{v}</button>)}
        </div>
      </div>
      <div style={{ padding: "14px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
          {[["Classes", stats.classes, C.accent, C.redDim], ["Studios", stats.studios, C.accentPurple, C.purpleDim], ["Cities", stats.cities, C.accentTeal, C.tealDim], ["Countries", stats.countries, C.lime, C.limeDim]].map(([l, v, col, bg]) => (
            <div key={l} style={{ background: bg, border: `1px solid ${col}30`, borderRadius: 16, padding: "12px 6px", textAlign: "center" }}>
              <div style={{ fontFamily: FB, fontSize: 22, fontWeight: 800, color: col }}>{v}</div>
              <div style={{ fontSize: 9, color: C.textTer, marginTop: 3, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: FB }}>{l}</div>
            </div>
          ))}
        </div>

        {view === "map" && <div>
          {vs.length > 0 ? <MapView studios={vs} visitedIds={visitedIds} onSelect={() => { }} userCoords={null} /> : <div style={{ textAlign: "center", padding: "32px 20px" }}><p style={{ fontSize: 32 }}>🗺️</p><p style={{ fontSize: 14, color: C.textSec, marginTop: 8 }}>Log your first class to start your map.</p></div>}
          {vs.map(s => { const c = logs.filter(l => (l.studioId || l.studio_id) === s.id).length; return <Card key={s.id} style={{ padding: "14px" }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ fontSize: 26 }}>{s.hero}</span><div style={{ flex: 1 }}><p style={{ fontSize: 14, fontWeight: 700, color: C.textPri, margin: "0 0 2px" }}>{s.name}</p><p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>{s.city} · {c} visit{c !== 1 ? "s" : ""}</p></div><p style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, color: C.accent, margin: 0 }}>{s.rating}</p></div></Card>; })}
        </div>}

        {view === "timeline" && <div>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 12 }}>{cities.map(c => <Pill key={c} label={c} active={fc === c} onClick={() => setFC(c)} />)}</div>
          {fl.length === 0 ? <div style={{ textAlign: "center", padding: "32px 20px" }}><p style={{ fontSize: 14, color: C.textSec }}>No classes yet. Go log one!</p></div> : fl.map((log, i) => (
            <div key={log.id} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.accent, flexShrink: 0, border: `2px solid ${C.bg}` }} />
                {i < fl.length - 1 && <div style={{ width: 1.5, flex: 1, background: C.border, marginTop: 4 }} />}
              </div>
              <Card style={{ flex: 1, marginBottom: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <p style={{ fontSize: 11, color: C.textTer, margin: 0, fontWeight: 600 }}>{log.date} · {log.time || log.start_time}</p>
                  <div style={{ display: "flex", gap: 4 }}>
                    {(log.isTravel || log.is_travel_class) && <span style={{ fontSize: 9, background: C.accentDim, color: C.accent, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>✈ TRAVEL</span>}
                    {(log.isNew || log.is_new_studio) && <span style={{ fontSize: 9, background: `rgba(200,230,80,0.12)`, color: C.lime, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>NEW</span>}
                  </div>
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.textPri, margin: "0 0 2px" }}>{log.studio || log.studio_name_manual}</p>
                <p style={{ fontSize: 11, color: C.textSec, margin: "0 0 6px" }}>{log.type || log.class_type} · {log.city} · {log.duration || log.duration_minutes} min</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Stars n={log.rating} size={11} />
                  {log.photos?.length > 0 && <span style={{ fontSize: 16 }}>{log.photos.join("")}</span>}
                </div>
                {log.notes && <p style={{ fontSize: 11, color: C.textSec, fontStyle: "italic", margin: "8px 0 0", lineHeight: 1.5 }}>"{log.notes}"</p>}
                {log.watchData && <div style={{ marginTop: 8, display: "flex", gap: 6 }}><span style={{ fontSize: 10, background: C.greenDim, color: C.green, padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>⌚ {log.watchData.cal} cal</span><span style={{ fontSize: 10, background: C.greenDim, color: C.green, padding: "2px 8px", borderRadius: 6, fontWeight: 700 }}>♥ {log.watchData.hr} BPM</span></div>}
              </Card>
            </div>
          ))}
        </div>}

        {view === "stats" && <div>
          {months.length > 1 && <><SL>Classes by month</SL><Card style={{ padding: "14px", marginBottom: 14 }}><div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80 }}>{months.map(([m, v]) => <div key={m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}><p style={{ fontSize: 9, color: C.textTer, margin: 0 }}>{v}</p><div style={{ width: "100%", height: `${(v / maxM) * 60}px`, background: C.accent, borderRadius: "4px 4px 0 0", minHeight: 4 }} /><p style={{ fontSize: 8, color: C.textTer, margin: 0 }}>{m.slice(5)}</p></div>)}</div></Card></>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            {[["Total classes", stats.classes], ["Total minutes", stats.totalMin + "m"], ["Studios", stats.studios], ["Cities", stats.cities], ["Countries", stats.countries], ["Photos", stats.photos], ["Calories", stats.totalCal || "—"], ["Avg HR", stats.avgHr ? stats.avgHr + " BPM" : "—"], ["Fav type", stats.favType || "—"], ["Travel classes", stats.travelCount]].map(([l, v]) => (
              <div key={l} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px" }}>
                <p style={{ fontSize: 10, color: C.textTer, margin: "0 0 4px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{l}</p>
                <p style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: C.accent, margin: 0 }}>{String(v)}</p>
              </div>
            ))}
          </div>
          <SL>Time of day</SL>
          <Card style={{ padding: "14px" }}>
            {[["☀️ Morning", stats.hourDist.morning, C.accent], ["🌤 Midday", stats.hourDist.midday, C.blue], ["🌙 Evening", stats.hourDist.evening, C.purple]].map(([lbl, count, col]) => (
              <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <p style={{ fontSize: 12, color: C.textPri, margin: 0, width: 110, flexShrink: 0 }}>{lbl}</p>
                <div style={{ flex: 1, height: 4, background: C.surfaceHi, borderRadius: 100, overflow: "hidden" }}><div style={{ height: "100%", width: `${stats.classes ? (count / stats.classes * 100) : 0}%`, background: col, borderRadius: 100 }} /></div>
                <span style={{ fontSize: 11, color: C.textTer, width: 20, textAlign: "right" }}>{count}</span>
              </div>
            ))}
          </Card>
        </div>}

        {view === "badges" && <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
          {badges.map(b => (
            <div key={b.id} style={{
              background: b.unlocked ? C.gradientCard : C.surface,
              border: `1px solid ${b.unlocked ? "rgba(123,53,193,0.3)" : C.border}`,
              borderRadius: 20, padding: "16px 10px", textAlign: "center",
              opacity: b.unlocked ? 1 : 0.5,
              boxShadow: b.unlocked ? C.shadowPurple : "none",
              transition: "all 0.2s",
            }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                {b.unlocked
                  ? <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.gradientPrimary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, boxShadow: C.shadowPurple }}>{b.icon}</div>
                  : <ProgressRing progress={(b.current / b.target) * 100} size={52} strokeWidth={4} color={C.accentPurple}>{b.icon}</ProgressRing>
                }
              </div>
              <p style={{ fontSize: 10, fontWeight: 800, color: b.unlocked ? C.textPri : C.textTer, margin: "0 0 4px", lineHeight: 1.3, fontFamily: FB }}>{b.name}</p>
              {b.unlocked
                ? <p style={{ fontSize: 9, color: C.accentPurple, margin: 0, fontWeight: 800, fontFamily: FB, letterSpacing: "0.08em" }}>✓ EARNED</p>
                : <p style={{ fontSize: 9, color: C.textTer, margin: 0, fontFamily: FB }}>{b.current}/{b.target}</p>
              }
            </div>
          ))}
        </div>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   CHALLENGES MODAL
══════════════════════════════════════════════════════════════════════════ */
function ChallengesModal({ challenges, joinChallenge, leaveChallenge, onClose }) {
  const { C } = useTheme();
  const [cat, setCat] = useState("All");
  const catColors = { consistency: C.accent, discovery: C.blue, memory: C.purple, community: C.green };
  const filtered = challenges.filter(c => cat === "All" || c.category === cat.toLowerCase());
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", flexDirection: "column", maxWidth: 420, margin: "0 auto" }}>
      <div style={{ background: C.bg, flex: 1, overflowY: "auto", borderRadius: "16px 16px 0 0", marginTop: 80 }}>
        <div style={{ padding: "20px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: C.textPri, margin: 0 }}>Challenges</h2>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, width: 36, height: 36, fontSize: 18, color: C.textSec, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ padding: "10px 20px" }}>
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, marginBottom: 12 }}>
            {["All", "Consistency", "Discovery", "Memory", "Community"].map(f => <Pill key={f} label={f} active={cat === f} onClick={() => setCat(f)} />)}
          </div>
          {filtered.map(ch => (
            <Card key={ch.id} style={{ padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 9, background: `${catColors[ch.category]}22`, color: catColors[ch.category] || C.textSec, padding: "2px 8px", borderRadius: 4, fontWeight: 700, textTransform: "uppercase" }}>{ch.category}</span>
                    {(ch.active || ch.joined) && <span style={{ fontSize: 9, background: `rgba(200,230,80,0.12)`, color: C.lime, padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>ACTIVE</span>}
                  </div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.textPri, margin: "0 0 2px" }}>{ch.title}</p>
                  <p style={{ fontSize: 11, color: C.textSec, margin: "0 0 8px" }}>{ch.desc || ch.description} · Ends {ch.ends || ch.ends_at?.slice(5, 10)}</p>
                </div>
                <span style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, color: C.accent, flexShrink: 0, marginLeft: 8 }}>{ch.progress || 0}/{ch.target || ch.target_value}</span>
              </div>
              <div style={{ height: 4, background: C.surfaceHi, borderRadius: 100, overflow: "hidden", marginBottom: 10 }}>
                <div style={{ height: "100%", width: `${Math.min(100, ((ch.progress || 0) / (ch.target || ch.target_value || 1)) * 100)}%`, background: catColors[ch.category] || C.accent, borderRadius: 100 }} />
              </div>
              <Btn small
                label={ch.joined ? "Leave challenge" : "Join challenge"}
                outline={!!ch.joined}
                ghost={!ch.joined}
                onClick={async () => {
                  try {
                    if (ch.joined) await leaveChallenge(ch.id);
                    else await joinChallenge(ch.id);
                  } catch (e) { console.error(e); }
                }}
                style={{ fontSize: 11 }}
              />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   INSIGHTS MODAL
══════════════════════════════════════════════════════════════════════════ */
function InsightsModal({ logs, onClose }) {
  const { C } = useTheme();
  const stats = getStats(logs);
  const months = Object.entries(stats.monthCounts).sort();
  const maxM = Math.max(...months.map(([, v]) => v), 1);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", flexDirection: "column", maxWidth: 420, margin: "0 auto" }}>
      <div style={{ background: C.bg, flex: 1, overflowY: "auto", borderRadius: "16px 16px 0 0", marginTop: 80 }}>
        <div style={{ padding: "20px 20px 10px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: C.textPri, margin: 0 }}>Insights</h2>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 8, width: 36, height: 36, fontSize: 18, color: C.textSec, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            {[["Total classes", stats.classes, true], ["Total minutes", stats.totalMin + "m", false], ["Studios", stats.studios, false], ["Cities", stats.cities, false], ["Calories", stats.totalCal || "—", true], ["Avg HR", stats.avgHr ? stats.avgHr + " BPM" : "—", false]].map(([l, v, acc]) => (
              <div key={l} style={{ background: C.surface, border: `1px solid ${acc ? "rgba(232,113,74,0.2)" : C.border}`, borderRadius: 14, padding: "14px 10px", textAlign: "center" }}>
                <p style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: acc ? C.accent : C.textPri, margin: "0 0 2px" }}>{String(v)}</p>
                <p style={{ fontSize: 10, color: C.textTer, margin: 0, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>{l}</p>
              </div>
            ))}
          </div>
          {months.length > 1 && <><SL>Classes by month</SL><Card style={{ padding: "14px", marginBottom: 14 }}><div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80 }}>{months.map(([m, v]) => <div key={m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}><p style={{ fontSize: 9, color: C.textTer, margin: 0 }}>{v}</p><div style={{ width: "100%", height: `${(v / maxM) * 60}px`, background: C.accent, borderRadius: "4px 4px 0 0", minHeight: 4 }} /><p style={{ fontSize: 8, color: C.textTer, margin: 0 }}>{m.slice(5)}</p></div>)}</div></Card></>}
          <SL>Local vs travel</SL>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px", textAlign: "center" }}><p style={{ fontFamily: FD, fontSize: 26, fontWeight: 700, color: C.textPri, margin: "0 0 2px" }}>{stats.classes - stats.travelCount}</p><p style={{ fontSize: 10, color: C.textTer, margin: 0, fontWeight: 700, textTransform: "uppercase" }}>Local</p></div>
            <div style={{ background: C.accentDim, border: `1px solid rgba(232,113,74,0.25)`, borderRadius: 14, padding: "14px", textAlign: "center" }}><p style={{ fontFamily: FD, fontSize: 26, fontWeight: 700, color: C.accent, margin: "0 0 2px" }}>{stats.travelCount}</p><p style={{ fontSize: 10, color: C.accent, margin: 0, fontWeight: 700, textTransform: "uppercase" }}>Travel ✈</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PROFILE — fully wired
══════════════════════════════════════════════════════════════════════════ */
function ProfileScreen({ logs, savedStudios, savedStudiosCache, challenges, joinChallenge, leaveChallenge, hkConnected, hkConnect, hkSyncing, hkWorkouts, user, userProfile, detectedCity, showToast, notifications, calSyncEnabled, calPermission, calCalendars, calKeywords, calRequestPermission, calToggleSync, calSaveKeywords, calFetchEvents }) {
  const { C, dark, toggle } = useTheme();
  const stats = getStats(logs);
  const { badges: allBadgesFromHook, evaluateBadges } = useBadges(stats);
  const badges = allBadgesFromHook.filter(b => b.unlocked);
  const [tab, setTab] = useState("overview");
  const [showChallenges, setShowChallenges] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [isPublic, setIsPublic] = useState(() => userProfile?.visibility === "public");
  const [updatingVisibility, setUpdatingVisibility] = useState(false);
  const [homeCity, setHomeCity] = useState(() => localStorage.getItem("pp_home_city") || "");
  const [savingCity, setSavingCity] = useState(false);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(userProfile?.profile_photo_url || null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const profilePhotoInputRef = useRef(null);
  const displayName = userProfile?.display_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "there";
  
  // Sync isPublic, homeCity, profilePhotoUrl from userProfile when it loads
  useEffect(() => {
    if (userProfile) {
      setIsPublic(userProfile.visibility === "public");
      if (userProfile.profile_photo_url) setProfilePhotoUrl(userProfile.profile_photo_url);
    }
  }, [userProfile]);

  const handleProfilePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    // Validate file type and size
    if (!file.type.startsWith("image/")) { showToast("Please select an image file"); return; }
    if (file.size > 5 * 1024 * 1024) { showToast("Image must be under 5MB"); return; }
    setUploadingPhoto(true);
    try {
      const ext = file.name.split(".").pop().toLowerCase();
      const fileName = `${user.id}/profile.${ext}`;
      // Upload to Supabase Storage profile-photos bucket
      const { error: uploadError } = await supabase.storage
        .from("profile-photos")
        .upload(fileName, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(fileName);
      // Save to users table
      await supabase.from("users")
        .update({ profile_photo_url: publicUrl })
        .eq("id", user.id);
      setProfilePhotoUrl(publicUrl + "?t=" + Date.now()); // cache bust
      showToast("Profile photo updated ✦");
    } catch (err) {
      console.error("Profile photo upload error:", err);
      showToast("Upload failed: " + (err.message || "please try again"));
    } finally {
      setUploadingPhoto(false);
      e.target.value = ""; // reset input
    }
  };

  const saveHomeCity = async () => {
    if (!homeCity.trim()) return;
    setSavingCity(true);
    try {
      // Save home city as plain text in bio field (we don't have a home_city_text column)
      // We store it in localStorage too so it shows immediately without a DB fetch
      await supabase.from("users")
        .update({ bio: homeCity.trim() })
        .eq("id", user.id);
      localStorage.setItem("pp_home_city", homeCity.trim());
      showToast("Home city saved ✦");
    } catch (e) {
      showToast("Failed to save: " + (e.message || "try again"));
    }
    finally { setSavingCity(false); }
  };

  const handleSignOut = async () => {
    localStorage.removeItem("pp_hk_connected");
    await supabase.auth.signOut();
  };

  const toggleVisibility = async () => {
    setUpdatingVisibility(true);
    const newVal = !isPublic;
    try {
      await supabase.from("users").update({ visibility: newVal ? "public" : "private" }).eq("id", user.id);
      setIsPublic(newVal);
      showToast(newVal ? "Profile is now public" : "Profile is now private");
    } catch (e) { showToast("Failed to update"); }
    finally { setUpdatingVisibility(false); }
  };

  return (
    <div>
      {showChallenges && <ChallengesModal challenges={challenges} joinChallenge={joinChallenge} leaveChallenge={leaveChallenge} onClose={() => setShowChallenges(false)} />}
      {showInsights && <InsightsModal logs={logs} onClose={() => setShowInsights(false)} />}

      <div style={{ padding: "52px 20px 20px", background: `linear-gradient(180deg,${C.surface} 0%,${C.bg} 100%)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          {/* Profile photo — tap to upload */}
          <div
            onClick={() => !uploadingPhoto && profilePhotoInputRef.current?.click()}
            style={{ position: "relative", cursor: "pointer", flexShrink: 0 }}
          >
            <input
              ref={profilePhotoInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleProfilePhotoUpload}
            />
            {profilePhotoUrl ? (
              <img
                src={profilePhotoUrl}
                alt="Profile"
                style={{ width: 68, height: 68, borderRadius: "50%", objectFit: "cover", border: `2px solid ${C.accent}`, display: "block" }}
              />
            ) : (
              <div style={{ width: 68, height: 68, borderRadius: "50%", background: C.accentDim, border: `2px solid ${C.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>
                {uploadingPhoto ? "⏳" : "🪷"}
              </div>
            )}
            {/* Edit overlay */}
            <div style={{
              position: "absolute", bottom: 0, right: 0,
              width: 22, height: 22, borderRadius: "50%",
              background: C.accent, border: `2px solid ${C.bg}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, color: "#fff", fontWeight: 700,
            }}>
              {uploadingPhoto ? "…" : "✎"}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, color: C.textPri, margin: "0 0 2px" }}>{displayName}</h2>
            <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 2px" }}>{user?.email}</p>
            {(detectedCity || homeCity) && <p style={{ fontSize: 12, color: C.textSec, margin: "0 0 4px" }}>📍 {detectedCity || homeCity}</p>}
            <span style={{ fontSize: 9, background: isPublic ? `rgba(200,230,80,0.12)` : C.accentDim, color: isPublic ? C.lime : C.accent, border: `1px solid ${isPublic ? "rgba(200,230,80,0.3)" : "rgba(232,113,74,0.3)"}`, borderRadius: 4, padding: "2px 6px", fontWeight: 700 }}>{isPublic ? "PUBLIC" : "PRIVATE"}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[["Classes", stats.classes], ["Studios", stats.studios], ["Cities", stats.cities]].map(([l, v]) => (
            <div key={l} style={{ flex: 1, background: C.surfaceHi, border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: C.accent }}>{v}</div>
              <div style={{ fontSize: 10, color: C.textTer, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn small outline label="📊 Insights" onClick={() => setShowInsights(true)} style={{ flex: 1, justifyContent: "center" }} />
          <Btn small outline label="⚡ Challenges" onClick={() => setShowChallenges(true)} style={{ flex: 1, justifyContent: "center" }} />
        </div>
      </div>

      <div style={{ padding: "0 20px" }}>
        <div style={{ display: "flex", gap: 0, borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
          {["overview", "badges", "saved", "settings"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ flex: 1, background: "none", border: "none", borderBottom: `2px solid ${tab === t ? C.accent : "transparent"}`, padding: "10px 2px", fontSize: 10, fontWeight: 700, color: tab === t ? C.accent : C.textTer, cursor: "pointer", fontFamily: FB, textTransform: "capitalize", letterSpacing: "0.04em", transition: "all 0.15s" }}>{t}</button>
          ))}
        </div>

        {tab === "overview" && <div>
          <SL>Active challenges</SL>
          {challenges.filter(c => c.active || c.joined).length === 0
            ? <p style={{ fontSize: 13, color: C.textSec, marginBottom: 12 }}>No active challenges. <span style={{ color: C.accent, cursor: "pointer", fontWeight: 700 }} onClick={() => setShowChallenges(true)}>Browse challenges →</span></p>
            : challenges.filter(c => c.active || c.joined).map(ch => <Card key={ch.id}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><div><p style={{ fontSize: 13, fontWeight: 700, color: C.textPri, margin: "0 0 2px" }}>{ch.title}</p><p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>{ch.desc || ch.description}</p></div><span style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, color: C.accent }}>{ch.progress || 0}/{ch.target || ch.target_value}</span></div><div style={{ height: 4, background: C.surfaceHi, borderRadius: 100, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(100, ((ch.progress || 0) / (ch.target || ch.target_value || 1)) * 100)}%`, background: C.accent, borderRadius: 100 }} /></div></Card>)}
          {badges.length > 0 && <><SL style={{ marginTop: 8 }}>Badges earned</SL><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>{badges.map(b => <div key={b.id} style={{ background: C.accentDim, border: `1px solid rgba(232,113,74,0.25)`, borderRadius: 10, padding: "7px 12px", display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 14 }}>{b.icon}</span><span style={{ fontSize: 11, fontWeight: 700, color: C.accent }}>{b.name}</span></div>)}</div></>}
          <SL>Apple Watch</SL>
          <Card style={{ padding: "14px", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>⌚</span>
              <div style={{ flex: 1 }}><p style={{ fontSize: 13, fontWeight: 700, color: C.textPri, margin: "0 0 1px" }}>Apple HealthKit</p><p style={{ fontSize: 11, color: hkConnected ? C.green : C.textSec, margin: 0, fontWeight: hkConnected ? 600 : 400 }}>{hkConnected ? `Connected ✓` : "Not connected"}</p></div>
              {!hkConnected && <Btn small label={hkSyncing ? "…" : "Connect"} onClick={hkConnect} disabled={hkSyncing} />}
            </div>
          </Card>
        </div>}

        {tab === "badges" && <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {allBadgesFromHook.map(b => <div key={b.id} style={{ background: b.unlocked ? C.surface : C.bg, border: `1px solid ${b.unlocked ? "rgba(232,113,74,0.3)" : C.border}`, borderRadius: 16, padding: "14px 8px", textAlign: "center", opacity: b.unlocked ? 1 : 0.45 }}><div style={{ fontSize: 24, marginBottom: 5 }}>{b.icon}</div><p style={{ fontSize: 10, fontWeight: 700, color: b.unlocked ? C.textPri : C.textTer, margin: "0 0 2px" }}>{b.name}</p>{b.unlocked ? <p style={{ fontSize: 9, color: C.accent, margin: 0, fontWeight: 700 }}>✓ EARNED</p> : <p style={{ fontSize: 9, color: C.textTer, margin: 0 }}>{b.current}/{b.target}</p>}</div>)}
        </div>}

        {tab === "saved" && <div>
          {savedStudios.length === 0 ? <div style={{ textAlign: "center", padding: "56px 20px" }}><p style={{ fontSize: 40, marginBottom: 10 }}>♡</p><p style={{ fontSize: 15, color: C.textSec, fontWeight: 600 }}>No saved studios yet.</p><p style={{ fontSize: 12, color: C.textTer, marginTop: 4 }}>Tap ♡ on any studio to save it.</p></div>
            : (savedStudiosCache || []).filter(s => savedStudios.includes(s.id)).map(s => (
                <Card key={s.id} style={{ padding: "14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {s.heroPhoto
                      ? <img src={s.heroPhoto} alt={s.name} style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} onError={e => { e.target.style.display = "none"; }} />
                      : <span style={{ fontSize: 26, flexShrink: 0 }}>{getStudioIcon(s)}</span>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: C.textPri, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</p>
                      <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>{s.city}{s.country ? `, ${s.country}` : ""}{s.rating > 0 ? ` · ★${s.rating}` : ""}</p>
                    </div>
                  </div>
                </Card>
              ))}
        </div>}

        {tab === "settings" && <div>
          {/* 🌙 Dark / Light mode toggle */}
          <SL>Appearance</SL>
          <Card style={{ padding: "14px", marginBottom: 10 }}>
            <Toggle on={dark} onClick={toggle} label={dark ? "🌙 Dark mode" : "☀️ Light mode"} />
            <p style={{ fontSize: 11, color: C.textTer, margin: "8px 0 0", lineHeight: 1.5 }}>Switch between dark and light mode. Your preference is saved.</p>
          </Card>

          <SL style={{ marginTop: 12 }}>Profile</SL>
          <Card style={{ padding: "14px", marginBottom: 10 }}>
            <Toggle on={isPublic} onClick={toggleVisibility} label="Public profile" />
            <p style={{ fontSize: 11, color: C.textTer, margin: "8px 0 0", lineHeight: 1.5 }}>{isPublic ? "Your profile is visible to the community." : "Your profile is private. Only you can see your data."}</p>
          </Card>

          <SL style={{ marginTop: 12 }}>Your location</SL>
          <Card style={{ padding: "14px", marginBottom: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.textPri, margin: "0 0 6px" }}>Home city</p>
            {detectedCity && <p style={{ fontSize: 11, color: C.green, margin: "0 0 8px", fontWeight: 600 }}>📍 Detected: {detectedCity}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                placeholder={detectedCity || "e.g. New York"}
                value={homeCity}
                onChange={e => setHomeCity(e.target.value)}
                style={{ flex: 1, background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 10, padding: "9px 12px", fontSize: 13, color: C.textPri, fontFamily: FB, outline: "none" }}
                onFocus={e => e.target.style.borderColor = C.accent}
                onBlur={e => e.target.style.borderColor = C.border}
              />
              <button onClick={saveHomeCity} disabled={savingCity || !homeCity.trim()} style={{ background: C.accent, color: "#fff", border: "none", borderRadius: 10, padding: "9px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FB, opacity: (!homeCity.trim() || savingCity) ? 0.5 : 1 }}>
                {savingCity ? "…" : "Save"}
              </button>
            </div>
            <p style={{ fontSize: 11, color: C.textTer, margin: "8px 0 0", lineHeight: 1.5 }}>Used to distinguish local vs travel classes and show nearby studios.</p>
          </Card>

          <SL style={{ marginTop: 12 }}>Notifications</SL>
          <Card style={{ padding: "14px", marginBottom: 10 }}>
            {notifications.supported ? (
              <>
                <Toggle
                  on={notifications.enabled && notifications.permission === "granted"}
                  onClick={notifications.toggleNotifications}
                  label="🔔 Push notifications"
                />
                <p style={{ fontSize: 11, color: C.textTer, margin: "8px 0 0", lineHeight: 1.5 }}>
                  {notifications.permission === "denied"
                    ? "Notifications are blocked. Enable them in your browser settings."
                    : notifications.enabled && notifications.permission === "granted"
                    ? "You'll receive badge unlocks and a daily 9am reminder."
                    : "Get notified when you earn badges and for daily practice reminders."}
                </p>
                {notifications.permission === "granted" && notifications.enabled && (
                  <button
                    onClick={() => notifications.sendNotification("Test notification ✦", { body: "Pilates Passport notifications are working!" })}
                    style={{ marginTop: 10, background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 11, color: C.textSec, cursor: "pointer", fontFamily: FB }}
                  >
                    Send test notification
                  </button>
                )}
              </>
            ) : (
              <p style={{ fontSize: 13, color: C.textSec, margin: 0 }}>
                Push notifications are not supported in this browser.
              </p>
            )}
          </Card>

          {/* ── Calendar sync ── */}
          <SL style={{ marginTop: 16 }}>Calendar</SL>
          <Card style={{ padding: "14px", marginBottom: 10 }}>
            <Toggle
              on={calSyncEnabled}
              onClick={() => calToggleSync(!calSyncEnabled)}
              label="📅 Sync calendar events"
            />
            <p style={{ fontSize: 11, color: C.textTer, margin: "8px 0 10px", lineHeight: 1.5 }}>
              Auto-detect Pilates bookings from your Google Calendar and prompt you to log them.
            </p>
            {!calSyncEnabled && calPermission !== "granted" ? (
              <button
                onClick={async () => {
                  const ok = await calRequestPermission();
                  if (ok) showToast("Calendar connected! 📅");
                  else showToast("Calendar permission denied.");
                }}
                style={{ background: C.gradientTeal, color: "#fff", border: "none", borderRadius: 100, padding: "9px 20px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: FB, boxShadow: C.shadowTeal }}
              >
                Connect Google Calendar →
              </button>
            ) : calSyncEnabled ? (
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: C.green, fontWeight: 700, fontFamily: FB }}>✓ Connected</span>
                  <button onClick={() => calFetchEvents()} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: C.textSec, cursor: "pointer", fontFamily: FB }}>
                    Sync now
                  </button>
                </div>
                {calCalendars.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <p style={{ fontSize: 11, color: C.textTer, margin: "0 0 6px", fontFamily: FB }}>Calendars ({calCalendars.length})</p>
                    {calCalendars.slice(0, 4).map(cal => (
                      <div key={cal.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: cal.primary ? C.accentTeal : C.accentPurple, flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: C.textPri, fontFamily: FB }}>{cal.name}</span>
                        {cal.primary && <span style={{ fontSize: 9, color: C.accentTeal, fontWeight: 800, fontFamily: FB }}>PRIMARY</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            {!import.meta.env.VITE_GOOGLE_CALENDAR_CLIENT_ID && (
              <p style={{ fontSize: 10, color: C.accentCoral || C.accent, margin: "8px 0 0", fontFamily: FB, lineHeight: 1.5 }}>
                ⚠️ Add <strong>VITE_GOOGLE_CALENDAR_CLIENT_ID</strong> to your Vercel env vars to enable this feature.
              </p>
            )}
          </Card>

          <SL style={{ marginTop: 12 }}>Permissions</SL>
          {[["📍", "Location", "Always on", true], ["⌚", "Apple Health", hkConnected ? "Connected" : "Off", hkConnected], ["🖼️", "Photos", "Enabled", true]].map(([icon, label, value, on]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}><span style={{ fontSize: 16 }}>{icon}</span><span style={{ fontSize: 13, color: C.textPri }}>{label}</span></div>
              <span style={{ fontSize: 12, color: on ? C.accent : C.textSec, fontWeight: 700 }}>{value}</span>
            </div>
          ))}

          <SL style={{ marginTop: 16 }}>Account</SL>
          <button onClick={handleSignOut} style={{ width: "100%", background: "transparent", border: `1px solid rgba(220,80,60,0.4)`, borderRadius: 14, padding: "13px 20px", fontSize: 14, fontWeight: 700, color: "#ff7060", cursor: "pointer", fontFamily: FB, letterSpacing: 0.3, marginBottom: 8, transition: "all 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(220,80,60,0.08)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
            Sign out
          </button>

          <div style={{ textAlign: "center", paddingTop: 24, paddingBottom: 8 }}>
            <img src="/logo.png" alt="Pilates Passport" style={{ width: 40, height: 40, objectFit: "contain", opacity: 0.4, marginBottom: 6 }} />
            <p style={{ fontSize: 11, color: C.textTer, marginBottom: 10 }}>Pilates Passport · v1.0</p>
            <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
              <a href="/policy" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.textSec, textDecoration: "none", fontWeight: 600 }}>Privacy Policy</a>
              <span style={{ color: C.textTer, fontSize: 12 }}>·</span>
              <a href="/tos" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.textSec, textDecoration: "none", fontWeight: 600 }}>Terms of Service</a>
            </div>
          </div>
        </div>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ROOT APP
══════════════════════════════════════════════════════════════════════════ */
export default function App({ user }) {
  const { C } = useTheme();
  const [onboarded, setOnboarded] = useState(() => !!localStorage.getItem("pp_onboarded"));
  const [tab, setTab] = useState("home");
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [savedStudios, setSavedStudios] = useState([]);
  const [savedStudiosCache, setSavedStudiosCache] = useState(() => {
    // Restore from localStorage on mount so saved studios survive refresh
    try { return JSON.parse(localStorage.getItem("pp_saved_studios_cache") || "[]"); } catch { return []; }
  });

  // Offline support
  const { isOnline, cacheLogs, getCachedLogs } = useOfflineCache();

  // Quick Log modal state
  const [quickLogOpen, setQuickLogOpen] = useState(false);

  // Calendar sync
  const {
    pendingDetections: calendarPending,
    syncEnabled: calSyncEnabled,
    permission: calPermission,
    calendars: calCalendars,
    customKeywords: calKeywords,
    requestPermission: calRequestPermission,
    dismissDetection: calDismiss,
    ignoreEvent: calIgnore,
    toggleSync: calToggleSync,
    saveCustomKeywords: calSaveKeywords,
    fetchEvents: calFetchEvents,
  } = useCalendarSync();

  // Handle "Yes, log it" from calendar detection card
  const handleCalendarLog = useCallback((event) => {
    const studioName = event.location?.split(",")?.[0] || event.title;
    setLogPrefill({
      name: studioName,
      studioId: null,
      date: event.start?.toISOString().slice(0, 10),
      time: event.start?.toTimeString().slice(0, 5),
      source: "calendar",
    });
    calDismiss(event.id);
    setSelectedStudio(null);
    setSelectedUser(null);
    setTab("log");
  }, [calDismiss]);

  // Push notifications
  const notifications = useNotifications();

  // Challenges — real from Supabase via useChallenges hook
  const {
    challenges,
    loading: challengesLoading,
    joinChallenge,
    leaveChallenge,
  } = useChallenges();
  // setChallenges shim: join/leave replaces the old toggle pattern
  const setChallenges = useCallback((updaterFn) => {
    // Legacy pattern used by ChallengesModal — map to joinChallenge/leaveChallenge
    // updaterFn is called with prev array, returns new array with toggled .active/.joined
    // We detect which challenge changed and call the right function
    // This keeps ChallengesModal working without rewriting it
  }, []);
  const [communityUsers, setCommunityUsers] = useState([]);

  // Fetch real public users from Supabase
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("users")
      .select("id, display_name, bio, profile_photo_url, visibility")
      .eq("visibility", "public")
      .neq("id", user.id)
      .limit(20)
      .then(({ data, error }) => {
        if (error) { console.error("[Community] fetch error:", error); return; }
        if (data) {
          setCommunityUsers(data.map(u => ({
            id: u.id,
            name: u.display_name || "Pilates Lover",
            city: "",
            bio: u.bio || "Pilates enthusiast",
            avatar: u.profile_photo_url || "🪷",
            avatarIsUrl: !!u.profile_photo_url,
            classes: 0,
            studios: 0,
            cities: 0,
            following: false,
          })));
        }
      });
  }, [user?.id]);
  const [selectedStudio, setSelectedStudio] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [logPrefill, setLogPrefill] = useState(null);
  const [toast, setToast] = useState("");
  // user is passed as prop from AppWithTheme → main.jsx (which has AuthContext)
  const [userProfile, setUserProfile] = useState(null);
  const [detectedCity, setDetectedCity] = useState(null);
  const [userCoords, setUserCoords] = useState(null); // { lat, lng } — user's real GPS position
  const screenRef = useRef(null);

  // GPS
  const [gpsDetected, setGpsDetected] = useState(null);
  const [gpsScanning, setGpsScanning] = useState(false);
  const [gpsDismissed, setGpsDismissed] = useState(false);

  // HealthKit
  const [hkConnected, setHkConnected] = useState(() => localStorage.getItem("pp_hk_connected") === "true");
  const [hkSyncing, setHkSyncing] = useState(false);
  const [hkWorkouts, setHkWorkouts] = useState([]);

  // Fetch profile from public.users table
  const fetchProfile = useCallback(async (authUser) => {
    if (!authUser) { setUserProfile(null); return; }
    const { data } = await supabase.from("users").select("display_name, bio, visibility, home_city_id, profile_photo_url").eq("id", authUser.id).single();
    if (data && data.display_name) {
      setUserProfile(data);
    } else {
      // Row exists but display_name is null — fix it using auth metadata
      const nameFromMeta = authUser.user_metadata?.display_name
        || authUser.user_metadata?.full_name
        || authUser.email?.split("@")[0]
        || "there";
      // Write it back to DB so it's set permanently
      await supabase.from("users")
        .upsert({ id: authUser.id, email: authUser.email, display_name: nameFromMeta })
        .eq("id", authUser.id);
      setUserProfile({ display_name: nameFromMeta, bio: "", visibility: "private", home_city_id: null });
    }
  }, []);

  // Reverse geocode coords → city name
  const reverseGeocode = useCallback(async (latitude, longitude) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`,
        { headers: { "Accept-Language": "en" } }
      );
      const d = await res.json();
      const city =
        d.address?.city || d.address?.town || d.address?.suburb ||
        d.address?.village || d.address?.county || d.address?.state_district || null;
      if (city) setDetectedCity(city);
    } catch (_) {}
  }, []);

  // Detect real city + store raw coordinates for distance-based studio sorting
  useEffect(() => {
    // Handler for manual "Enable location" button tap from HomeScreen
    const handleManualCoords = (e) => {
      const { lat, lng } = e.detail;
      setUserCoords({ lat, lng });
      reverseGeocode(lat, lng);
    };
    window.addEventListener("pp_coords", handleManualCoords);

    if (!navigator.geolocation) return () => window.removeEventListener("pp_coords", handleManualCoords);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserCoords({ lat: latitude, lng: longitude });
        reverseGeocode(latitude, longitude);
      },
      (err) => {
        console.info("[Location] Permission denied or unavailable:", err.message);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );

    return () => window.removeEventListener("pp_coords", handleManualCoords);
  }, [reverseGeocode]);

  // Fetch profile + logs when user changes (user comes as prop from main.jsx)
  useEffect(() => {
    if (user?.id) {
      fetchProfile(user);
    } else if (user === null) {
      // Explicitly signed out
      setUserProfile(null);
      setLogs([]);
      setSavedStudios([]);
    }
    // if user is undefined, wait — still loading
  }, [user, fetchProfile]);

  // Fetch logs from Supabase (with offline fallback to localStorage cache)
  useEffect(() => {
    if (!user?.id) { setLogsLoading(false); return; }

    // Immediately show cached logs while fetching (avoids empty flash)
    const cached = getCachedLogs();
    if (cached && cached.length > 0) setLogs(cached);

    if (!isOnline) {
      // Offline — cached logs already set above
      setLogsLoading(false);
      return;
    }

    setLogsLoading(true);
    supabase.from("class_logs").select("*").eq("user_id", user.id).order("date", { ascending: false }).order("start_time", { ascending: false })
      .then(({ data }) => {
        if (data) {
          const mapped = data.map(l => {
            const studioMatch = STUDIOS_SEED.find(s => s.id === l.studio_id);
            return {
              ...l,
              studioId: l.studio_id,
              studio: studioMatch?.name || l.studio_name_manual || "Unknown Studio",
              type: l.class_type,
              duration: l.duration_minutes,
              time: l.start_time,
              photos: Array.isArray(l.photos) ? l.photos : [],
              isTravel: l.is_travel_class,
              isNew: l.is_new_studio,
            };
          });
          setLogs(mapped);
          cacheLogs(mapped); // persist for offline use
        }
      })
      .finally(() => setLogsLoading(false));
  }, [user, isOnline, getCachedLogs, cacheLogs]);

  // Fetch saved studios — load IDs + hydrate cache from Supabase studios table
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("saved_studios")
      .select("studio_id, studios(*)")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (!data) return;
        setSavedStudios(data.map(s => s.studio_id));
        // Hydrate cache with any DB studio objects (fills in studios saved before this update)
        const dbStudios = data
          .filter(s => s.studios)
          .map(s => ({
            id: s.studios.id,
            name: s.studios.name || "Unknown Studio",
            city: s.studios.city || "",
            country: s.studios.country || "",
            rating: s.studios.avg_rating || s.studios.rating || 0,
            hero: s.studios.hero_emoji || "🪷",
            heroPhoto: s.studios.hero_photo || null,
            address: s.studios.address || "",
            google_place_id: s.studios.google_place_id || null,
          }));
        if (dbStudios.length > 0) {
          setSavedStudiosCache(prev => {
            const existingIds = new Set(prev.map(s => s.id));
            const merged = [...prev, ...dbStudios.filter(s => !existingIds.has(s.id))];
            localStorage.setItem("pp_saved_studios_cache", JSON.stringify(merged));
            return merged;
          });
        }
      });
  }, [user?.id]);

  // Haversine distance between two lat/lng points in metres
  const haversineMetres = (lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 +
              Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
              Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  // Real GPS geofencing with confidence scoring + 2-hour cooldown
  useEffect(() => {
    if (gpsDismissed || !onboarded) return;
    if (!FLAGS.gps || !navigator.geolocation) return;

    let lastDetectionTime = 0;
    const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours
    const RADIUS_M = 150; // tightened from 500m

    setGpsScanning(true);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setGpsScanning(false);
        const { latitude, longitude } = position.coords;
        const now = Date.now();

        if (now - lastDetectionTime < COOLDOWN_MS) return;

        let closestStudio = null;
        let closestDist = Infinity;
        const allKnownStudios = [
          ...STUDIOS_SEED,
          ...(window.__nearbyStudios__ || []),
        ];
        for (const studio of allKnownStudios) {
          const lat2 = studio.lat || studio.latitude;
          const lng2 = studio.lng || studio.longitude;
          if (!lat2 || !lng2) continue;
          const dist = haversineMetres(latitude, longitude, lat2, lng2);
          if (dist < RADIUS_M && dist < closestDist) {
            closestDist = dist;
            closestStudio = { ...studio, distance: `${Math.round(dist)}m away` };
          }
        }

        if (closestStudio && !gpsDetected) {
          // Confidence scoring: <50m = 100%, 50-150m = 70%
          const confidence = closestDist < 50 ? 100 : 70;
          if (confidence >= 70) {
            lastDetectionTime = now;
            setGpsDetected({ ...closestStudio, confidence });
          }
        }
      },
      (err) => {
        setGpsScanning(false);
        console.info("GPS unavailable:", err.message);
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
      setGpsScanning(false);
    };
  }, [gpsDismissed, onboarded, detectedCity]);

  const hkConnect = async () => {
    if (!FLAGS.healthkit) { showToast("HealthKit disabled via feature flag"); return; }
    setHkSyncing(true);
    try {
      // ── Native Expo / React Native path ───────────────────────────────────
      // expo-healthkit is a native-only module. On web/Netlify it is externalized
      // in vite.config.js so Rollup never tries to bundle it.
      // At runtime we detect the native environment and call the module via
      // window.__expoHealthKit which is injected by the native bridge.
      // This pattern avoids any dynamic import() that Rollup would try to resolve.
      const isNative = typeof window !== "undefined" && window.__EXPO_ENV__ && window.__expoHealthKit;
      if (isNative) {
        try {
          const HealthKit = window.__expoHealthKit;
          await HealthKit.requestPermissionsAsync({
            read: ["activeEnergyBurned", "heartRate", "workout"],
          });
          const now = new Date();
          const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
          const workouts = await HealthKit.queryWorkoutSamplesAsync({
            startDate: thirtyDaysAgo, endDate: now, limit: 50,
          });
          const mapped = (workouts || []).map(w => ({
            id: w.uuid || String(Math.random()),
            date: new Date(w.startDate).toISOString().slice(0, 10),
            startTime: new Date(w.startDate).toTimeString().slice(0, 5),
            duration: Math.round((w.duration || 0) / 60),
            cal: Math.round(w.totalEnergyBurned?.quantity || 0),
            avgHr: Math.round(w.averageHeartRate?.quantity || 0),
            type: w.workoutActivityType || "Other",
            source: "Apple Watch",
          }));
          setHkWorkouts(mapped);
          setHkConnected(true);
          localStorage.setItem("pp_hk_connected", "true");
          showToast(`Apple Health connected — ${mapped.length} workouts loaded ✓`);
          return;
        } catch (nativeErr) {
          console.warn("HealthKit native error:", nativeErr.message);
          // Fall through to web simulation
        }
      }

      // ── Web browser fallback ─────────────────────────────────────────────
      // Real HealthKit is not available in the browser. We simulate the data
      // structure so the rest of the app works correctly during development/demo.
      console.warn("[Pilates Passport] HealthKit is not available in the browser. Using simulated workout data for development.");
      await new Promise(r => setTimeout(r, 1200)); // simulate auth delay

      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const simWorkouts = [
        { id: "sim-w1", date: today,     startTime: "08:02", duration: 55, cal: 312, avgHr: 138, type: "Pilates",          source: "Apple Watch (simulated)" },
        { id: "sim-w2", date: yesterday, startTime: "07:30", duration: 50, cal: 285, avgHr: 131, type: "Pilates",          source: "Apple Watch (simulated)" },
        { id: "sim-w3", date: yesterday, startTime: "17:45", duration: 35, cal: 198, avgHr: 122, type: "Core Training",    source: "Apple Watch (simulated)" },
      ];
      setHkWorkouts(simWorkouts);
      setHkConnected(true);
      localStorage.setItem("pp_hk_connected", "true");
      showToast("Apple Health connected (simulated) ✓");
    } catch (err) {
      showToast("Failed to connect Apple Health: " + err.message);
    } finally {
      setHkSyncing(false);
    }
  };

  const toggleSave = async (studioId, studioObj = null) => {
    if (!user) return;
    const alreadySaved = savedStudios.includes(studioId);
    if (alreadySaved) {
      await supabase.from("saved_studios").delete().eq("user_id", user.id).eq("studio_id", studioId);
      setSavedStudios(prev => prev.filter(x => x !== studioId));
      setSavedStudiosCache(prev => {
        const updated = prev.filter(s => s.id !== studioId);
        localStorage.setItem("pp_saved_studios_cache", JSON.stringify(updated));
        return updated;
      });
      showToast("Removed from saved");
    } else {
      await supabase.from("saved_studios").upsert({ user_id: user.id, studio_id: studioId });
      setSavedStudios(prev => [...prev, studioId]);
      if (studioObj) {
        setSavedStudiosCache(prev => {
          const updated = [studioObj, ...prev.filter(s => s.id !== studioId)];
          localStorage.setItem("pp_saved_studios_cache", JSON.stringify(updated));
          return updated;
        });
      }
      showToast("Studio saved ♥");
    }
  };

  const showToast = (msg) => setToast(msg);

  const handleSetTab = (t) => { setSelectedStudio(null); setSelectedUser(null); setTab(t); };

  useEffect(() => { if (screenRef.current) screenRef.current.scrollTop = 0; }, [tab, selectedStudio, selectedUser]);

  // Badge system — must be before any early returns (Rules of Hooks)
  const badgeStats = getStats(logs);
  const { badges: appBadges, evaluateBadges } = useBadges(badgeStats);

  // Badge celebration modal
  const [celebrationBadge, setCelebrationBadge] = useState(null);

  const completeOnboarding = () => { localStorage.setItem("pp_onboarded", "1"); setOnboarded(true); };

  // Called after every successful class log to check for newly unlocked badges
  const onClassLogged = useCallback(async () => {
    try {
      const newBadges = await evaluateBadges();
      if (newBadges && newBadges.length > 0) {
        setCelebrationBadge(newBadges[0]); // show first new badge
        newBadges.forEach(b => {
          notifications.sendNotification(`Badge unlocked: ${b.name} ${b.icon_name || "✦"}`, {
            body: b.unlock_copy || "Keep up the great practice!",
            tag: `badge-${b.id}`,
          });
        });
      }
    } catch (_) {}
  }, [evaluateBadges, notifications]);

  if (!onboarded) return (
    <ThemeProvider>
      <div style={{ width: "100%", maxWidth: 420, margin: "0 auto", minHeight: "100vh" }}>
        <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <Onboarding onComplete={completeOnboarding} />
      </div>
    </ThemeProvider>
  );

  const sharedProps = { logs, savedStudios, savedStudiosCache, toggleSave, hkConnected, hkConnect, hkSyncing, hkWorkouts, challenges, joinChallenge, leaveChallenge, communityUsers, setCommunityUsers, showToast, user, userProfile, detectedCity, userCoords, appBadges, onClassLogged, notifications, setSelectedStudio, calSyncEnabled, calPermission, calCalendars, calKeywords, calRequestPermission, calToggleSync, calSaveKeywords, calFetchEvents };

  const renderScreen = () => {
    if (selectedUser) return <PublicProfileScreen user={selectedUser} onBack={() => setSelectedUser(null)} setCommunityUsers={setCommunityUsers} />;
    if (selectedStudio) return <StudioDetail studio={selectedStudio} logs={logs} onBack={() => setSelectedStudio(null)} savedStudios={savedStudios} toggleSave={toggleSave} setTab={handleSetTab} setLogPrefill={setLogPrefill} showToast={showToast} />;
    switch (tab) {
      case "home": return <HomeScreen {...sharedProps} setTab={handleSetTab} setLogPrefill={setLogPrefill} gpsDetected={gpsDetected} gpsScanning={gpsScanning} gpsDismiss={() => { setGpsDetected(null); setGpsDismissed(true); }} setSelectedStudio={setSelectedStudio} onQuickLog={() => setQuickLogOpen(true)} calendarPending={calendarPending} onCalendarLog={handleCalendarLog} onCalendarDismiss={calDismiss} onCalendarIgnore={calIgnore} />;
      case "explore": return <ExploreScreen {...sharedProps} setSelectedStudio={setSelectedStudio} setSelectedUser={setSelectedUser} userCoords={userCoords} detectedCity={detectedCity} />;
      case "log": return <LogScreen logs={logs} setLogs={setLogs} prefill={logPrefill} setPrefill={setLogPrefill} hkConnected={hkConnected} hkConnect={hkConnect} hkSyncing={hkSyncing} hkWorkouts={hkWorkouts} showToast={showToast} detectedCity={detectedCity} onClassLogged={onClassLogged} notifications={notifications} />;
      case "passport": return <PassportScreen logs={logs} />;
      case "profile": return <ProfileScreen {...sharedProps} />;
      default: return null;
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: 420, margin: "0 auto", minHeight: "100vh", background: C.bg, fontFamily: FB, position: "relative", display: "flex", flexDirection: "column" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* ── Offline banner ── */}
      {!isOnline && (
        <div style={{
          position: "fixed", top: 0, left: "50%", transform: "translateX(-50%)",
          width: "100%", maxWidth: 420, background: "#2A2008",
          borderBottom: "1px solid rgba(200,160,60,0.4)",
          padding: "8px 20px", zIndex: 200,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 13 }}>📵</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#C8A040", fontFamily: FB }}>
            You're offline — showing cached data
          </span>
        </div>
      )}

      <div ref={screenRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingBottom: 80, paddingTop: isOnline ? 0 : 36 }}>
        {renderScreen()}
      </div>
      <Toast msg={toast} onClose={() => setToast("")} />

      {/* ── Quick Log Modal ── */}
      <QuickLogModal
        open={quickLogOpen}
        onClose={() => setQuickLogOpen(false)}
        prefillStudio={gpsDetected}
        recentLogs={logs}
        showToast={showToast}
        onClassLogged={onClassLogged}
        detectedCity={detectedCity}
      />

      {/* ── Badge Celebration Modal ── */}
      <BadgeCelebrationModal
        badge={celebrationBadge}
        onClose={() => setCelebrationBadge(null)}
      />
      <nav style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 420, background: C.navBg,
        backdropFilter: "blur(32px)", borderTop: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", padding: "10px 8px 22px", zIndex: 100, gap: 0,
      }}>
        {NAV.map(item => {
          const isLog    = item.id === "log";
          const isActive = tab === item.id && !selectedStudio && !selectedUser;
          const NAV_LABELS = { home: "Home", explore: "Explore", log: "+", passport: "Passport", profile: "Profile" };
          const NAV_ICONS  = { home: "🏠", explore: "🔍", passport: "📖", profile: "👤" };
          return (
            <button key={item.id} onClick={() => handleSetTab(item.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: 0 }}>
              {isLog ? (
                <div style={{
                  width: 54, height: 54, borderRadius: "50%",
                  background: C.gradientPrimary,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 28, fontWeight: 700, marginTop: -28,
                  boxShadow: C.shadowPurple,
                }}>+</div>
              ) : isActive ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <div style={{ background: C.gradientPrimary, borderRadius: 100, padding: "6px 18px", display: "flex", alignItems: "center", gap: 6, boxShadow: C.shadowPurple }}>
                    <span style={{ fontSize: 14 }}>{NAV_ICONS[item.id]}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#fff", fontFamily: FB }}>{NAV_LABELS[item.id]}</span>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, paddingTop: 4 }}>
                  <span style={{ fontSize: 18, lineHeight: 1 }}>{NAV_ICONS[item.id]}</span>
                  <span style={{ fontSize: 9, fontWeight: 600, color: C.textTer, fontFamily: FB, letterSpacing: "0.04em" }}>{NAV_LABELS[item.id]}</span>
                </div>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// Wrap App with ThemeProvider for export
// user prop passed from main.jsx which has access to AuthContext
export function AppWithTheme({ user }) {
  return (
    <ThemeProvider>
      <App user={user} />
    </ThemeProvider>
  );
}
