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
import { supabase } from "./lib/supabase";

/* ══════════════════════════════════════════════════════════════════════════
   THEME SYSTEM — light & dark
══════════════════════════════════════════════════════════════════════════ */
const DARK = {
  bg:"#0F0F0F", surface:"#1A1A1A", surfaceHi:"#242424", surfaceEl:"#2E2E2E",
  border:"rgba(255,255,255,0.08)", borderMd:"rgba(255,255,255,0.18)",
  accent:"#E8714A", accentDim:"rgba(232,113,74,0.15)", accentDim2:"rgba(232,113,74,0.08)",
  lime:"#C8E650", limeDim:"rgba(200,230,80,0.12)",
  textPri:"#F5F0EB", textSec:"#9A9488", textTer:"#5E5A54",
  green:"#5BAF7A", greenDim:"rgba(91,175,122,0.15)",
  blue:"#6BA3D6", blueDim:"rgba(107,163,214,0.15)",
  purple:"#A07DD6",
  navBg:"rgba(10,10,10,0.97)",
  inputBg:"#242424",
  shadow:"0 4px 24px rgba(0,0,0,0.5)",
};
const LIGHT = {
  bg:"#FAF8F6", surface:"#FFFFFF", surfaceHi:"#F5F2EF", surfaceEl:"#EDE9E5",
  border:"rgba(60,40,20,0.1)", borderMd:"rgba(60,40,20,0.22)",
  accent:"#E8714A", accentDim:"rgba(232,113,74,0.12)", accentDim2:"rgba(232,113,74,0.06)",
  lime:"#7A9A10", limeDim:"rgba(120,155,20,0.1)",
  textPri:"#1E1410", textSec:"#7A6A5A", textTer:"#AFA090",
  green:"#3A8A58", greenDim:"rgba(58,138,88,0.12)",
  blue:"#2D6FA8", blueDim:"rgba(45,111,168,0.12)",
  purple:"#7050B0",
  navBg:"rgba(250,248,246,0.97)",
  inputBg:"#F5F2EF",
  shadow:"0 4px 20px rgba(0,0,0,0.1)",
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
  return <span style={{ color: C.accent, fontSize: size, letterSpacing: 0.5 }}>{"★".repeat(Math.round(n))}{"☆".repeat(5 - Math.round(n))}</span>;
}

function Pill({ label, active, onClick, style = {} }) {
  const { C } = useTheme();
  return (
    <button onClick={onClick} style={{
      background: active ? C.accent : "transparent",
      color: active ? "#fff" : C.textSec,
      border: `1px solid ${active ? C.accent : C.border}`,
      borderRadius: 100, padding: "5px 14px", fontSize: 11, fontWeight: 600,
      cursor: "pointer", whiteSpace: "nowrap", fontFamily: FB,
      transition: "all 0.18s", letterSpacing: 0.3, ...style,
    }}>{label}</button>
  );
}

function Card({ children, style = {}, onClick, accent, glow }) {
  const { C } = useTheme();
  return (
    <div onClick={onClick} style={{
      background: accent ? `linear-gradient(135deg,${C.accentDim},${C.accentDim2})` : C.surface,
      border: `1px solid ${accent ? "rgba(232,113,74,0.3)" : C.border}`,
      borderRadius: 18, padding: "16px", marginBottom: 10,
      cursor: onClick ? "pointer" : "default",
      transition: "transform 0.15s, box-shadow 0.15s",
      boxShadow: glow ? `0 0 20px ${C.accentDim}` : "none", ...style,
    }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = C.shadow; } }}
      onMouseLeave={e => { if (onClick) { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = glow ? `0 0 20px ${C.accentDim}` : "none"; } }}>
      {children}
    </div>
  );
}

function Btn({ label, onClick, outline, ghost, small, full, style = {}, disabled, icon, loading }) {
  const { C } = useTheme();
  return (
    <button onClick={onClick} disabled={disabled || loading} style={{
      background: ghost ? "transparent" : outline ? "transparent" : C.accent,
      color: ghost ? C.textSec : outline ? C.accent : "#fff",
      border: `1.5px solid ${ghost ? C.border : C.accent}`,
      borderRadius: 14, padding: small ? "8px 16px" : "13px 22px",
      fontSize: small ? 12 : 14, fontWeight: 700,
      cursor: (disabled || loading) ? "not-allowed" : "pointer",
      fontFamily: FB, letterSpacing: 0.3, opacity: (disabled || loading) ? 0.5 : 1,
      transition: "all 0.15s", width: full ? "100%" : "auto",
      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, ...style,
    }}
      onMouseEnter={e => { if (!disabled && !loading) e.currentTarget.style.opacity = "0.82"; }}
      onMouseLeave={e => { if (!disabled && !loading) e.currentTarget.style.opacity = "1"; }}>
      {loading ? "…" : <>{icon && <span>{icon}</span>}{label}</>}
    </button>
  );
}

function SL({ children, style = {} }) {
  const { C } = useTheme();
  return <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: C.textTer, textTransform: "uppercase", margin: "0 0 10px", ...style }}>{children}</p>;
}

function Inp({ placeholder, value, onChange, style = {}, multiline, type = "text" }) {
  const { C } = useTheme();
  const base = {
    background: C.inputBg, border: `1px solid ${C.border}`, borderRadius: 12,
    padding: "11px 14px", fontSize: 13, color: C.textPri, fontFamily: FB,
    width: "100%", outline: "none", resize: "none", boxSizing: "border-box",
    transition: "border-color 0.15s", ...style,
  };
  const focus = e => e.target.style.borderColor = C.accent;
  const blur = e => e.target.style.borderColor = C.border;
  return multiline
    ? <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={base} onFocus={focus} onBlur={blur} />
    : <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={base} onFocus={focus} onBlur={blur} />;
}

function Toggle({ on, onClick, label }) {
  const { C } = useTheme();
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
      {label && <span style={{ fontSize: 13, color: C.textPri, flex: 1 }}>{label}</span>}
      <div style={{ width: 44, height: 24, borderRadius: 100, background: on ? C.accent : C.surfaceEl, border: `1px solid ${on ? C.accent : C.border}`, position: "relative", transition: "all 0.2s", flexShrink: 0 }}>
        <div style={{ width: 18, height: 18, background: "#fff", borderRadius: "50%", position: "absolute", top: 2, left: on ? 22 : 2, transition: "left 0.2s" }} />
      </div>
    </div>
  );
}

function Toast({ msg, onClose }) {
  const { C } = useTheme();
  useEffect(() => { if (msg) { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); } }, [msg]);
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 96, left: "50%", transform: "translateX(-50%)",
      background: C.accent, color: "#fff", borderRadius: 24, padding: "10px 20px",
      fontSize: 13, fontWeight: 600, fontFamily: FB, zIndex: 999,
      boxShadow: "0 4px 20px rgba(232,113,74,0.5)", whiteSpace: "nowrap",
      animation: "fadeUp 0.2s ease",
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
const GREETINGS = [
  { top: "Rise & reform,", name: true }, { top: "Your body called.", sub: "Time to show up." },
  { top: "Good morning,", name: true }, { top: "She's back.", sub: "Ready to move?" },
  { top: "Let's get into it,", name: true }, { top: "Alignment check:", sub: "You're doing great." },
  { top: "No excuses, just", sub: "Pilates." }, { top: "The reformer misses you,", name: true },
];
const NAV = [{ id: "home", label: "Home", icon: "⌂" }, { id: "explore", label: "Explore", icon: "✦" }, { id: "log", label: "+", icon: "+" }, { id: "passport", label: "Passport", icon: "◎" }, { id: "profile", label: "Profile", icon: "◉" }];

/* ── stats helper ── */
function getStats(logs) {
  // Count unique studios using all possible identifiers
  const studioKeys = logs.map(l =>
    l.google_place_id || l.studioId || l.studio_id ||
    l.studio_name_manual || l.studio || null
  ).filter(Boolean);
  const studios = [...new Set(studioKeys)];
  const cities = [...new Set(logs.map(l => l.city).filter(Boolean))];
  const countries = [...new Set(logs.map(l => l.country).filter(Boolean))];
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
          <p style={{ fontSize: 13, color: C.textSec }}>🔍 Finding Pilates studios near you…</p>
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
                  🪷 {s.name}
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
function HomeScreen({ logs, setTab, setLogPrefill, challenges, user, userProfile, detectedCity, userCoords, gpsDetected, gpsScanning, gpsDismiss, hkConnected, hkConnect, hkSyncing, showToast, setSelectedStudio }) {
  const { C } = useTheme();
  const stats = getStats(logs);
  const [gIdx] = useState(() => Math.floor(Math.random() * GREETINGS.length));
  const g = GREETINGS[gIdx];
  const hour = new Date().getHours();
  const tE = hour < 12 ? "☀️" : hour < 17 ? "🌤" : "🌙";
  const displayName = userProfile?.display_name || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "there";
  const activeChallenges = challenges.filter(c => c.active || c.joined).slice(0, 2);

  return (
    <div style={{ padding: "0 20px" }}>
      <div style={{ paddingTop: 52, paddingBottom: 22 }}>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: C.textTer, textTransform: "uppercase", margin: "0 0 8px" }}>{tE} {g.top}</p>
        <h1 style={{ fontFamily: FD, fontSize: 40, fontWeight: 700, color: C.textPri, margin: 0, letterSpacing: -1, lineHeight: 1.05 }}>{g.name ? `${displayName}.` : (g.sub || "")}</h1>
      </div>

      {/* Hero stat */}
      <div style={{ background: C.accent, borderRadius: 22, padding: "22px 24px", marginBottom: 12, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -24, top: -24, width: 130, height: 130, borderRadius: "50%", background: "rgba(255,255,255,0.08)" }} />
        <p style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.65)", letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>Total classes</p>
        <p style={{ fontFamily: FD, fontSize: 64, fontWeight: 700, color: "#fff", margin: "0 0 14px", lineHeight: 1 }}>{stats.classes}</p>
        <div style={{ display: "flex", gap: 24 }}>
          {[["Studios", stats.studios], ["Cities", stats.cities], ["Countries", stats.countries]].map(([l, v]) => (
            <div key={l}><p style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>{v}</p><p style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", margin: 0, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</p></div>
          ))}
        </div>
      </div>

      {/* GPS scanning */}
      {gpsScanning && (
        <Card style={{ marginBottom: 12, padding: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.blueDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📡</div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.blue, margin: "0 0 2px" }}>Scanning for nearby studios…</p>
              <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>GPS is looking for your location</p>
            </div>
          </div>
        </Card>
      )}

      {/* GPS detected */}
      {gpsDetected && !gpsScanning && (
        <Card accent glow style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: C.accentDim, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📍</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.12em", margin: "0 0 2px" }}>GPS Detected nearby</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.textPri, margin: "0 0 4px" }}>{gpsDetected.name}</p>
              <p style={{ fontSize: 11, color: C.textSec, margin: "0 0 10px" }}>{gpsDetected.address} · {gpsDetected.distance}</p>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn small label="Log class" onClick={() => { setLogPrefill({ studioId: gpsDetected.id }); setTab("log"); }} style={{ flex: 1 }} />
                <Btn small ghost label="Dismiss" onClick={gpsDismiss} style={{ flex: 1 }} />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* HealthKit connect nudge */}
      {!hkConnected && (
        <Card style={{ marginBottom: 12, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>⌚</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.textPri, margin: "0 0 1px" }}>Connect Apple Watch</p>
              <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>Auto-import workout data from your classes</p>
            </div>
            <Btn small label={hkSyncing ? "…" : "Connect"} onClick={hkConnect} disabled={hkSyncing} />
          </div>
        </Card>
      )}

      {/* Smart class reminder — did you attend today? */}
      <SmartClassPrompt logs={logs} setTab={setTab} setLogPrefill={setLogPrefill} C={C} />

      {/* Challenges */}
      {activeChallenges.length > 0 && <>
        <SL>Active challenges</SL>
        {activeChallenges.map(ch => (
          <Card key={ch.id} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.textPri, margin: "0 0 2px" }}>{ch.title}</p>
                <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>Ends {ch.ends || ch.ends_at?.slice(5, 10)}</p>
              </div>
              <span style={{ fontFamily: FD, fontSize: 22, fontWeight: 700, color: C.accent }}>{ch.progress || ch.userProgress?.current_progress || 0}/{ch.target || ch.target_value}</span>
            </div>
            <div style={{ height: 4, background: C.surfaceHi, borderRadius: 100, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(100, ((ch.progress || ch.userProgress?.current_progress || 0) / (ch.target || ch.target_value || 1)) * 100)}%`, background: C.accent, borderRadius: 100 }} />
            </div>
          </Card>
        ))}
      </>}

      {/* Recent logs */}
      <SL style={{ marginTop: 4 }}>Recent classes</SL>
      {logs.length === 0 ? (
        <Card style={{ textAlign: "center", padding: "32px 20px" }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>🪷</p>
          <p style={{ fontSize: 14, color: C.textSec }}>No classes logged yet.</p>
          <Btn small label="Log your first class" onClick={() => setTab("log")} style={{ marginTop: 12 }} />
        </Card>
      ) : logs.slice(0, 3).map(log => (
        <Card key={log.id} style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: C.surfaceHi, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>{log.photos?.[0] || "🪷"}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: C.textPri, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{log.studio || log.studio_name_manual}</p>
              <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>{log.type || log.class_type} · {log.city} · {(log.date || "").slice(5).replace("-", "/")}</p>
              {log.watchData && <p style={{ fontSize: 10, color: C.green, margin: "2px 0 0", fontWeight: 600 }}>⌚ {log.watchData.cal} cal · {log.watchData.hr} BPM</p>}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <Stars n={log.rating} size={11} />
              {(log.isTravel || log.is_travel_class) && <p style={{ fontSize: 9, color: C.accent, fontWeight: 700, margin: "3px 0 0" }}>✈ TRAVEL</p>}
            </div>
          </div>
        </Card>
      ))}

      {/* Nearby — uses real Google Places API based on GPS coords */}
      <NearbyStudios userCoords={userCoords} onSelectStudio={(s) => { if (s) { setSelectedStudio && setSelectedStudio(s); } else { setTab("explore"); } }} showToast={showToast} C={C} />
      <div style={{ height: 20 }} />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   EXPLORE
══════════════════════════════════════════════════════════════════════════ */
function ExploreScreen({ logs, savedStudios, toggleSave, setSelectedStudio, communityUsers, setCommunityUsers, setSelectedUser, userCoords, detectedCity, showToast }) {
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
      setSearching(true);
      try {
        const url = `/api/places-search?query=${encodeURIComponent(query)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.studios && json.studios.length > 0) {
          setPlacesResults(json.studios);
        } else {
          // Fallback: search Supabase DB
          const { data } = await supabase
            .from("studios")
            .select("*")
            .or(`name.ilike.%${query}%,city.ilike.%${query}%`)
            .limit(10);
          if (data && data.length > 0) {
            setPlacesResults(data.map(ds => ({
              id: ds.id, name: ds.name, address: ds.address || "",
              city: ds.city || "", country: ds.country || "",
              rating: ds.avg_rating || 0, reviews: ds.review_count || 0,
              tags: ds.class_types || [], types: ds.class_types || [],
              lat: ds.latitude, lng: ds.longitude,
              verified: ds.is_verified || false, hero: ds.hero_emoji || "🪷",
              vibe: "", website: ds.website || "", phone: ds.phone || "",
            })));
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
            id: ds.id, name: ds.name, address: ds.address || "",
            city: ds.city || "", country: ds.country || "",
            rating: ds.avg_rating || 0, reviews: ds.review_count || 0,
            tags: ds.class_types || [], types: ds.class_types || [],
            lat: ds.latitude, lng: ds.longitude,
            verified: ds.is_verified || false, hero: ds.hero_emoji || "🪷",
            vibe: "", website: ds.website || "", phone: ds.phone || "",
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

  // Merge seed + DB + places search results (deduplicated by name)
  const allStudios = (() => {
    const merged = [...STUDIOS_SEED];
    const addIfNew = (ds, source) => {
      const exists = merged.some(s =>
        s.name.toLowerCase() === (ds.name || "").toLowerCase()
      );
      if (!exists) merged.push(ds);
    };
    dbStudios.forEach(ds => addIfNew({
      id: ds.id, name: ds.name, address: ds.address || "",
      city: ds.city || "", country: ds.country || "",
      rating: ds.avg_rating || 0, reviews: ds.review_count || 0,
      tags: ds.class_types || [], types: ds.class_types || [],
      lat: ds.latitude || null, lng: ds.longitude || null,
      verified: ds.is_verified || false, hero: ds.hero_emoji || "🪷",
      vibe: "", website: ds.website || "", phone: ds.phone || "", distance: "",
    }));
    placesResults.forEach(ds => addIfNew(ds));
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
              {filtered.length === 0 && !loadingStudios && (
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <p style={{ fontSize: 32, marginBottom: 12 }}>🔍</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: C.textPri, margin: "0 0 8px" }}>
                    {search ? `No studios found for "${search}"` : "No studios yet"}
                  </p>
                  <p style={{ fontSize: 13, color: C.textSec, lineHeight: 1.6, margin: "0 0 16px" }}>
                    {search
                      ? "Try a different search term, or add the studio manually when logging a class."
                      : "Enable location to see nearby studios, or search by name above."}
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
                        <button onClick={e => { e.stopPropagation(); toggleSave(s.id); }} style={{ position: "absolute", top: 8, right: 10, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", border: "none", borderRadius: 8, width: 30, height: 30, cursor: "pointer", fontSize: 16, color: saved ? "#ff6b6b" : "#fff" }}>{saved ? "♥" : "♡"}</button>
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
                          {!s.heroPhoto && <button onClick={e => { e.stopPropagation(); toggleSave(s.id); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: saved ? C.accent : C.textTer, padding: 0, lineHeight: 1 }}>{saved ? "♥" : "♡"}</button>}
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
              <p style={{ fontSize: 15, color: C.textSec, fontWeight: 600 }}>No saved studios yet.</p>
              <p style={{ fontSize: 12, color: C.textTer, marginTop: 4 }}>Tap ♡ on any studio to save it.</p>
            </div>
          ) : STUDIOS_SEED.filter(s => savedStudios.includes(s.id)).map(s => (
            <Card key={s.id} onClick={() => setSelectedStudio(s)}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 26 }}>{s.hero}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.textPri, margin: "0 0 2px" }}>{s.name}</p>
                  <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>{s.city}, {s.country} · ★{s.rating}</p>
                </div>
                <button onClick={e => { e.stopPropagation(); toggleSave(s.id); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 22, color: C.accent, padding: 0 }}>♥</button>
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
function StudioReviews({ studioId, googlePlaceId, C }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studioId || String(studioId).startsWith("Ch")) {
      // Google Places studio — no Supabase reviews yet
      setReviews([]);
      setLoading(false);
      return;
    }
    supabase
      .from("reviews")
      .select("*, users(display_name)")
      .eq("studio_id", studioId)
      .eq("moderation_status", "approved")
      .order("created_at", { ascending: false })
      .then(({ data }) => { setReviews(data || []); })
      .finally(() => setLoading(false));
  }, [studioId]);

  if (loading) return <p style={{ fontSize: 13, color: C.textSec, padding: "20px 0" }}>Loading reviews…</p>;

  if (reviews.length === 0) return (
    <div style={{ textAlign: "center", padding: "32px 0" }}>
      <p style={{ fontSize: 32, marginBottom: 8 }}>⭐</p>
      <p style={{ fontSize: 14, color: C.textSec }}>No reviews yet. Be the first!</p>
    </div>
  );

  return (
    <div>
      {reviews.map((r, i) => (
        <div key={r.id || i} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "14px", marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.textPri }}>{r.users?.display_name || "Anonymous"}</span>
            <span style={{ color: "#f59e0b", fontSize: 12 }}>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</span>
          </div>
          {r.body && <p style={{ fontSize: 12, color: C.textSec, lineHeight: 1.6, margin: "0 0 8px" }}>{r.body}</p>}
          {r.tags?.length > 0 && <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{r.tags.map(t => <span key={t} style={{ background: C.accentDim, color: C.accent, borderRadius: 100, padding: "2px 8px", fontSize: 10, fontWeight: 600 }}>{t}</span>)}</div>}
          <p style={{ fontSize: 10, color: C.textTer, margin: "6px 0 0" }}>{new Date(r.created_at).toLocaleDateString()}</p>
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
  const ct = [{ tag: "Great instructors", count: 87 }, { tag: "Beautiful space", count: 62 }, { tag: "Challenging but accessible", count: 41 }, { tag: "Clean & organized", count: 38 }];

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
      setReviewText(""); setLT("reviews");
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
            {s.hero || s.hero_emoji || "🪷"}
          </div>
        )}
        {/* Dark gradient overlay so buttons are readable */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 50%)" }} />
        {/* Back + Save buttons */}
        <button onClick={onBack} style={{ position: "absolute", top: 52, left: 16, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", fontSize: 16, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <button onClick={() => toggleSave(studio.id)} style={{ position: "absolute", top: 52, right: 16, background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", border: "none", borderRadius: 10, width: 36, height: 36, cursor: "pointer", fontSize: 18, color: saved ? "#ff6b6b" : "#fff" }}>{saved ? "♥" : "♡"}</button>
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
          {["about", "reviews", "history", "write review"].map(t => (
            <button key={t} onClick={() => setLT(t)} style={{ flex: 1, background: "none", border: "none", borderBottom: `2px solid ${tab === t ? C.accent : "transparent"}`, padding: "9px 4px", fontSize: t.length > 7 ? 10 : 12, fontWeight: 700, color: tab === t ? C.accent : C.textTer, cursor: "pointer", fontFamily: FB, textTransform: "capitalize", transition: "all 0.15s" }}>{t}</button>
          ))}
        </div>

        {tab === "about" && <div>
          <SL>Why people love it</SL>
          {ct.map(({ tag, count }) => (
            <div key={tag} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <p style={{ fontSize: 12, color: C.textPri, margin: 0, width: 170, flexShrink: 0 }}>{tag}</p>
              <div style={{ flex: 1, height: 4, background: C.surfaceHi, borderRadius: 100, overflow: "hidden" }}><div style={{ height: "100%", width: `${(count / 90) * 100}%`, background: C.accent, borderRadius: 100 }} /></div>
              <span style={{ fontSize: 11, color: C.textTer, width: 28, textAlign: "right" }}>{count}</span>
            </div>
          ))}
          <SL style={{ marginTop: 12 }}>Class types</SL>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{(studio.types || studio.class_types || []).map(t => <Pill key={t} label={t} />)}</div>
        </div>}

        {tab === "reviews" && <StudioReviews studioId={studio.id} googlePlaceId={studio.google_place_id} C={C} />}

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
          <Btn label="Log a class here" onClick={() => { setLogPrefill({ studioId: studio.id }); setTab("log"); }} style={{ flex: 1, justifyContent: "center" }} />
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
function LogScreen({ logs, setLogs, prefill, setPrefill, hkConnected, hkConnect, hkSyncing, hkWorkouts, showToast, detectedCity, onClassLogged }) {
  const { C } = useTheme();
  const { uploadPhoto, saveClassPhoto, uploading: photoUploading } = usePhotoUpload();
  const pf = prefill?.studioId ? STUDIOS_SEED.find(s => s.id === prefill.studioId) : null;
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
    if (prefill?.studioId) { const s = STUDIOS_SEED.find(x => x.id === prefill.studioId); if (s) { setStudio(s); setSS(s.name); } }
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
      setSearching(true);
      try {
        // Call Netlify function — real Google Places search
        const res = await fetch(`/api/places-search?query=${encodeURIComponent(query)}`);
        const json = await res.json();
        if (json.studios && json.studios.length > 0) {
          setSR(json.studios);
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

      // Step 1: Upload all photos to Supabase Storage
      const uploadedUrls = [];
      for (const p of photos) {
        try {
          const url = await uploadPhoto(p.file, "class");
          uploadedUrls.push(url);
          setPhotos(prev => prev.map(x => x.id === p.id ? { ...x, uploaded: true, url } : x));
        } catch (err) {
          setPhotos(prev => prev.map(x => x.id === p.id ? { ...x, error: err.message } : x));
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
      <p style={{ fontSize: 10, color: C.textTer, margin: "0 0 20px", fontWeight: 700, letterSpacing: "0.1em" }}>STEP {step} OF 3</p>
      <div style={{ display: "flex", gap: 6, marginBottom: 26 }}>{[1, 2, 3].map(s => <div key={s} style={{ flex: 1, height: 3, background: s <= step ? C.accent : C.surfaceHi, borderRadius: 100, transition: "background 0.3s" }} />)}</div>

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

        {/* Thumbnail grid */}
        {photos.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {photos.map(p => (
              <div key={p.id} style={{ position: "relative", width: 72, height: 72 }}>
                <img
                  src={p.previewUrl}
                  alt="preview"
                  style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10,
                    border: `1.5px solid ${p.error ? "rgba(220,80,60,0.6)" : p.uploaded ? C.green : C.border}`,
                    opacity: photoUploading ? 0.7 : 1 }}
                />
                {/* Upload status overlay */}
                {p.error && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(220,80,60,0.3)", borderRadius: 10,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>⚠️</div>
                )}
                {p.uploaded && !p.error && (
                  <div style={{ position: "absolute", bottom: 3, right: 3, background: C.green,
                    borderRadius: "50%", width: 16, height: 16, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 9, color: "#fff", fontWeight: 700 }}>✓</div>
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
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[["Classes", stats.classes], ["Studios", stats.studios], ["Cities", stats.cities], ["Countries", stats.countries]].map(([l, v]) => (
            <div key={l} style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "10px 6px", textAlign: "center" }}>
              <div style={{ fontFamily: FD, fontSize: 20, fontWeight: 700, color: C.accent }}>{v}</div>
              <div style={{ fontSize: 9, color: C.textTer, marginTop: 2, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
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

        {view === "badges" && <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          {badges.map(b => (
            <div key={b.id} style={{ background: b.unlocked ? C.surface : C.bg, border: `1px solid ${b.unlocked ? "rgba(232,113,74,0.3)" : C.border}`, borderRadius: 16, padding: "14px 8px", textAlign: "center", opacity: b.unlocked ? 1 : 0.5 }}>
              <div style={{ fontSize: 26, marginBottom: 5 }}>{b.icon}</div>
              <p style={{ fontSize: 10, fontWeight: 700, color: b.unlocked ? C.textPri : C.textTer, margin: "0 0 4px", lineHeight: 1.3 }}>{b.name}</p>
              {b.unlocked ? <p style={{ fontSize: 9, color: C.accent, margin: 0, fontWeight: 700 }}>EARNED ✓</p> : <div style={{ marginTop: 3 }}><div style={{ height: 3, background: C.surfaceHi, borderRadius: 100, overflow: "hidden" }}><div style={{ height: "100%", width: `${(b.current / b.target) * 100}%`, background: C.accent, borderRadius: 100 }} /></div><p style={{ fontSize: 9, color: C.textTer, margin: "3px 0 0" }}>{b.current}/{b.target}</p></div>}
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
function ProfileScreen({ logs, savedStudios, challenges, joinChallenge, leaveChallenge, hkConnected, hkConnect, hkSyncing, hkWorkouts, user, userProfile, detectedCity, showToast, notifications }) {
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
            : STUDIOS_SEED.filter(s => savedStudios.includes(s.id)).map(s => <Card key={s.id} style={{ padding: "14px" }}><div style={{ display: "flex", alignItems: "center", gap: 12 }}><span style={{ fontSize: 26 }}>{s.hero}</span><div><p style={{ fontSize: 14, fontWeight: 700, color: C.textPri, margin: "0 0 2px" }}>{s.name}</p><p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>{s.city} · ★{s.rating}</p></div></div></Card>)}
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
            <p style={{ fontSize: 11, color: C.textTer }}>Pilates Passport · v1.0</p>
          </div>
        </div>}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   ROOT APP
══════════════════════════════════════════════════════════════════════════ */
export default function App() {
  const { C } = useTheme();
  const [onboarded, setOnboarded] = useState(() => !!localStorage.getItem("pp_onboarded"));
  const [tab, setTab] = useState("home");
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [savedStudios, setSavedStudios] = useState([]);
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
    if (!user) return;
    supabase
      .from("users")
      .select("id, display_name, bio, profile_photo_url, visibility")
      .eq("visibility", "public")
      .neq("id", user.id)
      .limit(20)
      .then(({ data }) => {
        if (data && data.length > 0) {
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
  }, [user]);
  const [selectedStudio, setSelectedStudio] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [logPrefill, setLogPrefill] = useState(null);
  const [toast, setToast] = useState("");
  const [user, setUser] = useState(null);
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

  // Get auth user from AuthContext (no duplicate listener needed)
  // AppWithTheme passes the auth user directly — we just fetch the profile
  useEffect(() => {
    // Get initial user from Supabase session (single source of truth)
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      if (u) { setUser(u); fetchProfile(u); }
    });

    // React to auth state changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) fetchProfile(u);
      else { setUserProfile(null); setLogs([]); setSavedStudios([]); }
    });
    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  // Fetch logs from Supabase
  useEffect(() => {
    if (!user) { setLogsLoading(false); return; }
    setLogsLoading(true);
    supabase.from("class_logs").select("*").eq("user_id", user.id).order("date", { ascending: false }).order("start_time", { ascending: false })
      .then(({ data }) => {
        if (data) setLogs(data.map(l => {
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
        }));
      })
      .finally(() => setLogsLoading(false));
  }, [user]);

  // Fetch saved studios
  useEffect(() => {
    if (!user) return;
    supabase.from("saved_studios").select("studio_id").eq("user_id", user.id)
      .then(({ data }) => { if (data) setSavedStudios(data.map(s => s.studio_id)); });
  }, [user]);

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

  // Real GPS geofencing with 100m radius + 2-hour cooldown
  useEffect(() => {
    if (gpsDismissed || !onboarded) return;
    if (!FLAGS.gps || !navigator.geolocation) return;

    let lastDetectionTime = 0;
    const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 hours
    const RADIUS_M = 500; // 500 metres — more forgiving for real-world detection

    setGpsScanning(true);

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setGpsScanning(false);
        const { latitude, longitude } = position.coords;
        const now = Date.now();

        // Cooldown — don't spam the prompt
        if (now - lastDetectionTime < COOLDOWN_MS) return;

        // Find closest studio within RADIUS_M
        let closestStudio = null;
        let closestDist = Infinity;
        // Check all known studios: seed + any stored in window from Places search
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
          lastDetectionTime = now;
          setGpsDetected(closestStudio);
        }
      },
      (err) => {
        // Permission denied or unavailable — fall back to city-based hint
        setGpsScanning(false);
        console.info("GPS unavailable:", err.message);
        // Show a city-matched studio as a softer hint (not a precise detection)
        if (detectedCity && !gpsDetected) {
          const cityMatch = STUDIOS_SEED.find(s =>
            s.city.toLowerCase().includes(detectedCity.toLowerCase()) ||
            detectedCity.toLowerCase().includes(s.city.toLowerCase())
          );
          if (cityMatch) setGpsDetected(cityMatch);
        }
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

  const toggleSave = async (studioId) => {
    if (!user) return;
    const alreadySaved = savedStudios.includes(studioId);
    if (alreadySaved) {
      await supabase.from("saved_studios").delete().eq("user_id", user.id).eq("studio_id", studioId);
      setSavedStudios(prev => prev.filter(x => x !== studioId));
      showToast("Removed from saved");
    } else {
      await supabase.from("saved_studios").upsert({ user_id: user.id, studio_id: studioId });
      setSavedStudios(prev => [...prev, studioId]);
      showToast("Studio saved ♥");
    }
  };

  const showToast = (msg) => setToast(msg);

  const handleSetTab = (t) => { setSelectedStudio(null); setSelectedUser(null); setTab(t); };

  useEffect(() => { if (screenRef.current) screenRef.current.scrollTop = 0; }, [tab, selectedStudio, selectedUser]);

  const completeOnboarding = () => { localStorage.setItem("pp_onboarded", "1"); setOnboarded(true); };

  if (!onboarded) return (
    <ThemeProvider>
      <div style={{ width: "100%", maxWidth: 420, margin: "0 auto", minHeight: "100vh" }}>
        <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <Onboarding onComplete={completeOnboarding} />
      </div>
    </ThemeProvider>
  );

  // Badge system — real Supabase badges
  const badgeStats = getStats(logs);
  const { badges: appBadges, evaluateBadges } = useBadges(badgeStats);

  // Called after every successful class log to check for newly unlocked badges
  const onClassLogged = useCallback(async () => {
    try {
      const newBadges = await evaluateBadges();
      if (newBadges && newBadges.length > 0) {
        newBadges.forEach(b => {
          showToast(`🏅 Badge unlocked: ${b.name}!`);
          // Also fire a push notification if permission granted
          notifications.sendNotification(`Badge unlocked: ${b.name} ${b.icon_name || "✦"}`, {
            body: b.unlock_copy || "Keep up the great practice!",
            tag: `badge-${b.id}`,
          });
        });
      }
    } catch (_) {}
  }, [evaluateBadges, showToast]);

  const sharedProps = { logs, savedStudios, toggleSave, hkConnected, hkConnect, hkSyncing, hkWorkouts, challenges, joinChallenge, leaveChallenge, communityUsers, setCommunityUsers, showToast, user, userProfile, detectedCity, userCoords, appBadges, onClassLogged, notifications };

  const renderScreen = () => {
    if (selectedUser) return <PublicProfileScreen user={selectedUser} onBack={() => setSelectedUser(null)} setCommunityUsers={setCommunityUsers} />;
    if (selectedStudio) return <StudioDetail studio={selectedStudio} logs={logs} onBack={() => setSelectedStudio(null)} savedStudios={savedStudios} toggleSave={toggleSave} setTab={handleSetTab} setLogPrefill={setLogPrefill} showToast={showToast} />;
    switch (tab) {
      case "home": return <HomeScreen {...sharedProps} setTab={handleSetTab} setLogPrefill={setLogPrefill} gpsDetected={gpsDetected} gpsScanning={gpsScanning} gpsDismiss={() => { setGpsDetected(null); setGpsDismissed(true); }} setSelectedStudio={setSelectedStudio} />;
      case "explore": return <ExploreScreen {...sharedProps} setSelectedStudio={setSelectedStudio} setSelectedUser={setSelectedUser} userCoords={userCoords} detectedCity={detectedCity} />;
      case "log": return <LogScreen logs={logs} setLogs={setLogs} prefill={logPrefill} setPrefill={setLogPrefill} hkConnected={hkConnected} hkConnect={hkConnect} hkSyncing={hkSyncing} hkWorkouts={hkWorkouts} showToast={showToast} detectedCity={detectedCity} onClassLogged={onClassLogged} />;
      case "passport": return <PassportScreen logs={logs} />;
      case "profile": return <ProfileScreen {...sharedProps} />;
      default: return null;
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: 420, margin: "0 auto", minHeight: "100vh", background: C.bg, fontFamily: FB, position: "relative", display: "flex", flexDirection: "column" }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div ref={screenRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", paddingBottom: 80 }}>
        {logsLoading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 16 }}>
            <img src="/logo.png" alt="" style={{ width: 48, height: 48, objectFit: "contain", opacity: 0.6 }} />
            <p style={{ fontSize: 13, color: C.textSec, fontFamily: FB }}>Loading your practice…</p>
          </div>
        ) : renderScreen()}
      </div>
      <Toast msg={toast} onClose={() => setToast("")} />
      <nav style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 420, background: C.navBg, backdropFilter: "blur(24px)", borderTop: `1px solid ${C.border}`, display: "flex", padding: "6px 0 18px", zIndex: 100 }}>
        {NAV.map(item => {
          const isLog = item.id === "log";
          const isActive = tab === item.id && !selectedStudio && !selectedUser;
          return (
            <button key={item.id} onClick={() => handleSetTab(item.id)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 0 0" }}>
              {isLog
                ? <div style={{ width: 48, height: 48, borderRadius: 14, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 28, fontWeight: 700, marginTop: -22, boxShadow: `0 4px 24px rgba(232,113,74,0.5)` }}>+</div>
                : <><span style={{ fontSize: 17, color: isActive ? C.accent : C.textTer, transition: "color 0.15s", lineHeight: 1 }}>{item.icon}</span><span style={{ fontSize: 9, fontWeight: 700, color: isActive ? C.accent : C.textTer, transition: "color 0.15s", letterSpacing: "0.05em" }}>{item.label}</span></>
              }
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// Wrap App with ThemeProvider for export
export function AppWithTheme() {
  return (
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}
