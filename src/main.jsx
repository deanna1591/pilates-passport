import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AuthScreen from './screens/AuthScreen'
import { AppWithTheme } from './App'

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Outfit:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root { height: 100%; width: 100%; }
  body {
    background: #0F0F0F;
    font-family: 'Outfit', sans-serif;
    -webkit-font-smoothing: antialiased;
    overscroll-behavior: none;
  }
  input, textarea, button, select { font-family: inherit; }
  ::-webkit-scrollbar { width: 0; background: transparent; }
  input[type="date"]::-webkit-calendar-picker-indicator,
  input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
  textarea::placeholder, input::placeholder { color: #5E5A54; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
`

const SPLASH = {
  wrapper: {
    width: '100%', maxWidth: 420, margin: '0 auto',
    minHeight: '100vh', background: '#0F0F0F',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 20,
  },
  logo: { width: 72, height: 72, objectFit: 'contain', animation: 'pulse 1.8s ease-in-out infinite' },
  text: { color: '#9A9488', fontSize: 13, fontFamily: "'Outfit',sans-serif", letterSpacing: '0.05em' },
}

function Root() {
  const { user, loading } = useAuth()

  // Show splash while checking session — never show a black screen
  if (loading) {
    return (
      <div style={SPLASH.wrapper}>
        <img src="/logo.png" alt="Pilates Passport" style={SPLASH.logo} />
        <p style={SPLASH.text}>Loading your passport…</p>
      </div>
    )
  }

  // Auth resolved — show correct screen immediately, no flicker
  return user ? <AppWithTheme /> : <AuthScreen />
}

const styleEl = document.createElement('style')
styleEl.textContent = CSS
document.head.appendChild(styleEl)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>
)
