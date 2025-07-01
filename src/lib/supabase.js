import { createClient } from '@supabase/supabase-js'

// Mock Supabase configuration for development
const SUPABASE_URL = 'https://mock-project.supabase.co'
const SUPABASE_ANON_KEY = 'mock-anon-key'

// Create a mock client for development
const mockClient = {
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'mock-user' } } } }),
    getUser: async () => ({ data: { user: { id: 'mock-user' } } }),
    onAuthStateChange: (callback) => {
      // Simulate authenticated user
      setTimeout(() => {
        callback('SIGNED_IN', { user: { id: 'mock-user' } });
      }, 100);
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
  },
  from: (table) => ({
    select: (columns = '*') => ({
      eq: (column, value) => ({
        order: (column, options) => ({
          then: (resolve) => resolve({ data: [], error: null })
        }),
        single: () => ({ then: (resolve) => resolve({ data: null, error: null }) })
      }),
      single: () => ({ then: (resolve) => resolve({ data: null, error: null }) })
    }),
    insert: (data) => ({
      select: () => ({
        single: () => ({ then: (resolve) => resolve({ data: { id: 'mock-id', ...data }, error: null }) })
      })
    }),
    upsert: (data) => ({
      select: () => ({
        single: () => ({ then: (resolve) => resolve({ data: { id: 'mock-id', ...data }, error: null }) })
      })
    }),
    update: (data) => ({
      eq: (column, value) => ({ then: (resolve) => resolve({ data: null, error: null }) })
    }),
    delete: () => ({
      eq: (column, value) => ({ then: (resolve) => resolve({ error: null }) })
    })
  })
};

export default mockClient;