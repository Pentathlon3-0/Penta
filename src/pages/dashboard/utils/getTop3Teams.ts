import { supabase } from "../../../integrations/supabase/client";

export async function getTop3TeamsFromLivescore() {
  // Fetch all livescore rows
  const { data, error } = await (supabase as any)
    .from("livescore")
    .select("school_id, round1_final, round2_final, qualifier_round1_final, qualifier_round2_final");

  if (error) throw error;
  if (!data) return [];

  // Sum the four columns for each team
  const teamTotals = data.map(row => ({
    school_id: row.school_id,
    total: (row.round1_final || 0) + (row.round2_final || 0) + (row.qualifier_round1_final || 0) + (row.qualifier_round2_final || 0)
  }));

  // Sort by total descending and take top 3
  const top3 = teamTotals.sort((a, b) => b.total - a.total).slice(0, 3);

  if (!top3.length) return [];

  // Optionally fetch team names if there are any
  const { data: teams, error: teamError } = await (supabase as any)
    .from("teams")
    .select("id, name")
    .in("id", top3.map(t => t.school_id));

  if (teamError) throw teamError;

  return top3.map(t => ({
    id: t.school_id,
    name: teams?.find(team => team.id === t.school_id)?.name || t.school_id,
    total: t.total
  }));
}
