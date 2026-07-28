-- ═══════════════════════════════════════════════════════════
-- Summa.sh — Migration: fix missing columns + RLS policies
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ── 1. Missing columns in `profiles` ──
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS linkedin_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lattes_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS advisor_meta jsonb;

-- ── 2. Missing column in `documents` ──
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_template_id uuid;

-- ── 3. RLS policies for `radar_items` ──
-- Enable RLS if not already
ALTER TABLE radar_items ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own radar items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'radar_items' AND policyname = 'Users can view own radar_items'
  ) THEN
    CREATE POLICY "Users can view own radar_items"
      ON radar_items FOR SELECT
      USING (profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

-- Allow users to insert their own radar items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'radar_items' AND policyname = 'Users can insert own radar_items'
  ) THEN
    CREATE POLICY "Users can insert own radar_items"
      ON radar_items FOR INSERT
      WITH CHECK (profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

-- Allow users to update their own radar items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'radar_items' AND policyname = 'Users can update own radar_items'
  ) THEN
    CREATE POLICY "Users can update own radar_items"
      ON radar_items FOR UPDATE
      USING (profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

-- Allow users to delete their own radar items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'radar_items' AND policyname = 'Users can delete own radar_items'
  ) THEN
    CREATE POLICY "Users can delete own radar_items"
      ON radar_items FOR DELETE
      USING (profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      ));
  END IF;
END $$;

-- ═══ Done ═══
