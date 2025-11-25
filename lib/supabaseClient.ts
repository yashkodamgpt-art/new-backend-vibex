
import { createClient } from '@supabase/supabase-js';

// =================================================================
// IMPORTANT: PASTE YOUR SUPABASE CREDENTIALS HERE
// You can get these from your Supabase project's settings page
// (Settings -> API).
// =================================================================

// 1. Replace 'YOUR_SUPABASE_URL' with your actual Supabase URL
const supabaseUrl = 'https://onzxkzsiqovyntsgvnwe.supabase.co'; 

// 2. Replace 'YOUR_SUPABASE_ANON_KEY' with your actual Supabase Anon Key
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uenhrenNpcW92eW50c2d2bndlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwNjc0NjQsImV4cCI6MjA3OTY0MzQ2NH0.c7G0ghVRvET0_0Ptu_2mVglEt0VLJJo1kOx_zM1yQxE';

// --- Do not edit below this line ---

// FIX: Removed comparison to placeholder strings, which caused a TypeScript error
// because the constants have been assigned literal values. This now only
// checks if the variables are falsy.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be provided in 'lib/supabaseClient.ts'");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce', // More secure auth flow
  },
});
