-- Migration: Anti-slop and multi-signal intelligence engine tables

CREATE TABLE IF NOT EXISTS domain_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vertical TEXT,
  source TEXT,
  metric_name TEXT,
  current_value DECIMAL,
  mean_30d DECIMAL,
  mean_90d DECIMAL,
  mean_18m DECIMAL,
  z_score DECIMAL,
  capture_date TIMESTAMPTZ,
  historical_instances JSONB DEFAULT '[]',
  consensus_interpretation TEXT,
  insight_extracted BOOLEAN DEFAULT FALSE,
  content_generated BOOLEAN DEFAULT FALSE,
  quality_gate_score JSONB DEFAULT '{}',
  quality_gate_decision TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS convergence_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_ids UUID[],
  vertical_a TEXT,
  vertical_b TEXT,
  correlation_coefficient DECIMAL,
  z_score_composite DECIMAL,
  historical_instances JSONB DEFAULT '[]',
  historical_base_rate DECIMAL,
  detected_at TIMESTAMPTZ,
  content_piece_id UUID REFERENCES content_pieces(id),
  status TEXT DEFAULT 'detected',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_text TEXT,
  prediction_direction TEXT,
  prediction_magnitude_range TEXT,
  prediction_metric TEXT,
  prediction_source TEXT,
  prediction_timeframe TIMESTAMPTZ,
  confidence_score INTEGER,
  consensus_position TEXT,
  consensus_deviation TEXT,
  invalidation_conditions TEXT[],
  content_piece_id UUID REFERENCES content_pieces(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  outcome_value DECIMAL,
  outcome_direction TEXT,
  outcome_recorded_at TIMESTAMPTZ,
  prediction_correct BOOLEAN,
  accuracy_note TEXT
);

CREATE TABLE IF NOT EXISTS quality_gate_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_piece_id UUID REFERENCES content_pieces(id),
  attempt_number INTEGER,
  scores JSONB DEFAULT '{}',
  decision TEXT,
  regeneration_notes TEXT,
  kill_reason TEXT,
  evaluated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS banned_phrases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phrase TEXT UNIQUE NOT NULL,
  category TEXT DEFAULT 'slop',
  added_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed banned_phrases
INSERT INTO banned_phrases (phrase, category, added_reason) VALUES
('delve', 'slop', 'AI hallmark'),
('dive deep', 'slop', 'AI hallmark'),
('landscape', 'slop', 'AI hallmark'),
('paradigm', 'slop', 'AI hallmark'),
('game-changer', 'slop', 'AI hallmark'),
('groundbreaking', 'slop', 'AI hallmark'),
('unprecedented', 'slop', 'AI hallmark'),
('in today''s', 'slop', 'AI hallmark'),
('it''s more important than ever', 'slop', 'AI hallmark'),
('as we navigate', 'slop', 'AI hallmark'),
('at the end of the day', 'slop', 'AI hallmark'),
('let''s explore', 'slop', 'AI hallmark'),
('in conclusion', 'slop', 'AI hallmark'),
('unlock your potential', 'slop', 'AI hallmark'),
('reach new heights', 'slop', 'AI hallmark'),
('drive growth', 'slop', 'AI hallmark'),
('it goes without saying', 'slop', 'AI hallmark'),
('the fact of the matter is', 'slop', 'AI hallmark')
ON CONFLICT (phrase) DO NOTHING;

-- RLS POLICIES
ALTER TABLE domain_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "domain_signals_service_all" ON domain_signals FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "domain_signals_admin_read" ON domain_signals FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE convergence_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "convergence_signals_service_all" ON convergence_signals FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "convergence_signals_admin_read" ON convergence_signals FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "predictions_service_all" ON predictions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "predictions_admin_read" ON predictions FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE quality_gate_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "quality_gate_log_service_all" ON quality_gate_log FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "quality_gate_log_admin_read" ON quality_gate_log FOR SELECT USING (auth.role() = 'authenticated');

ALTER TABLE banned_phrases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banned_phrases_service_all" ON banned_phrases FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "banned_phrases_admin_read" ON banned_phrases FOR SELECT USING (auth.role() = 'authenticated');
