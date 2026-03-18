import React, { useEffect, useState } from "react";
import { getTop3TeamsFromLivescore } from "./utils/getTop3Teams";
import "../../Styles/Round3Page.css";
// --- Final Round Edit Component ---
type Team = {
  id: string;
  name: string;
  members: { id: string; name: string }[];
};
type CircleState = "empty" | "green" | "red";
const ROWS = 5;
const COLS = 5;
const createRow = (): CircleState[] => Array(COLS).fill("empty");

function FinalRoundEdit({ onClose }: { onClose: () => void }) {
  const [team1, setTeam1] = useState<Team | null>(null);
  const [team2, setTeam2] = useState<Team | null>(null);
  const [team3, setTeam3] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [round1, setRound1] = useState<{ t1: number | ""; t2: number | ""; t3: number | "" }>({ t1: "", t2: "", t3: "" });
  const [round2, setRound2] = useState<{ t1: number | ""; t2: number | ""; t3: number | "" }>({ t1: "", t2: "", t3: "" });
  const [team1Circles, setTeam1Circles] = useState<CircleState[][]>(Array.from({ length: ROWS }, createRow));
  const [team2Circles, setTeam2Circles] = useState<CircleState[][]>(Array.from({ length: ROWS }, createRow));
  const [team3Circles, setTeam3Circles] = useState<CircleState[][]>(Array.from({ length: ROWS }, createRow));
  const [team1Selected, setTeam1Selected] = useState<string[]>(Array(ROWS).fill(""));
  const [team2Selected, setTeam2Selected] = useState<string[]>(Array(ROWS).fill(""));
  const [team3Selected, setTeam3Selected] = useState<string[]>(Array(ROWS).fill(""));
  const [expandedBuzzerTeam, setExpandedBuzzerTeam] = useState<1 | 2 | 3 | null>(1);
  const [status, setStatus] = useState({ clever_mind_finished: false, brain_maze_finished: false, buzzer_finished: false });
  useEffect(() => {
    // On mount, set all booleans to false
    (async () => {
      await (supabase as any).from("final_round_status").update({ clever_mind_finished: false, brain_maze_finished: false, buzzer_finished: false }).eq("id", 1);
      setStatus({ clever_mind_finished: false, brain_maze_finished: false, buzzer_finished: false });
    })();
    // Load teams and scores
    (async () => {
      setLoading(true);
      try {
        const top3 = await getTop3TeamsFromLivescore();
        if (!top3 || top3.length < 3) throw new Error("Not enough teams");
        const loadTeam = async (team: any): Promise<Team> => {
          const { data: members } = await supabase.from("players").select("id, name").eq("team_id", team.id);
          return { id: team.id, name: team.name, members: members?.map((m: any) => ({ id: m.id, name: m.name })) || [] };
        };
        setTeam1(await loadTeam(top3[0]));
        setTeam2(await loadTeam(top3[1]));
        setTeam3(await loadTeam(top3[2]));
        // Load round scores
        const ids = [top3[0].id, top3[1].id, top3[2].id];
        const { data } = await (supabase as any).from("final_round").select("school_id, clever_mind_score, brain_maze_score, buzar_performance").in("school_id", ids);
        setRound1({
          t1: data?.find((row: any) => row.school_id === top3[0].id)?.clever_mind_score ?? "",
          t2: data?.find((row: any) => row.school_id === top3[1].id)?.clever_mind_score ?? "",
          t3: data?.find((row: any) => row.school_id === top3[2].id)?.clever_mind_score ?? "",
        });
        setRound2({
          t1: data?.find((row: any) => row.school_id === top3[0].id)?.brain_maze_score ?? "",
          t2: data?.find((row: any) => row.school_id === top3[1].id)?.brain_maze_score ?? "",
          t3: data?.find((row: any) => row.school_id === top3[2].id)?.brain_maze_score ?? "",
        });
        // Load buzzer state
        const loadBuzzer = (teamId: string, setCircles: any, setSelected: any) => {
          const row = data?.find((row: any) => row.school_id === teamId);
          if (!row?.buzar_performance) return;
          const perf = row.buzar_performance;
          const selected: string[] = Array(ROWS).fill("");
          const circles: CircleState[][] = Array.from({ length: ROWS }, createRow);
          let rowIdx = 0;
          Object.entries(perf).forEach(([playerId, val]: any) => {
            if (rowIdx < ROWS) {
              selected[rowIdx] = playerId;
              val.correct?.forEach((c: number) => { circles[rowIdx][c] = "green"; });
              val.wrong?.forEach((c: number) => { circles[rowIdx][c] = "red"; });
              rowIdx++;
            }
          });
          setSelected(selected);
          setCircles(circles);
        };
        loadBuzzer(top3[0].id, setTeam1Circles, setTeam1Selected);
        loadBuzzer(top3[1].id, setTeam2Circles, setTeam2Selected);
        loadBuzzer(top3[2].id, setTeam3Circles, setTeam3Selected);
      } catch (e: any) {
        setError(e.message);
      }
      setLoading(false);
    })();
  }, []);

  // Save helpers
  const saveFinalRoundScore = async (school_id: string, field: "clever_mind_score" | "brain_maze_score", value: number) => {
    const clever = field === "clever_mind_score" ? value : round1[[team1?.id, team2?.id, team3?.id].indexOf(school_id) === 0 ? "t1" : [team1?.id, team2?.id, team3?.id].indexOf(school_id) === 1 ? "t2" : "t3"] || 0;
    const brain = field === "brain_maze_score" ? value : round2[[team1?.id, team2?.id, team3?.id].indexOf(school_id) === 0 ? "t1" : [team1?.id, team2?.id, team3?.id].indexOf(school_id) === 1 ? "t2" : "t3"] || 0;
    await (supabase as any).from("final_round").upsert({ school_id, clever_mind_score: clever, brain_maze_score: brain });
  };
  function buildBuzarPerformance(circles: CircleState[][], selected: string[], team: Team) {
    const perf: Record<string, { correct: number[]; wrong: number[] }> = {};
    for (let r = 0; r < ROWS; r++) {
      const playerId = selected[r];
      if (!playerId) continue;
      if (!perf[playerId]) perf[playerId] = { correct: [], wrong: [] };
      for (let c = 0; c < COLS; c++) {
        if (circles[r][c] === "green") perf[playerId].correct.push(c);
        if (circles[r][c] === "red") perf[playerId].wrong.push(c);
      }
    }
    return perf;
  }
  async function saveBuzar(team: Team, circles: CircleState[][], selected: string[]) {
    const perf = buildBuzarPerformance(circles, selected, team);
    let correct = 0, wrong = 0;
    Object.values(perf).forEach(p => { correct += p.correct.length; wrong += p.wrong.length; });
    const score = correct * 20 - wrong * 10;
    await (supabase as any).from("final_round").upsert({ school_id: team.id, buzar_performance: perf, buzar_score: score });
  }
  // Save round status
  const saveStatus = async (field: "clever_mind_finished" | "brain_maze_finished" | "buzzer_finished") => {
    await (supabase as any).from("final_round_status").update({ [field]: true }).eq("id", 1);
    setStatus(s => ({ ...s, [field]: true }));
  };

  if (loading) return <div style={{ color: "#fff", textAlign: "center" }}>Loading Final Round Edit...</div>;
  if (error) return <div style={{ color: "#fff", textAlign: "center" }}>{error}</div>;
  if (!team1 || !team2 || !team3) return <div style={{ color: "#fff", textAlign: "center" }}>No teams found</div>;

  return (
    <div className="round2-bg">
      <div className="round2-card">
        <h2 className="final-round-title">Edit Final Round</h2>
        <h3 className="round-title">Clever Minds</h3>
        <div className="round-section">
          <div className="teams-grid">
            {[team1, team2, team3].map((team, idx) => (
              <div className="team-column" key={team.id}>
                <span className="team-name">{team.name}</span>
                <input
                  className="glass-score"
                  type="number"
                  value={round1[`t${idx + 1}`]}
                  onChange={e => {
                    const val = Number(e.target.value) || "";
                    setRound1(prev => ({ ...prev, [`t${idx + 1}`]: val }));
                    if (val !== "") saveFinalRoundScore(team.id, "clever_mind_score", Number(val));
                  }}
                  disabled={status.clever_mind_finished}
                  placeholder="Score"
                />
              </div>
            ))}
          </div>
          <div className="round-btn-row">
            <button
              className={`round-finish-btn ${status.clever_mind_finished ? "finished" : ""}`}
              onClick={() => saveStatus("clever_mind_finished")}
              disabled={status.clever_mind_finished}
            >
              {status.clever_mind_finished ? "Saved" : "Save Edit"}
            </button>
          </div>
        </div>
        <h3 className="round-title">Brain maze</h3>
        <div className="round-section">
          <div className="teams-grid">
            {[team1, team2, team3].map((team, idx) => (
              <div className="team-column" key={team.id}>
                <span className="team-name">{team.name}</span>
                <input
                  className="glass-score"
                  type="number"
                  value={round2[`t${idx + 1}`]}
                  onChange={e => {
                    const val = Number(e.target.value) || "";
                    setRound2(prev => ({ ...prev, [`t${idx + 1}`]: val }));
                    if (val !== "") saveFinalRoundScore(team.id, "brain_maze_score", Number(val));
                  }}
                  disabled={status.brain_maze_finished}
                  placeholder="Score"
                />
              </div>
            ))}
          </div>
          <div className="round-btn-row">
            <button
              className={`round-finish-btn ${status.brain_maze_finished ? "finished" : ""}`}
              onClick={() => saveStatus("brain_maze_finished")}
              disabled={status.brain_maze_finished}
            >
              {status.brain_maze_finished ? "Saved" : "Save Edit"}
            </button>
          </div>
        </div>
        <h3 className="round-title">Buzzer Round</h3>
        <div className="buzzer-container">
          {[team1, team2, team3].map((team, teamIndex) => {
            const teamNo = (teamIndex + 1) as 1 | 2 | 3;
            const selected = teamNo === 1 ? team1Selected : teamNo === 2 ? team2Selected : team3Selected;
            const setSelected = teamNo === 1 ? setTeam1Selected : teamNo === 2 ? setTeam2Selected : setTeam3Selected;
            const circles = teamNo === 1 ? team1Circles : teamNo === 2 ? team2Circles : team3Circles;
            const isExpanded = expandedBuzzerTeam === teamNo;
            return (
              <div key={team.id} className="buzzer-team buzzer-accordion-item">
                <button
                  type="button"
                  className={`buzzer-team-toggle ${isExpanded ? "expanded" : ""}`}
                  onClick={() => setExpandedBuzzerTeam(isExpanded ? null : teamNo)}
                >
                  <span>{team.name}</span>
                  <span className="buzzer-team-toggle-icon">{isExpanded ? "-" : "+"}</span>
                </button>
                {isExpanded && (
                  <div className="buzzer-column">
                    {Array.from({ length: ROWS }).map((_, r) => (
                      <div key={r} className="buzzer-row">
                        <select
                          className="glass-select"
                          value={selected[r]}
                          onChange={e => {
                            const copy = [...selected];
                            copy[r] = e.target.value;
                            setSelected(copy);
                          }}
                          disabled={status.buzzer_finished}
                        >
                          <option value="" disabled hidden style={{ color: "#0f172a", backgroundColor: "#f8fafc" }}>
                            Select member
                          </option>
                          {team.members
                            .filter(m => !selected.includes(m.id) || selected[r] === m.id)
                            .map(m => (
                              <option
                                key={m.id}
                                value={m.id}
                                style={{ color: "#0f172a", backgroundColor: "#0284c7" }}
                              >
                                {m.name}
                              </option>
                            ))}
                        </select>
                        <div className="circle-row">
                          {circles[r].map((c, i) => (
                            <div
                              key={i}
                              className={`buzzer-circle ${c}`}
                              onClick={() => !status.buzzer_finished && (() => {
                                const setter = teamNo === 1 ? setTeam1Circles : teamNo === 2 ? setTeam2Circles : setTeam3Circles;
                                const data = teamNo === 1 ? team1Circles : teamNo === 2 ? team2Circles : team3Circles;
                                const updated = [...data];
                                updated[r] = [...updated[r]];
                                updated[r][i] = updated[r][i] === "green" ? "empty" : "green";
                                setter(updated);
                                saveBuzar(team, updated, selected);
                              })()}
                              onDoubleClick={() => !status.buzzer_finished && (() => {
                                const setter = teamNo === 1 ? setTeam1Circles : teamNo === 2 ? setTeam2Circles : setTeam3Circles;
                                const data = teamNo === 1 ? team1Circles : teamNo === 2 ? team2Circles : team3Circles;
                                const updated = [...data];
                                updated[r] = [...updated[r]];
                                updated[r][i] = "red";
                                setter(updated);
                                saveBuzar(team, updated, selected);
                              })()}
                              style={status.buzzer_finished ? { cursor: "not-allowed", opacity: 0.5 } : {}}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="round-btn-row">
          <button
            className={`round-finish-btn ${status.buzzer_finished ? "finished" : ""}`}
            onClick={() => saveStatus("buzzer_finished")}
            disabled={status.buzzer_finished}
          >
            {status.buzzer_finished ? "Saved" : "Save Edit"}
          </button>
        </div>
      </div>
    </div>
  );
}
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
  const [editType, setEditType] = useState<"round1" | "round2" | "final">("round1");

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
        <button
          onClick={() => setEditType("final")}
          style={{
            padding: '0.5rem 1.5rem',
            borderRadius: '1.5rem',
            border: editType === 'final' ? '2px solid #3b82f6' : '2px solid #334155',
            background: editType === 'final' ? 'rgba(59,130,246,0.15)' : 'rgba(30,41,59,0.5)',
            color: editType === 'final' ? '#fff' : '#cbd5e1',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Edit Final Round
        </button>
      </div>
      {editType === "final" ? (
        <FinalRoundEdit onClose={() => setEditType("round1")} />
      ) : loading ? (
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
