import { createClient } from '@supabase/supabase-js'

// Get Supabase credentials from environment or use fallback values
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://demo-project.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'demo-key'

// Check if we have real credentials
const hasRealCredentials = 
  import.meta.env.VITE_SUPABASE_URL && 
  import.meta.env.VITE_SUPABASE_ANON_KEY &&
  import.meta.env.VITE_SUPABASE_URL !== 'https://your-project.supabase.co' &&
  import.meta.env.VITE_SUPABASE_ANON_KEY !== 'your-anon-key'

let supabase = null

// Only create Supabase client if we have real credentials
if (hasRealCredentials) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
    console.log('✅ Supabase connected successfully')
  } catch (error) {
    console.warn('⚠️ Supabase connection failed:', error.message)
    supabase = null
  }
} else {
  console.log('📝 Running in demo mode - Supabase not configured')
}

// Export a mock client if Supabase is not available
export default supabase || {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
  },
  from: () => ({
    select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
    insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    upsert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    delete: () => ({ eq: () => Promise.resolve({ error: null }) })
  })
}

export { hasRealCredentials }