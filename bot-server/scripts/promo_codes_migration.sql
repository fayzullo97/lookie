-- Promo Code System Migration
-- Run this in the Supabase SQL Editor

-- Table: promo_codes
-- Each user gets exactly one unique promo code
CREATE TABLE IF NOT EXISTS promo_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id bigint REFERENCES users(id) UNIQUE NOT NULL,
  code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Table: promo_redemptions
-- Tracks who redeemed which code
-- UNIQUE(redeemed_by) ensures a user can only ever redeem ONE promo code in their lifetime
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL REFERENCES promo_codes(code),
  redeemed_by bigint NOT NULL REFERENCES users(id),
  owner_id bigint NOT NULL REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(redeemed_by)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_user ON promo_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_redeemed_by ON promo_redemptions(redeemed_by);
