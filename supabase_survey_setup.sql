CREATE TABLE survey_responses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id bigint REFERENCES users(id) ON DELETE CASCADE,
    username text,
    q1_satisfaction integer,
    q2_realism integer,
    q3_frustration text,
    q3_frustration_other text,
    q4_value integer,
    q5_payment text,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service" ON survey_responses FOR ALL USING (true) WITH CHECK (true);
