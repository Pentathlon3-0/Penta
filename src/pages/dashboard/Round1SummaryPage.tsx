import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import "../../Styles/Round1SummaryPage.css";
import { supabase } from "../../integrations/supabase/client";

interface TeamSummary {
  id: string;
  name: string;
  score: number;
}

const Round1SummaryPage = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  if (!loading && !isAdmin) {
    navigate("/dashboard", { replace: true });
  }

  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loadingState, setLoadingState] = useState(true);

  const loadSummary = async () => {
    setLoadingState(true);

    const { data: teamsData, error: teamsError } = await supabase
      .from("teams")
      .select("id, name");

    if (teamsError || !teamsData) {
      alert("Failed to load teams");
      setLoadingState(false);
      return;
    }

    // fetch live scores directly
    const { data: liveData } = await (supabase as any)
      .from("livescore")
      .select("school_id, round1_final, round2_final");

    const liveMap = new Map<string, any>();
    (liveData || []).forEach((row: any) => liveMap.set(row.school_id, row));

    const result: TeamSummary[] = teamsData.map(team => {
      const live = liveMap.get(team.id) || {};
      const total = (live.round1_final || 0) + (live.round2_final || 0);
      return {
        id: team.id,
        name: team.name,
        score: total,
      };
    });

    result.sort((a, b) => b.score - a.score);

    setTeams(result);
    setLoadingState(false);
  };

  useEffect(() => {
    loadSummary();
  }, []);

  return (
    <div className="team-bg">
      <div className="team-card">
        <h2 className="team-title">KNOCK OUT ROUND</h2>

        {loadingState ? (
          <p style={{ textAlign: "center", color: "#fff" }}>
            Loading summary...
          </p>
        ) : (
          <div className="score-list">
            {teams.map((team, index) => (
              <div key={team.id} className={`leader-row rank-${index + 1}`}>
                <div className="avatar">
                  {index + 1}
                </div>
                <div className="leader-content">
                  <span className="leader-name">{team.name}</span>
                </div>
                <div className="leader-score">
                  {team.score}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default Round1SummaryPage;
