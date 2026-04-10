import { useState } from 'react'
import { supabase } from '../lib/supabase'

function getC() {
  const saved = localStorage.getItem("pp_theme");
  const dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (dark) return {
    bg: '#0F0F0F', surface: '#1A1A1A', surfaceHi: '#242424',
    border: 'rgba(255,255,255,0.08)', accent: '#E8714A', accentDim: 'rgba(232,113,74,0.15)',
    textPri: '#F5F0EB', textSec: '#9A9488', textTer: '#5E5A54',
  };
  return {
    bg: '#FAF8F6', surface: '#FFFFFF', surfaceHi: '#F5F2EF',
    border: 'rgba(60,40,20,0.1)', accent: '#E8714A', accentDim: 'rgba(232,113,74,0.12)',
    textPri: '#1E1410', textSec: '#7A6A5A', textTer: '#AFA090',
  };
}

const FD = "'Playfair Display',Georgia,serif"
const FB = "'Outfit',sans-serif"

function Input({ placeholder, value, onChange, type = 'text' }) {
  const C = getC()
  return (
    <input
      type={type} placeholder={placeholder} value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: C.surfaceHi, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: '13px 16px', fontSize: 14,
        color: C.textPri, fontFamily: FB, width: '100%',
        outline: 'none', boxSizing: 'border-box', marginBottom: 12,
      }}
      onFocus={e => e.target.style.borderColor = C.accent}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  )
}

function PrimaryBtn({ label, onClick, loading, style = {} }) {
  const C = getC()
  return (
    <button onClick={onClick} disabled={loading} style={{
      background: loading ? C.surfaceHi : C.accent, color: '#fff',
      border: 'none', borderRadius: 14, padding: '14px 20px',
      fontSize: 15, fontWeight: 700, width: '100%',
      cursor: loading ? 'not-allowed' : 'pointer', fontFamily: FB,
      opacity: loading ? 0.6 : 1, transition: 'all 0.15s', ...style,
    }}>
      {loading ? 'Signing in…' : label}
    </button>
  )
}

function Msg({ msg, success }) {
  const C = getC()
  if (!msg) return null
  const bg = success ? 'rgba(91,175,122,0.15)' : 'rgba(220,80,60,0.15)'
  const border = success ? 'rgba(91,175,122,0.3)' : 'rgba(220,80,60,0.3)'
  const color = success ? '#5BAF7A' : '#ff8070'
  return <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color, lineHeight: 1.5 }}>{msg}</div>
}

function LogoHeader({ subtitle }) {
  const C = getC()
  const dark = localStorage.getItem("pp_theme") !== "light"
  return (
    <div style={{ textAlign: 'center', marginBottom: 32 }}>
      <img src="/logo.png" alt="Pilates Passport" style={{ width: 72, height: 72, objectFit: 'contain', marginBottom: 14, filter: dark ? 'none' : 'none' }} />
      <h1 style={{ fontFamily: FD, fontSize: 26, fontWeight: 700, color: C.textPri, margin: '0 0 6px', letterSpacing: -0.5 }}>Pilates Passport</h1>
      {subtitle && <p style={{ fontSize: 14, color: C.textSec, margin: 0, lineHeight: 1.5 }}>{subtitle}</p>}
    </div>
  )
}

function SignIn({ onSwitch }) {
  const C = getC()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handle = async () => {
    if (!email || !password) { setError('Please fill in all fields.'); return }
    setLoading(true); setError('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      // Don't setLoading(false) here on success — let onAuthStateChange
      // in AuthContext handle the transition. The loading state gives
      // visual feedback while the app switches screens.
      // Only clear loading on error.
    } catch (e) {
      setError(e.message || 'Sign in failed. Check your email and password.')
      setLoading(false)
    }
  }

  const handleApple = async () => {
    try { await supabase.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: window.location.origin } }) }
    catch (e) { setError(e.message) }
  }

  return (
    <div>
      <LogoHeader subtitle="Your Pilates practice, beautifully documented." />
      <Msg msg={error} />
      <Input placeholder="Email address" value={email} onChange={setEmail} type="email" />
      <Input placeholder="Password" value={password} onChange={setPassword} type="password" />
      <div style={{ textAlign: 'right', marginBottom: 20 }}>
        <span onClick={() => onSwitch('forgot')} style={{ fontSize: 13, color: C.accent, cursor: 'pointer', fontWeight: 600 }}>Forgot password?</span>
      </div>
      <PrimaryBtn label="Sign in" onClick={handle} loading={loading} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
        <div style={{ flex: 1, height: 1, background: C.border }} />
        <span style={{ fontSize: 12, color: C.textTer, fontWeight: 600 }}>OR</span>
        <div style={{ flex: 1, height: 1, background: C.border }} />
      </div>
      <button onClick={handleApple} style={{ background: C.surface, color: C.textPri, border: `1px solid ${C.border}`, borderRadius: 14, padding: '13px 20px', fontSize: 14, fontWeight: 600, width: '100%', cursor: 'pointer', fontFamily: FB, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>🍎</span> Continue with Apple
      </button>
      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: C.textSec }}>
        Don't have an account?{' '}
        <span onClick={() => onSwitch('signup')} style={{ color: C.accent, fontWeight: 700, cursor: 'pointer' }}>Sign up</span>
      </p>
    </div>
  )
}

function SignUp({ onSwitch }) {
  const C = getC()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handle = async () => {
    if (!name || !email || !password) { setError('Please fill in all fields.'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true); setError('')
    try {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { display_name: name } } })
      if (error) throw error
      setSuccess('Account created! Check your email to confirm, then sign in.')
    } catch (e) { setError(e.message || 'Sign up failed.') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <LogoHeader subtitle="Start your Pilates Passport today." />
      <Msg msg={error} />
      <Msg msg={success} success />
      {!success && <>
        <Input placeholder="Your name" value={name} onChange={setName} />
        <Input placeholder="Email address" value={email} onChange={setEmail} type="email" />
        <Input placeholder="Password (min 8 characters)" value={password} onChange={setPassword} type="password" />
        <Input placeholder="Confirm password" value={confirm} onChange={setConfirm} type="password" />
        <PrimaryBtn label="Create my account" onClick={handle} loading={loading} style={{ marginTop: 4 }} />
      </>}
      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: C.textSec }}>
        Already have an account?{' '}
        <span onClick={() => onSwitch('signin')} style={{ color: C.accent, fontWeight: 700, cursor: 'pointer' }}>Sign in</span>
      </p>
    </div>
  )
}

function Forgot({ onSwitch }) {
  const C = getC()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handle = async () => {
    if (!email) { setError('Please enter your email.'); return }
    setLoading(true); setError('')
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
      if (error) throw error
      setSuccess('Reset link sent! Check your inbox.')
    } catch (e) { setError(e.message || 'Failed to send reset email.') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <LogoHeader subtitle="We'll send you a reset link." />
      <Msg msg={error} />
      <Msg msg={success} success />
      {!success && <>
        <Input placeholder="Your email address" value={email} onChange={setEmail} type="email" />
        <PrimaryBtn label="Send reset link" onClick={handle} loading={loading} />
      </>}
      <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: getC().textSec }}>
        <span onClick={() => onSwitch('signin')} style={{ color: getC().accent, fontWeight: 700, cursor: 'pointer' }}>← Back to sign in</span>
      </p>
    </div>
  )
}

export default function AuthScreen() {
  const C = getC()
  const [screen, setScreen] = useState('signin')
  return (
    <div style={{ width: '100%', maxWidth: 420, margin: '0 auto', minHeight: '100vh', background: C.bg, fontFamily: FB, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '40px 24px' }}>
      {screen === 'signin' && <SignIn onSwitch={setScreen} />}
      {screen === 'signup' && <SignUp onSwitch={setScreen} />}
      {screen === 'forgot' && <Forgot onSwitch={setScreen} />}
      <div style={{ textAlign: 'center', marginTop: 32, paddingTop: 20, borderTop: `1px solid ${C.border}` }}>
        <p style={{ fontSize: 12, color: C.textTer, marginBottom: 8 }}>© 2026 Pilates Passport</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
          <a href="/policy" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.textSec, textDecoration: 'none', fontWeight: 600 }}>Privacy Policy</a>
          <span style={{ color: C.textTer, fontSize: 12 }}>·</span>
          <a href="/tos" target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.textSec, textDecoration: 'none', fontWeight: 600 }}>Terms of Service</a>
        </div>
      </div>
    </div>
  )
}
