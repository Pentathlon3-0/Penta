-- create tables for team-player scoring system

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamp default now()
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete cascade,
  name text not null
);

-- Rounds table
CREATE TABLE IF NOT EXISTS rounds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  score_type text check (score_type in ('team', 'player'))
);

-- Scores table
CREATE TABLE IF NOT EXISTS scores (
  id uuid primary key default gen_random_uuid(),
  round_id uuid references rounds(id),
  team_id uuid references teams(id),
  player_id uuid references players(id),
  points int not null
);

-- Enable RLS
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Allow public access (for now)
CREATE POLICY "Allow all" ON teams FOR ALL USING (true);
CREATE POLICY "Allow all" ON players FOR ALL USING (true);
CREATE POLICY "Allow all" ON rounds FOR ALL USING (true);
CREATE POLICY "Allow all" ON scores FOR ALL USING (true);
