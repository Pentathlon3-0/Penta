import { useEffect, useState } from "react";
import { supabase } from "../../integrations/supabase/client";
import { SidebarProvider } from "../../components/ui/sidebar";
import "../../Styles/FinalScoreboardPage.css";

interface TeamScore {
  school_id: string;
  name: string;
  clever_mind_score: number;
  brain_maze_score: number;
  buzar_score: number;
  total: number;
}

const FinalScoreboardPage = () => {
  const [scores, setScores] = useState<TeamScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScores = async () => {
      setLoading(true);
      // Fetch all final_round rows with team names
      const { data: finals } = await (supabase as any)
        .from("final_round")
        .select("school_id, clever_mind_score, brain_maze_score, buzar_score, teams(name)");
      if (!finals) {
        setScores([]);
        setLoading(false);
        return;
      }
      const mapped: TeamScore[] = finals.map((row: any) => ({
        school_id: row.school_id,
        name: row.teams?.name || row.school_id,
        clever_mind_score: row.clever_mind_score || 0,
        brain_maze_score: row.brain_maze_score || 0,
        buzar_score: row.buzar_score || 0,
        total: (row.clever_mind_score || 0) + (row.brain_maze_score || 0) + (row.buzar_score || 0),
      }));
      // Sort by total descending
      mapped.sort((a, b) => b.total - a.total);
      setScores(mapped);
      setLoading(false);
    };
    fetchScores();
  }, []);

  return (
    <div className="final-score-bg">
      <div className="final-score-main">
        <h2 className="final-score-title">Final Round Scoreboard</h2>
        {loading ? (
          <p className="final-score-loading">Loading scores...</p>
        ) : (
          <div className="final-score-table-wrapper">
            <table className="final-scoreboard-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>School</th>
                  <th>Clever Mind</th>
                  <th>Brain Maze</th>
                  <th>Buzar</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((team, idx) => (
                  <tr key={team.school_id}>
                    <td>{idx + 1}</td>
                    <td>{team.name}</td>
                    <td>{team.clever_mind_score}</td>
                    <td>{team.brain_maze_score}</td>
                    <td>{team.buzar_score}</td>
                    <td>{team.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinalScoreboardPage;
