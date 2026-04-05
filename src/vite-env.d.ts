/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  /** auth.users UUID of the tenant for anonymous /book inserts (RLS must allow anon; see supabase/public_booking_rls.sql) */
  readonly VITE_BOOKING_OWNER_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
