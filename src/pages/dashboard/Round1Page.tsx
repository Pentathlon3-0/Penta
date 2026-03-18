import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import "../../Styles/Round1Page.css";
import { supabase } from "../../integrations/supabase/client";
import Round1SummaryPage from "./Round1SummaryPage"; // reuse component
import { Button } from "../../components/ui/button";

async function upsertKnockoutScore({ roundId, teamId, playerId, points }) {
  const { error } = await supabase
    .from("scores")
    .upsert({
      round_id: roundId,
      team_id: teamId,
      player_id: playerId,
      points: points,
    }, { onConflict: "round_id,team_id,player_id" });
  if (error) {
    console.error("Failed to upsert knockout score:", error);
  }
}

type Team = {
  id: string;
  name: string;
};

const SUBJECTS = [
  { key: "maths", credit: 3 },
  { key: "science", credit: 3 },
  { key: "it", credit: 2 },
  { key: "gk", credit: 1 },
  { key: "sports", credit: 1 },
];

const TOTAL_CREDIT = 10;

const Round1Page = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();

  // redirect non-admins once auth state is known
  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [loading, isAdmin, navigate]);

  const [teams, setTeams] = useState<Team[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [round2Scores, setRound2Scores] = useState<(number | "")[]>([]);
  const [round1Locked, setRound1Locked] = useState(false);
  const [round2Locked, setRound2Locked] = useState(false);
  const [showSummary, setShowSummary] = useState(false); // controls modal


  useEffect(() => {
    loadEverything();
  }, []);

  const loadEverything = async () => {
    // fire both operations in parallel
    await Promise.all([loadTeams(), checkLocks()]);
  };

  /* ---------- LOAD TEAMS ---------- */
  /* helpers to convert between the internal array form and a compact jsonb summary */
  const choicesToCounts = (choices: any) => {
    return SUBJECTS.reduce((obj, s) => {
      const arr = choices[s.key] || [];
      obj[s.key] = arr.length;
      return obj;
    }, {} as Record<string, number>);
  };

  // helper to upsert a live score row for a team (identified by school/team id)
  const updateLiveScore = async (
    teamId: string,
    fields: Partial<{ round1_live: any; round1_final: number; round2_live: any; round2_final: number }>
  ) => {
    try {
      // supabase client types do not yet know about livescore table, cast to any
      const { error } = await (supabase as any)
        .from("livescore")
        .upsert({ school_id: teamId, ...fields }, { onConflict: "school_id" });
      if (error) console.error("livescore upsert error", error);
    } catch (err) {
      console.error("failed livescore update", err);
    }
  };

  const countsToChoices = (counts: Record<string, number>) => {
    return SUBJECTS.reduce((obj, s) => {
      const n = counts[s.key] || 0;
      obj[s.key] = Array.from({ length: n }, (_, i) => i);
      return obj;
    }, {} as Record<string, number[]>);
  };

  const loadTeams = async () => {
    const { data, error } = await supabase.from("teams").select("id, name");

    if (error) {
      alert("Failed to load teams");
      console.error(error);
      return;
    }

    setTeams(data || []);

    // prepare empty structures
    const emptyScores = (data || []).map(() =>
      Object.fromEntries(SUBJECTS.map(s => [s.key, []]))
    );
    const emptyR2 = (data || []).map(() => "" as number | "");

    setScores(emptyScores);
    setRound2Scores(emptyR2);

    // try loading existing detail rows so we can prefill
    const { data: details } = await (supabase as any)
      .from("round1_details")
      .select("team_id, choices, round2_score");

    if (details) {
      const detailMap = new Map<string, any>();
      details.forEach((d: any) => detailMap.set(d.team_id, d));

      setScores(prev =>
        prev.map((_, idx) => {
          const team = data![idx];
          const det = detailMap.get(team.id);
          return det ? countsToChoices(det.choices) : prev[idx];
        })
      );
      setRound2Scores(prev =>
        prev.map((_, idx) => {
          const team = data![idx];
          const det = detailMap.get(team.id);
          return det ? det.round2_score || "" : prev[idx];
        })
      );
    }
    console.log("loaded detail rows", details);
  };

  /* ---------- ENSURE ROUND EXISTS ---------- */
  const getOrCreateRound = async (roundName: string) => {
    let { data } = await supabase
      .from("rounds")
      .select("id")
      .eq("name", roundName)
      .single();

    if (!data) {
      const { data: newRound } = await supabase
        .from("rounds")
        .insert({ name: roundName, score_type: "team" })
        .select()
        .single();

      return newRound.id;
    }

    return data.id;
  };

  /* ---------- CHECK LOCKS ---------- */
  const checkLocks = async () => {
    // load both round ids and existence of scores in one trip using in
    const { data: roundsData } = await supabase
      .from("rounds")
      .select("id, name")
      .in("name", ["Knockout 1", "Knockout 2"]);

    if (roundsData) {
      const r1 = roundsData.find(r => r.name === "Knockout 1");
      const r2 = roundsData.find(r => r.name === "Knockout 2");

      const checks: Promise<any>[] = [];
      if (r1) {
        const resp = await supabase
          .from("scores")
          .select("id", { count: "exact", head: true })
          .eq("round_id", r1.id);
        if (resp.count && resp.count > 0) setRound1Locked(true);
      }
      if (r2) {
        const resp = await supabase
          .from("scores")
          .select("id", { count: "exact", head: true })
          .eq("round_id", r2.id);
        if (resp.count && resp.count > 0) setRound2Locked(true);
      }
    }
  };

  /* ---------- UI LOGIC ---------- */
  const toggleCircle = async (teamIndex: number, subjectKey: string, circleIndex: number) => {
    if (round1Locked) return;

    const updated = [...scores];
    const arr = updated[teamIndex][subjectKey] || [];

    updated[teamIndex][subjectKey] = arr.includes(circleIndex)
      ? arr.filter((c: number) => c !== circleIndex)
      : [...arr, circleIndex];

    setScores(updated);

    // save the change for this team immediately
    const team = teams[teamIndex];
    try {
      const { data: upsertData, error } = await (supabase as any)
        .from("round1_details")
        .upsert(
          { team_id: team.id, team_name: team.name, choices: choicesToCounts(updated[teamIndex]) },
          { onConflict: "team_id" }
        );
      if (error) {
        console.error("upsert error", error);
      } else {
        console.log("persisted detail for", team.name, upsertData);
      }
    } catch (err) {
      console.error("failed to persist round1 detail", err);
    }

    // update live score row as the user clicks circles
    const liveData = updated[teamIndex];
    const pts = Math.round(calculateRound1Total(teamIndex) *40);
    updateLiveScore(team.id, { round1_live: liveData, round1_final: pts });
  };

  const calculateRound1Total = (teamIndex: number) => {
    let sum = 0;
    SUBJECTS.forEach(sub => {
      sum += (scores[teamIndex]?.[sub.key]?.length || 0) * sub.credit;
    });
    return Number((sum / TOTAL_CREDIT).toFixed(2));
  };

  /* ---------- SAVE ROUND 1 ---------- */
  // save the raw circle choices to a supplemental table
  const saveRound1Details = async () => {
    const rows: any[] = teams.map((team, index) => ({
      team_id: team.id,
      team_name: team.name,
      choices: choicesToCounts(scores[index])
    }));
    console.log("saving batch details", rows);
    const { data, error } = await (supabase as any)
      .from("round1_details")
      .upsert(rows, { onConflict: "team_id" });
    if (error) console.error("batch upsert error", error);
    else console.log("batch saved", data);
  };

  const finishRound1 = async () => {
    const roundId = await getOrCreateRound("Knockout 1");

    // delete old scores for the round
    await supabase.from("scores").delete().eq("round_id", roundId);

    const inserts = teams.map((team, index) => ({
      round_id: roundId,
      team_id: team.id,
      points: Math.round(calculateRound1Total(index) * 40)
    }));

    await supabase.from("scores").insert(inserts);

    // and also persist the detailed selections
    await saveRound1Details();

    // after the batch insert also refresh the live‑score rows for each team
    teams.forEach((team, index) => {
      const pts = Math.round(calculateRound1Total(index) * 40);
      updateLiveScore(team.id, { round1_final: pts });
    });

    setRound1Locked(true);
    alert("✅ Round 1 saved");
  };

  /* ---------- SAVE ROUND 2 (Combined with Round 1) ---------- */
  const finishRound2 = async () => {
    const roundId = await getOrCreateRound("Knockout 2");

    await supabase.from("scores").delete().eq("round_id", roundId);

    // First get Knockout 1 scores to calculate combined total
    const ko1Round = await supabase.from("rounds").select("id").eq("name", "Knockout 1").single();
    let ko1Scores: { team_id: string; points: number }[] = [];
    if (ko1Round.data) {
      const { data } = await supabase.from("scores").select("team_id, points").eq("round_id", ko1Round.data.id);
      ko1Scores = data || [];
    }

    // Save combined: (Knockout 1 * 100) + Knockout 2
    const inserts = teams.map((team, index) => {
      const ko1 = ko1Scores.find(s => s.team_id === team.id)?.points || 0;
      const ko2 = Number(round2Scores[index] || 0);
      const combinedTotal = ko1 + ko2;
      
      return {
        round_id: roundId,
        team_id: team.id,
        points: combinedTotal
      };
    });

    await supabase.from("scores").insert(inserts);

    // also update the supplemental detail table with round2 values
    const detailRows: any[] = teams.map((team, index) => ({
      team_id: team.id,
      round2_score: round2Scores[index] || 0
    }));
    await (supabase as any).from("round1_details").upsert(detailRows, { onConflict: "team_id" });

    // update live table with knockout round 2 score only
    teams.forEach((team, index) => {
      const ko2 = Number(round2Scores[index] || 0);
      updateLiveScore(team.id, { round2_final: ko2 });
    });

    setRound2Locked(true);
    alert("✅ Round 2 saved");
  };

  // Utility to clamp a score to a maximum of 100
  function clampScore(score) {
    return Math.min(score, 100);
  }

  return (
    <div className="round1-bg">
      <div className="round1-card">
        <h1 className="knockout-title">Knock Out Round</h1>
        {/* only show round 1 form if not yet locked */}
        {!round1Locked && (
          <> 
            <h2>Quiz Storm</h2>

            {/* ===== ROUND 1 TABLE ===== */}
            <div className="round-table">
              <table>
                <thead>
                  <tr className="header">
                    <th className="team">Team</th>
                    {SUBJECTS.map(s => (
                      <th key={s.key}>{s.key.charAt(0).toUpperCase() + s.key.slice(1)}</th>
                    ))}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team, tIndex) => (
                    <tr key={team.id} className="score-grid">
                      <td className="team">{team.name}</td>

                      {SUBJECTS.map(sub => (
                        <td key={sub.key}>
                          <div className="circle-group">
                            {[0, 1, 2, 3, 4].map(c => (
                              <div
                                key={c}
                                className={`circle-r1 ${
                                  scores[tIndex]?.[sub.key]?.includes(c)
                                    ? "active"
                                    : ""
                                }`}
                                onClick={() =>
                                  toggleCircle(tIndex, sub.key, c)
                                }
                              />
                            ))}
                          </div>
                        </td>
                      ))}

                      <td className="total">
                        {calculateRound1Total(tIndex)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* FINISH ROUND 1 */}
            <div className="left-actions">
              <button
                className="finish-btn"
                onClick={finishRound1}
                disabled={round1Locked}
              >
                {round1Locked ? "ROUND 1 SAVED" : "SAVE ROUND 1"}
              </button>
            </div>
          </>
        )}

        {/* ===== ROUND 2 ===== */}
        {round1Locked && (
          <div className="section-gap">
            <h2>Path Finder</h2>

            <div className="round2-table">
              <table>
                {/* enforce stable 70/30 column width ratio */}
                <colgroup>
                  <col style={{ width: '70%' }} />
                  <col style={{ width: '30%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((team, i) => (
                    <tr key={team.id}>
                      <td className="team-name">{team.name}</td>
                      <td>
                        <input
                          type="number"
                          value={round2Scores[i]}
                          disabled={round2Locked}
                          style={{ width: '100%' }}
                          onChange={async e => {
                            const updated = [...round2Scores];
                            updated[i] =
                              e.target.value === ""
                                ? ""
                                : Number(e.target.value);
                            setRound2Scores(updated);

                            // persist round2 score change
                            const team = teams[i];
                            try {
                              // update existing detail row, choices may have changed
                              const { data: up, error } = await (supabase as any)
                                .from("round1_details")
                                .update({
                                  round2_score: updated[i] || 0,
                                  choices: choicesToCounts(scores[i])
                                })
                                .eq("team_id", team.id);
                              if (error) {
                                console.error("round2 update error", error);
                              } else {
                                console.log("updated round2 for", team.name, up);
                              }
                            } catch (err) {
                              console.error("failed to persist round2 score", err);
                            }

                            // update live score row for round2 as soon as value changes
                            const r2live = updated[i] || 0;
                            // combine with existing round1 points if available
                            const r1pts = Math.round(calculateRound1Total(i) * 100);
                            updateLiveScore(team.id, { round2_live: r2live, round2_final:  r2live });
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="left-actions">
              <button
                className="finish-btn"
                onClick={finishRound2}
                disabled={round2Locked}
              >
                {round2Locked ? "ROUND 2 SAVED" : "SAVE ROUND 2"}
              </button>
            </div>

            {round2Locked && (
              <div className="left-actions">
                <button
                  className="finish-btn"
                  onClick={() => setShowSummary(true)}
                >
                  VIEW SUMMARY
                </button>
              </div>
            )}
            {/* allow editing round1 even after it's been saved (before round2) */}
            // ...existing code...

          </div>
        )}
      </div>
      {/* summary modal */}
      {showSummary && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={() => setShowSummary(false)}>&times;</button>
            <Round1SummaryPage />
          </div>
        </div>
      )}

    </div>
  );
};

export default Round1Page;

// Add a placeholder for knockout2RoundId (replace with actual logic or prop)
const knockout2RoundId = "REPLACE_WITH_KNOCKOUT2_ROUND_ID"; // TODO: set this to the actual round 2 id
