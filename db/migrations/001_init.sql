-- Simulization initial schema (Postgres / Neon). CLAUDE.md Part 6.

CREATE TABLE IF NOT EXISTS runs (
  id            text PRIMARY KEY,
  condition     text NOT NULL CHECK (condition IN ('LABELED', 'BLIND')),
  seed          integer NOT NULL,
  status        text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'failed')),
  current_round integer NOT NULL DEFAULT 0,
  current_phase text,
  config        jsonb NOT NULL DEFAULT '{}'::jsonb,
  final_scores  jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agents (
  run_id   text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  name     text NOT NULL,
  company  text NOT NULL,
  provider text NOT NULL,
  model    text NOT NULL,
  state    jsonb, -- used only by the Neon fallback AgentStore
  PRIMARY KEY (run_id, agent_id)
);

CREATE TABLE IF NOT EXISTS events (
  id             text PRIMARY KEY, -- `${run_id}-${seq}`
  run_id         text NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq            integer NOT NULL,
  round          integer NOT NULL,
  phase          text NOT NULL,
  type           text NOT NULL,
  actor_id       text NOT NULL, -- agent id or 'world'
  actor_company  text,
  target_id      text,
  target_company text,
  channel        text,          -- 'public' | 'dm' | coalition channel id
  text           text,
  private_plan   text,
  claim          jsonb,         -- { goodId, claimedQuality, price }
  ground_truth   jsonb,         -- { trueQuality }
  flags          text[] NOT NULL DEFAULT '{}',
  ts             timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS events_run_seq_idx ON events (run_id, seq);

CREATE TABLE IF NOT EXISTS metrics (
  run_id  text PRIMARY KEY REFERENCES runs(id) ON DELETE CASCADE,
  metrics jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id         text PRIMARY KEY,
  run_id     text REFERENCES runs(id) ON DELETE CASCADE, -- null for cross-run synthesis
  kind       text NOT NULL CHECK (kind IN ('run', 'synthesis')),
  content    jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS reviews_run_idx ON reviews (run_id);
