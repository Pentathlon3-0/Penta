import { useEffect, useState } from "react";
import { calculateBuzzerPlayerPerformance } from "./buzzerScoring";
import "../../Styles/PlayerPerformancePage.css";
import { supabase } from "../../integrations/supabase/client";

type TeamRow = {
  id: string;
  name: string;
};

type PlayerRow = {
  id: string;
  name: string;
  team_id: string;
};

type PlayerPerformance = {
  playerId: string;
  playerName: string;
  schoolName: string;
  correctAnswers: number;
  score: number;
  buzzerCorrect?: number;
  buzzerWrong?: number;
  buzzerScore?: number;
};

const PlayerPerformancePage = () => {
  const [rows, setRows] = useState<PlayerPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPerformance = async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    }

    const [detailsResp, teamsResp, playersResp, buzzerResp] = await Promise.all([
      (supabase as any).from("qualifier1_details").select("performance, players"),
      (supabase as any).from("teams").select("id, name"),
      (supabase as any).from("players").select("id, name, team_id"),
      (supabase as any).from("final_round").select("school_id, buzar_performance"),
    ]);

    const details = detailsResp.data || [];
    const teams: TeamRow[] = teamsResp.data || [];
    const players: PlayerRow[] = playersResp.data || [];

    const teamById = new Map<string, TeamRow>(teams.map((t) => [t.id, t]));
    const playerById = new Map<string, PlayerRow>(players.map((p) => [p.id, p]));
    const aggregate = new Map<string, PlayerPerformance>();

    // --- Buzzer round player performance ---
    const buzzerByPlayer: Record<string, { correct: number; wrong: number; score: number }> = {};
    (buzzerResp.data || []).forEach((row: any) => {
      const perf = calculateBuzzerPlayerPerformance(row.buzar_performance);
      Object.entries(perf).forEach(([playerId, val]) => {
        if (!buzzerByPlayer[playerId]) buzzerByPlayer[playerId] = { correct: 0, wrong: 0, score: 0 };
        buzzerByPlayer[playerId].correct += val.correct;
        buzzerByPlayer[playerId].wrong += val.wrong;
        buzzerByPlayer[playerId].score += val.score;
      });
    });

    details.forEach((detail: any) => {
      const performance = detail?.performance && typeof detail.performance === "object" ? detail.performance : {};
      const selectedPlayers = detail?.players && typeof detail.players === "object" ? detail.players : {};

      Object.entries(selectedPlayers).forEach(([teamId, playerIdRaw]) => {
        const playerId = String(playerIdRaw || "").trim();
        if (!playerId) return;

        const circles = Array.isArray(performance[teamId]) ? performance[teamId] : [];
        const correct = circles.length;
        const playerMeta = playerById.get(playerId);
        const resolvedTeamId = playerMeta?.team_id || teamId;

        const buzzer = buzzerByPlayer[playerId] || { correct: 0, wrong: 0, score: 0 };
        const existing = aggregate.get(playerId);
        if (existing) {
          existing.correctAnswers += correct + buzzer.correct - buzzer.wrong;
          existing.score = existing.score + buzzer.score;
          return;
        }

        aggregate.set(playerId, {
          playerId,
          playerName: playerMeta?.name || "Unknown Player",
          schoolName: teamById.get(resolvedTeamId)?.name || "Unknown School",
          correctAnswers: correct + buzzer.correct - buzzer.wrong,
          score: correct * 10 + buzzer.score,
        });
      });
    });

    const sorted = Array.from(aggregate.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.playerName.localeCompare(b.playerName);
    });

    setRows(sorted);
    setLoading(false);
  };

  useEffect(() => {
    loadPerformance(true);

    const channel = supabase
      .channel("qualifier1-player-performance")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "qualifier1_details" },
        () => loadPerformance(false)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "qualifier1_details" },
        () => loadPerformance(false)
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "qualifier1_details" },
        () => loadPerformance(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="player-performance-bg">
      <div className="player-performance-card">
        <h1 className="player-performance-title">Qualifier 1 Player Performance</h1>

        {loading ? (
          <p className="player-performance-loading">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="player-performance-loading">No player performance data available yet.</p>
        ) : (
          <div className="player-performance-table-wrap">
            <table className="player-performance-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Player Name</th>
                  <th>School Name</th>
                  <th>Correct Answers</th>
                  <th>Score (x10)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={row.playerId}>
                    <td>{idx + 1}</td>
                    <td>{row.playerName}</td>
                    <td>{row.schoolName}</td>
                    <td>{row.correctAnswers}</td>
                    <td>{row.score}</td>
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

export default PlayerPerformancePage;