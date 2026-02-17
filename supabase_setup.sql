-- 1. Create Tables

-- Drop existing tables if they exist (Be careful with this in production!)
-- DROP TABLE IF EXISTS transactions;
-- DROP TABLE IF EXISTS generations;
-- DROP TABLE IF EXISTS outfit_queue;
-- DROP TABLE IF EXISTS model_images;
-- DROP TABLE IF EXISTS users;

-- Users Table
CREATE TABLE users (
    id bigint PRIMARY KEY, -- Telegram Chat ID
    username text,
    first_name text,
    language text,
    credits integer DEFAULT 30,
    current_state text,
    model_gender text,
    last_monthly_grant text,
    created_at timestamptz DEFAULT now(),
    last_active_at timestamptz
);

-- Model Images Table
CREATE TABLE model_images (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id bigint REFERENCES users(id) ON DELETE CASCADE,
    storage_path text NOT NULL,
    is_current boolean DEFAULT false,
    is_original boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

-- Outfit Queue Table
CREATE TABLE outfit_queue (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id bigint REFERENCES users(id) ON DELETE CASCADE,
    storage_path text NOT NULL,
    category text,
    description text,
    mime_type text,
    created_at timestamptz DEFAULT now()
);

-- Generations Table
CREATE TABLE generations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id bigint REFERENCES users(id) ON DELETE CASCADE,
    input_prompt text,
    result_image_path text,
    status text, -- 'success', 'failed', 'safety_block'
    error_message text,
    cost_credits integer,
    cost_usd_est numeric,
    created_at timestamptz DEFAULT now()
);

-- Transactions Table
CREATE TABLE transactions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id bigint REFERENCES users(id) ON DELETE CASCADE,
    amount integer NOT NULL, -- Positive (add) or Negative (spend)
    type text NOT NULL, -- 'purchase', 'gift', 'usage', 'monthly_grant', 'refund'
    amount_paid_uzs integer DEFAULT 0,
    provider_id text,
    created_at timestamptz DEFAULT now()
);

-- 2. Create Views for Analytics

-- daily_metrics_view
CREATE OR REPLACE VIEW daily_metrics_view AS
SELECT 
  date_trunc('day', created_at) as date, 
  count(*) as total_gens,
  count(*) filter (where status = 'success') as success_gens
FROM generations 
GROUP BY 1;

-- funnel_view
CREATE OR REPLACE VIEW funnel_view AS
SELECT
  (SELECT count(*) FROM users) as total_users,
  (SELECT count(DISTINCT user_id) FROM model_images) as users_with_model,
  (SELECT count(DISTINCT user_id) FROM generations) as users_who_generated;

-- 3. Storage Configuration (Note: Buckets must be created via the UI or API)
-- These instructions are for reference:
-- Bucket 1: user-uploads (public or private depending on security)
-- Bucket 2: generated-results (public if meant for direct linking)

-- 4. Enable Row Level Security (RLS) - Recommended
-- Note: If the bot server uses the Service Role Key, RLS can be bypassed.
-- But for dashboard security, you may want to enable it.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfit_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Simple policy: All operations allowed for the bot server (using service role)
-- but for specific dashboard users, you would add more restrictive policies.
