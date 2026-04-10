import { createClient } from '@supabase/supabase-js'

// ─── Environment variable validation ──────────────────────────────────────────
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validate format — catches common copy/paste mistakes
const isValidUrl = (url) => {
  try {
    const u = new URL(url)
    return u.hostname.endsWith('.supabase.co')
  } catch {
    return false
  }
}

const isValidKey = (key) =>
  typeof key === 'string' && key.startsWith('eyJ') && key.length > 100

if (!supabaseUrl || !supabaseAnonKey) {
  const missing = [
    !supabaseUrl && 'VITE_SUPABASE_URL',
    !supabaseAnonKey && 'VITE_SUPABASE_ANON_KEY',
  ].filter(Boolean).join(', ')

  throw new Error(
    `[Pilates Passport] Missing environment variables: ${missing}\n\n` +
    `Steps to fix:\n` +
    `  1. Copy .env.example to .env.local\n` +
    `  2. Fill in your Supabase project URL and anon key\n` +
    `  3. Find them at: Supabase Dashboard → Settings → API\n\n` +
    `For Netlify deployment:\n` +
    `  Site → Environment variables → Add:\n` +
    `    VITE_SUPABASE_URL\n` +
    `    VITE_SUPABASE_ANON_KEY`
  )
}

if (!isValidUrl(supabaseUrl)) {
  console.error(
    `[Pilates Passport] VITE_SUPABASE_URL looks wrong: "${supabaseUrl}"\n` +
    `Expected format: https://your-project-ref.supabase.co`
  )
}

if (!isValidKey(supabaseAnonKey)) {
  console.error(
    `[Pilates Passport] VITE_SUPABASE_ANON_KEY looks wrong.\n` +
    `It should be a long JWT starting with "eyJ..."\n` +
    `Find it at: Supabase Dashboard → Settings → API → anon public`
  )
}

// ─── Supabase client ──────────────────────────────────────────────────────────
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'pilates-passport-auth',
  },
  global: {
    headers: {
      'x-app-name': 'pilates-passport',
    },
  },
  db: {
    schema: 'public',
  },
})

// ─── Connection health check (runs once on load, logs result) ─────────────────
supabase
  .from('studios')
  .select('id', { count: 'exact', head: true })
  .then(({ error, count }) => {
    if (error) {
      console.warn('[Pilates Passport] Supabase connection issue:', error.message)
    } else {
      console.info(`[Pilates Passport] Supabase connected ✓ (${count ?? 0} studios in DB)`)
    }
  })
  .catch(() => {
    console.warn('[Pilates Passport] Could not reach Supabase — check your URL and key.')
  })

export default supabase
