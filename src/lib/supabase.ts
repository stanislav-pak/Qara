import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

/**
 * Нақты .env сынбалары бар ма. Placeholder-пен клиент жасалғанда false.
 * (Бос URL/ключпен createClient енді лақтырмайды — қолданба жүктеледі.)
 */
export const isSupabaseConfigured = Boolean(envUrl && envKey)

/** Жергілікті әзірлеу үшін жарамды HTTPS URL (validateSupabaseUrl өтеді). */
const PLACEHOLDER_URL = 'https://placeholder.supabase.co'

/**
 * Жарамды JWT пішіні — supabaseKey is required тексеруінен өту үшін.
 * Нақты жобаға қосқанда .env өз кілтіңізбен ауысады.
 */
const PLACEHOLDER_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const url = envUrl || PLACEHOLDER_URL
const anonKey = envKey || PLACEHOLDER_ANON_KEY

if (!isSupabaseConfigured) {
  console.warn(
    '[Qara] Укажите VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env. Используется временный placeholder — вход не будет работать.',
  )
}

function createSupabaseClient(): SupabaseClient<Database> {
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

export const supabase = createSupabaseClient()
