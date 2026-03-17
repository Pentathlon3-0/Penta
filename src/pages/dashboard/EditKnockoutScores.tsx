import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "../../hooks/useAuth";

const SUBJECTS = [
  { key: "maths", credit: 3 },
  { key: "science", credit: 3 },
  { key: "it", credit: 2 },
  { key: "gk", credit: 1 },
  { key: "sports", credit: 1 },
];

const ADMIN_PASSWORD = "2K26";

const EditKnockoutScores: React.FC = () => {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [teams, setTeams] = useState<any[]>([]);
  const [round1Details, setRound1Details] = useState<any[]>([]);
  const [round2Details, setRound2Details] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editType, setEditType] = useState<"round1" | "round2">("round1");

  useEffect(() => {
    if (authenticated) {
      fetchData();
    }
    // eslint-disable-next-line
  }, [authenticated]);


  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const { data: teamsData } = await supabase.from("teams").select("id, name");
      setTeams(teamsData || []);
      // Use 'as any' to bypass type errors for round1_details
      const { data: details } = await (supabase.from("round1_details" as any) as any).select("team_id, choices, round2_score");
      // Build a map for fast lookup
      const detailMap: Record<string, any> = {};
      (details || []).forEach((row: any) => {
        detailMap[row.team_id] = row;
      });
      // For round1Details and round2Details, always build arrays in teams order
      setRound1Details((teamsData || []).map((team: any) => detailMap[team.id] || { team_id: team.id, choices: {} }));
      setRound2Details((teamsData || []).map((team: any) => detailMap[team.id] || { team_id: team.id, round2_score: 0 }));
    } catch (err) {
      setError("Failed to fetch data");
    }
    setLoading(false);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
    } else {
      setError("Incorrect password");
    }
  };


  // Convert counts to choices array (for UI)
  const countsToChoices = (counts: Record<string, number>) => {
    return SUBJECTS.reduce((obj, s) => {
      const n = counts[s.key] || 0;
      // Always start from 0, not 1
      obj[s.key] = Array.from({ length: n }, (_, i) => i);
      return obj;
    }, {} as Record<string, number[]>);
  };

  // Convert choices array to counts (for saving)
  const choicesToCounts = (choices: any) => {
    return SUBJECTS.reduce((obj, s) => {
      const arr = choices[s.key] || [];
      obj[s.key] = arr.length;
      return obj;
    }, {} as Record<string, number>);
  };

  // For round 1, allow toggling circles
  const handleRound1Circle = (teamIndex: number, subjectKey: string, circleIndex: number) => {
    setRound1Details(prev => prev.map((row, idx) => {
      if (idx !== teamIndex) return row;
      const choices = countsToChoices(row.choices || {});
      const arr = choices[subjectKey] || [];
      const newArr = arr.includes(circleIndex)
        ? arr.filter((c: number) => c !== circleIndex)
        : [...arr, circleIndex];
      return {
        ...row,
        choices: choicesToCounts({ ...choices, [subjectKey]: newArr })
      };
    }));
  };

  const handleRound2Edit = (teamId: string, newScore: number) => {
    setRound2Details(prev => prev.map(row => row.team_id === teamId ? { ...row, round2_score: newScore } : row));
  };

  const saveEdits = async () => {
    setLoading(true);
    setError("");
    try {
      if (editType === "round1") {
        // Find or create Knockout 1 round id ONCE
        let roundId;
        const { data: roundData } = await supabase.from("rounds").select("id").eq("name", "Knockout 1").single();
        if (roundData && roundData.id) {
          roundId = roundData.id;
        } else {
          const { data: newRound } = await supabase.from("rounds").insert({ name: "Knockout 1", score_type: "team" }).select().single();
          roundId = newRound.id;
        }
        for (let i = 0; i < round1Details.length; i++) {
          const row = round1Details[i];
          await (supabase.from("round1_details" as any) as any).update({ choices: row.choices }).eq("team_id", row.team_id);
          // Calculate total exactly as in Round1Page
          const choices = countsToChoices(row.choices || {});
          let sum = 0;
          SUBJECTS.forEach(sub => {
            sum += (choices[sub.key]?.length || 0) * sub.credit;
          });
          // In Round1Page, total is Math.round(total * 40)
          const total = Math.round((sum / 10) * 40);
          await (supabase.from("livescore" as any) as any).upsert({ school_id: row.team_id, round1_final: total }, { onConflict: "school_id" });
          // Upsert score for this team (include id for upsert to work)
          // First, try to find existing score row for this round/team
          let scoreId = undefined;
          const { data: existingScore } = await supabase.from("scores").select("id").eq("round_id", roundId).eq("team_id", row.team_id).maybeSingle();
          if (existingScore && existingScore.id) scoreId = existingScore.id;
          await supabase.from("scores").upsert({ id: scoreId, round_id: roundId, team_id: row.team_id, points: total }, { onConflict: "id" });
        }
      } else {
        // Find or create Knockout 2 round id ONCE
        let roundId;
        const { data: roundData } = await supabase.from("rounds").select("id").eq("name", "Knockout 2").single();
        if (roundData && roundData.id) {
          roundId = roundData.id;
        } else {
          const { data: newRound } = await supabase.from("rounds").insert({ name: "Knockout 2", score_type: "team" }).select().single();
          roundId = newRound.id;
        }
        for (let i = 0; i < round2Details.length; i++) {
          const row = round2Details[i];
          await (supabase.from("round1_details" as any) as any).update({ round2_score: row.round2_score }).eq("team_id", row.team_id);
          // Also update livescore table: update both round2_live and round2_final with the same value
          await (supabase.from("livescore" as any) as any).upsert({ school_id: row.team_id, round2_live: row.round2_score, round2_final: row.round2_score }, { onConflict: "school_id" });
          // Upsert score for this team (include id for upsert to work)
          let scoreId = undefined;
          const { data: existingScore } = await supabase.from("scores").select("id").eq("round_id", roundId).eq("team_id", row.team_id).maybeSingle();
          if (existingScore && existingScore.id) scoreId = existingScore.id;
          await supabase.from("scores").upsert({ id: scoreId, round_id: roundId, team_id: row.team_id, points: row.round2_score }, { onConflict: "id" });
        }
      }
      await fetchData();
      alert("Edits saved!");
    } catch (err) {
      setError("Failed to save edits");
    }
    setLoading(false);
  };

  if (!authenticated) {
    return (
      <div className="edit-knockout-container">
        <h2>Admin Edit Knockout Scores</h2>
        <form onSubmit={handlePasswordSubmit}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter admin password"
          />
          <button type="submit">Login</button>
        </form>
        {error && <div className="error">{error}</div>}
      </div>
    );
  }

  return (
    <div className="edit-knockout-container">
      <h2>Edit Knockout Scores</h2>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setEditType("round1")}
          style={{
            padding: '0.5rem 1.5rem',
            borderRadius: '1.5rem',
            border: editType === 'round1' ? '2px solid #3b82f6' : '2px solid #334155',
            background: editType === 'round1' ? 'rgba(59,130,246,0.15)' : 'rgba(30,41,59,0.5)',
            color: editType === 'round1' ? '#fff' : '#cbd5e1',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Edit Knockout Round 1
        </button>
        <button
          onClick={() => setEditType("round2")}
          style={{
            padding: '0.5rem 1.5rem',
            borderRadius: '1.5rem',
            border: editType === 'round2' ? '2px solid #3b82f6' : '2px solid #334155',
            background: editType === 'round2' ? 'rgba(59,130,246,0.15)' : 'rgba(30,41,59,0.5)',
            color: editType === 'round2' ? '#fff' : '#cbd5e1',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Edit Knockout Round 2
        </button>
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="error">{error}</div>
      ) : (
        <>
          {editType === "round1" ? (
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
                  {teams.map((team, tIndex) => {
                    // Ensure team order and marks are correct
                    const detail = round1Details.find(row => row.team_id === team.id) || { team_id: team.id, choices: {} };
                    const choices = countsToChoices(detail.choices || {});
                    let sum = 0;
                    SUBJECTS.forEach(sub => {
                      sum += (choices[sub.key]?.length || 0) * sub.credit;
                    });
                    // Match Round1Page: Math.round(total * 40)
                    const total = Math.round((sum / 10) * 40);
                    return (
                      <tr key={team.id} className="score-grid">
                        <td className="team">{team.name}</td>
                        {SUBJECTS.map(sub => (
                          <td key={sub.key}>
                            <div className="circle-group">
                              {[0, 1, 2, 3, 4].map(c => (
                                <div
                                  key={c}
                                  className={`circle-r1 ${choices[sub.key]?.includes(c) ? "active" : ""}`}
                                  onClick={() => handleRound1Circle(tIndex, sub.key, c)}
                                />
                              ))}
                            </div>
                          </td>
                        ))}
                        <td className="total">{total}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="round2-table">
              <table>
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
                  {teams.map((team, i) => {
                    const detail = round2Details[i] || {};
                    return (
                      <tr key={team.id}>
                        <td className="team-name">{team.name}</td>
                        <td>
                          <input
                            type="number"
                            value={detail.round2_score || 0}
                            min={0}
                            max={100}
                            style={{ width: '100%' }}
                            onChange={e => handleRound2Edit(team.id, Math.max(0, Math.min(100, Number(e.target.value))))}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <button onClick={saveEdits}>Save Edits</button>
        </>
      )}
    </div>
  );
};

export default EditKnockoutScores;
