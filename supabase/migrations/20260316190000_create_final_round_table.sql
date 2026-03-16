
-- Create the final_round table
create table if not exists final_round (
	school_id uuid primary key references teams(id) on delete cascade,
	clever_mind_score integer not null default 0,
	brain_maze_score integer not null default 0
);

-- Enable Row Level Security
alter table final_round enable row level security;

-- Policy: Allow all authenticated users to select rows
create policy "Allow read for all authenticated"
	on final_round
	for select
	using (auth.role() = 'authenticated');

-- Policy: Allow all authenticated users to update rows
create policy "Allow update for all authenticated"
	on final_round
	for update
	using (auth.role() = 'authenticated')
	with check (auth.role() = 'authenticated');

-- Policy: Allow all authenticated users to insert rows
create policy "Allow insert for all authenticated"
	on final_round
	for insert
	with check (auth.role() = 'authenticated');
