/**
 * Supabase client — Summa.sh
 * 
 * Projeto: rmxxvpqkbeyorvyxydmn
 * Dashboard: https://supabase.com/dashboard/project/rmxxvpqkbeyorvyxydmn
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
  ?? 'https://rmxxvpqkbeyorvyxydmn.supabase.co';

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
  ?? ''; // ← setar no .env.local

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);