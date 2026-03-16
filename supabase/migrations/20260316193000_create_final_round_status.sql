-- Create a table to track if each final round sub-round is finished
create table if not exists final_round_status (
  id serial primary key,
  clever_mind_finished boolean not null default false,
  brain_maze_finished boolean not null default false
);

-- Insert a single row if not exists (for single event)
insert into final_round_status (clever_mind_finished, brain_maze_finished)
select false, false
where not exists (select 1 from final_round_status);
