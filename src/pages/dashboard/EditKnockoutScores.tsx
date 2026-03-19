// --- Qualifier Round 1 Edit Component ---
function QualifierRound1Edit({ onClose }: { onClose: () => void }) {
  const SUBJECTS = [
    { key: "maths", label: "Maths", credit: 3 },
    { key: "science", label: "Science", credit: 3 },
    { key: "it", label: "IT", credit: 2 },
    { key: "gk", label: "GK", credit: 1 },
    { key: "sports", label: "Sports", credit: 1 }
  ];
  const [teams, setTeams] = useState<any[]>([]);
  const [players, setPlayers] = useState<Record<string, string>>({}); // playerId -> playerName
  const [scores, setScores] = useState<any[][]>([]); // [team][subject], now with _circleColors
  const [finishedSubjects, setFinishedSubjects] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Set all subject statuses to false (unlocked for editing)
        for (const subj of SUBJECTS) {
          await (supabase.from("qualifier1_details" as any) as any)
            .update({ status: false })
            .eq("subject", subj.key);
        }
        // Fetch both Knockout 1 and Knockout 2 round IDs
        const { data: rounds } = await supabase
          .from("rounds")
          .select("id,name")
          .in("name", ["Knockout 1", "Knockout 2"]);
        if (!rounds || rounds.length < 2) throw new Error("Round 1 or 2 data missing");
        const r1 = rounds.find((r: any) => r.name === "Knockout 1");
        const r2 = rounds.find((r: any) => r.name === "Knockout 2");
        if (!r1 || !r2) throw new Error("Knockout rounds not found");
        // Fetch all scores for both rounds
        const { data: allScores } = await supabase
          .from("scores")
          .select("team_id, points, round_id")
          .in("round_id", [r1.id, r2.id]);
        if (!allScores) throw new Error("No scores data");
        // Sum points for each team across both rounds
        const totals: Record<string, number> = {};
        allScores.forEach((s: any) => {
          totals[s.team_id] = (totals[s.team_id] || 0) + s.points;
        });
        // Sort teams by total points descending and take top 5
        const sortedTeamIds = Object.entries(totals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(x => x[0]);
        // Fetch team info for these school_ids
        const { data: teamRows } = await supabase.from("teams").select("id, name").in("id", sortedTeamIds);
        setTeams(teamRows || []);
        // Fetch all players for these teams
        const teamIds = (teamRows || []).map(t => t.id);
        const { data: playerRows } = await supabase.from("players").select("id, name, team_id").in("team_id", teamIds);
        const playerMap: Record<string, string> = {};
        (playerRows || []).forEach((p: any) => { playerMap[p.id] = p.name; });
        setPlayers(playerMap);
        // Fetch details for all subjects
        const { data: details } = await (supabase.from("qualifier1_details" as any) as any).select("subject, performance, extras, players, status");
        // Build scores matrix for only top 5 teams
        const blankScores: any[][] = (teamRows || []).map(team =>
          SUBJECTS.map(() => ({ playerId: "", circles: [], extra: "", _circleColors: {} }))
        );
        const finished: Record<string, boolean> = {};
        if (details) {
          details.forEach((d: any) => {
            if (d.status === true) finished[d.subject] = true;
            const si = SUBJECTS.findIndex(s => s.key === d.subject);
            if (si >= 0) {
              (teamRows || []).forEach((team, t) => {
                // New format: d.performance?.[team.id] is {green:[],red:[],yellow:[]}
                const perf = d.performance?.[team.id];
                if (perf && typeof perf === 'object' && ('green' in perf || 'red' in perf || 'yellow' in perf)) {
                  const colorMap: { [circleIndex: number]: 'green' | 'red' | 'yellow' } = {};
                  let circles: number[] = [];
                  ['green','red','yellow'].forEach(color => {
                    (perf[color] || []).forEach((idx: number) => {
                      colorMap[idx] = color as 'green' | 'red' | 'yellow';
                      if (color === 'green') circles.push(idx);
                    });
                  });
                  blankScores[t][si]._circleColors = colorMap;
                  blankScores[t][si].circles = circles;
                } else {
                  // fallback: old format (array of green indices)
                  blankScores[t][si].circles = Array.isArray(perf) ? perf : [];
                  blankScores[t][si]._circleColors = {};
                  (Array.isArray(perf) ? perf : []).forEach((idx: number) => {
                    blankScores[t][si]._circleColors[idx] = 'green';
                  });
                }
                blankScores[t][si].extra = d.extras?.[team.id] ?? "";
                blankScores[t][si].playerId = d.players?.[team.id] || "";
              });
            }
          });
        }
        setScores(blankScores);
        setFinishedSubjects(finished);
      } catch (e: any) {
        setError(e.message);
      }
      setLoading(false);
    })();
  }, []);

  const subjectTotal = (m: any) => {
    const extra = m.extra === "" ? 0 : m.extra;
    // Count circles by color
    let green = 0, yellow = 0, red = 0;
    if (m._circleColors) {
      Object.values(m._circleColors).forEach((color: string) => {
        if (color === 'green') green++;
        else if (color === 'yellow') yellow++;
        else if (color === 'red') red++;
      });
    } else {
      green = m.circles.length;
    }
    // Calculation: (green*2 + extra*green) + (yellow*1 + extra*yellow) + (red*-1 + extra*red)
    const total = (green * 2 + yellow * 1 + red * -1) + extra * (green + yellow -red);
    return total;
  };

  const teamTotal = (t: number, arr?: any[][]) => {
    const src = arr || scores;
    let sum = 0;
    src[t].forEach((m, si) => {
      const credit = SUBJECTS[si].credit;
      sum += subjectTotal(m) * credit;
    });
    return Number((sum).toFixed(2));
  };

  // Save edits for a subject
  const saveSubjectEdits = async (si: number) => {
    setLoading(true);
    setError("");
    try {
      // Ensure every team has chosen a player for this subject
      for (let t = 0; t < teams.length; t++) {
        const m = scores[t][si];
        if (!m.playerId) {
          alert(`Choose a player for team ${teams[t].name}`);
          setLoading(false);
          return;
        }
      }
      // Build data for upsert
      const key = SUBJECTS[si].key;
      const performance: Record<string, { green: number[]; red: number[]; yellow: number[] }> = {};
      const extras: Record<string, number> = {};
      const players: Record<string, string> = {};
      teams.forEach((team, t) => {
        const colorMap = scores[t][si]._circleColors || {};
        const green: number[] = [];
        const red: number[] = [];
        const yellow: number[] = [];
        Object.entries(colorMap).forEach(([idx, color]) => {
          if (color === 'green') green.push(Number(idx));
          else if (color === 'red') red.push(Number(idx));
          else if (color === 'yellow') yellow.push(Number(idx));
        });
        performance[team.id] = { green, red, yellow };
        extras[team.id] = scores[t][si].extra === "" ? 0 : (scores[t][si].extra as number);
        players[team.id] = scores[t][si].playerId;
      });
      await (supabase.from("qualifier1_details" as any) as any).upsert({
        subject: key,
        performance,
        extras,
        players,
        status: true
      }, { onConflict: "subject" });
      // Update livescore and scores tables
      // Get round id for Qualifier 1
      let { data: roundData } = await supabase.from("rounds").select("id").eq("name", "Qualifier 1").single();
      let roundId = roundData?.id;
      if (!roundId) {
        const { data: newRound } = await supabase.from("rounds").insert({ name: "Qualifier 1", score_type: "team" }).select().single();
        roundId = newRound.id;
      }
      // Remove any existing scores for this round/team/subject
      await supabase.from("scores").delete().match({ round_id: roundId, subject: SUBJECTS[si].key });
      // Insert new scores for this subject
      const inserts = teams.map((team, t) => {
        const m = scores[t][si];
        const credit = SUBJECTS[si].credit;
        const total = subjectTotal(m) * credit;
        return {
          round_id: roundId,
          team_id: team.id,
          subject: SUBJECTS[si].key,
          points: Math.round(total),
        };
      });
      await supabase.from("scores").insert(inserts);
      // Update livescore for each team
      for (let t = 0; t < teams.length; t++) {
        const m = scores[t][si];
        const pts = Math.round(subjectTotal(m) * SUBJECTS[si].credit);
        await (supabase as any).from("livescore").upsert({ school_id: teams[t].id, [`${SUBJECTS[si].key}_qual1`]: pts }, { onConflict: "school_id" });
      }
      setFinishedSubjects(prev => ({ ...prev, [SUBJECTS[si].key]: true }));
      alert(`Edits for ${SUBJECTS[si].label} saved!`);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  if (loading) return <div style={{ color: "#fff", textAlign: "center" }}>Loading Qualifier Round 1 Edit...</div>;
  if (error) return <div style={{ color: "#fff", textAlign: "center" }}>{error}</div>;
  if (!teams.length) return <div style={{ color: "#fff", textAlign: "center" }}>No teams found</div>;

  return (
    <div className="round2-bg">
      <div className="round2-card">
        <h2 className="final-round-title">Edit Qualifier Round 1</h2>
        {SUBJECTS.map((s, si) => (
          <div key={si} className="team-section">
            <h3 style={{ textAlign: "left" }}>{s.label}</h3>
            <table className="qualifier-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Player</th>
                  <th>Score</th>
                  <th>Extra</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team, t) => (
                  <tr key={t} className={finishedSubjects[s.key] ? "row-disabled" : ""}>
                    <td>{team.name}</td>
                    <td>
                      <span>
                        {players[scores[t][si].playerId] || (scores[t][si].playerId ? scores[t][si].playerId : "")}
                      </span>
                    </td>
                    <td>
                      <div className="circle-group">
                        {[0, 1, 2, 3, 4].map(c => {
                          const color = scores[t][si]._circleColors ? scores[t][si]._circleColors[c] : undefined;
                          return (
                            <div
                              key={c}
                              className={`circle${color ? ` ${color}` : ""}`}
                              onClick={() => {
                                if (finishedSubjects[s.key]) return;
                                // Cycle color: undefined -> green -> red -> yellow -> undefined
                                let colorState = scores[t][si]._circleColors ? scores[t][si]._circleColors[c] : undefined;
                                let nextColor;
                                if (!colorState) nextColor = 'green';
                                else if (colorState === 'green') nextColor = 'red';
                                else if (colorState === 'red') nextColor = 'yellow';
                                else if (colorState === 'yellow') nextColor = undefined;

                                const updated = scores.map((teamArr, ti) =>
                                  ti !== t
                                    ? teamArr
                                    : teamArr.map((mem, mi) => {
                                        if (mi !== si) return mem;
                                        const newCircleColors = { ...(mem._circleColors || {}) };
                                        if (nextColor) newCircleColors[c] = nextColor;
                                        else delete newCircleColors[c];
                                        // For score logic, keep the original array logic (only green counts)
                                        let newArr = mem.circles.filter((x: number) => x !== c);
                                        if (nextColor === 'green') newArr = [...newArr, c];
                                        return {
                                          ...mem,
                                          circles: newArr,
                                          _circleColors: newCircleColors
                                        };
                                      })
                                );
                                setScores(updated);
                              }}
                            />
                          );
                        })}
                      </div>
                    </td>
                    <td>
                      <input
                        type="number"
                        className="extra-input"
                        disabled={finishedSubjects[s.key]}
                        value={typeof scores[t][si].extra === "undefined" ? "" : scores[t][si].extra}
                        onChange={e => {
                          if (finishedSubjects[s.key]) return;
                          const newVal = e.target.value === "" ? "" : Number(e.target.value);
                          const updated = scores.map((teamArr, ti) =>
                            ti !== t
                              ? teamArr
                              : teamArr.map((mem, mi) =>
                                  mi !== si
                                    ? mem
                                    : ({ ...mem, extra: newVal })
                                )
                          );
                          setScores(updated);
                        }}
                      />
                    </td>
                    <td>{subjectTotal(scores[t][si])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              className="finish-btn left"
              onClick={() => saveSubjectEdits(si)}
              disabled={finishedSubjects[s.key]}
            >
              {finishedSubjects[s.key] ? "SAVED" : "SAVE EDITS"}
            </button>
          </div>
        ))}
        <div className="button-group">
          <button className="glass-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
import React, { useEffect, useState } from "react";
// --- Qualifier Round 2 Edit Component ---
function QualifierRound2Edit({ onClose }: { onClose: () => void }) {
  const [teams, setTeams] = useState<any[]>([]);
  const [scores, setScores] = useState<(number | "")[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(false); // false = editing, true = finished

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Fetch status
        const { data: statusRow } = await (supabase.from("qualifier_round2_status" as any) as any)
          .select("id, qualifier_round2_status")
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();
        setStatus(statusRow?.qualifier_round2_status ?? false);

        // Fetch both Knockout 1 and Knockout 2 round IDs
        const { data: rounds } = await supabase
          .from("rounds")
          .select("id,name")
          .in("name", ["Knockout 1", "Knockout 2"]);
        if (!rounds || rounds.length < 2) throw new Error("Round 1 or 2 data missing");
        const r1 = rounds.find((r: any) => r.name === "Knockout 1");
        const r2 = rounds.find((r: any) => r.name === "Knockout 2");
        if (!r1 || !r2) throw new Error("Knockout rounds not found");

        // Fetch all scores for both rounds
        const { data: allScores } = await supabase
          .from("scores")
          .select("team_id, points, round_id")
          .in("round_id", [r1.id, r2.id]);
        if (!allScores) throw new Error("No scores data");

        // Sum points for each team across both rounds
        const totals: Record<string, number> = {};
        allScores.forEach((s: any) => {
          totals[s.team_id] = (totals[s.team_id] || 0) + s.points;
        });

        // Sort teams by total points descending and take top 5
        const sortedTeamIds = Object.entries(totals)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(x => x[0]);

        // Fetch team info for these school_ids
        const { data: teamRows } = await supabase.from("teams").select("id, name").in("id", sortedTeamIds);
        setTeams(teamRows || []);

        // Load existing round2 scores for these teams from livescore
        const { data: liveRows } = await (supabase as any)
          .from("livescore")
          .select("school_id, qualifier_round2_final");
        const filteredLiveRows = (liveRows || []).filter((row: any) => sortedTeamIds.includes(row.school_id));
        const r2scores = sortedTeamIds.map((id: string) => {
          const row: any = filteredLiveRows.find((r: any) => r.school_id === id);
          return row ? row.qualifier_round2_final ?? "" : "";
        });
        setScores(r2scores.map((v: any) => v === undefined ? "" : v));
      } catch (e: any) {
        setError(e.message);
      }
      setLoading(false);
    })();
  }, []);

  const saveEdit = async () => {
    setLoading(true);
    setError("");
    try {
      // Save scores to livescore and scores table
      // Get round2 id
      const { data: round2 } = await supabase.from("rounds").select("id").eq("name", "Qualifier 2").single();
      if (!round2) throw new Error("Round 2 not found");
      await supabase.from("scores").delete().eq("round_id", round2.id);
      const inserts = teams.map((t, i) => ({
        round_id: round2.id,
        team_id: t.id,
        points: Math.round(Number(scores[i] || 0))
      }));
      await supabase.from("scores").insert(inserts);
      // Update livescore
      for (let i = 0; i < teams.length; i++) {
        const pts = Math.round(Number(scores[i] || 0));
        await (supabase as any).from("livescore").upsert({ school_id: teams[i].id, qualifier_round2_final: pts }, { onConflict: "school_id" });
      }
      // Set status to true
      const { data: statusRow } = await (supabase.from("qualifier_round2_status" as any) as any)
        .select("id")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (statusRow && statusRow.id) {
        await (supabase.from("qualifier_round2_status" as any) as any)
          .update({ qualifier_round2_status: true })
          .eq("id", statusRow.id);
        setStatus(true);
      }
      alert("Qualifier Round 2 edits saved!");
      onClose();
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  if (loading) return <div style={{ color: "#fff", textAlign: "center" }}>Loading Qualifier Round 2 Edit...</div>;
  if (error) return <div style={{ color: "#fff", textAlign: "center" }}>{error}</div>;
  if (!teams.length) return <div style={{ color: "#fff", textAlign: "center" }}>No teams found</div>;

  return (
    <div className="round2-bg">
      <div className="round2-card">
        <h2 className="final-round-title">Edit Qualifier Round 2</h2>
        <div className="round2-table">
          <div className="round-header">
            <span style={{ textAlign: "left" }}>Team</span>
            <span>Score</span>
          </div>
          {teams.map((team, i) => (
            <div key={i} className="round2-row">
              <span style={{ textAlign: "left" }}>{team.name}</span>
              <input
                type="number"
                className="qr2-score-input oval"
                value={typeof scores[i] === "undefined" ? "" : scores[i]}
                onChange={e => {
                  if (status) return;
                  const copy = [...scores];
                  copy[i] = e.target.value === "" ? "" : Number(e.target.value);
                  setScores(copy);
                }}
                disabled={status}
              />
            </div>
          ))}
        </div>
        <div className="button-group">
          <button
            className="finish-btn"
            onClick={saveEdit}
            disabled={status}
          >
            {status ? "ROUND 2 FINISHED" : "SAVE EDIT"}
          </button>
          <button
            className="glass-btn"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
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
  const [editType, setEditType] = useState<"round1" | "round2" | "final" | "editQualifier2" | "editQualifier1">("round1");

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
          onClick={async () => {
            // Set status to false in qualifier_round2_status
            const { data: statusRow } = await (supabase.from("qualifier_round2_status" as any) as any)
              .select("id")
              .order("id", { ascending: false })
              .limit(1)
              .maybeSingle();
            if (statusRow && statusRow.id) {
              await (supabase.from("qualifier_round2_status" as any) as any)
                .update({ qualifier_round2_status: false })
                .eq("id", statusRow.id);
            } else {
              await (supabase.from("qualifier_round2_status" as any) as any)
                .insert({ qualifier_round2_status: false });
            }
            setEditType("editQualifier2");
          }}
          style={{
            padding: '0.5rem 1.5rem',
            borderRadius: '1.5rem',
            border: editType === 'editQualifier2' ? '2px solid #3b82f6' : '2px solid #334155',
            background: editType === 'editQualifier2' ? 'rgba(59,130,246,0.15)' : 'rgba(30,41,59,0.5)',
            color: editType === 'editQualifier2' ? '#fff' : '#cbd5e1',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          disabled={editType === 'editQualifier2'}
        >
          Edit Qualifier Round 2
        </button>

        <button
          onClick={async () => {
            // Set all subject statuses to false in qualifier1_details
            for (const subj of ["maths", "science", "it", "gk", "sports"]) {
              await (supabase.from("qualifier1_details" as any) as any)
                .update({ status: false })
                .eq("subject", subj);
            }
            setEditType("editQualifier1");
          }}
          style={{
            padding: '0.5rem 1.5rem',
            borderRadius: '1.5rem',
            border: editType === 'editQualifier1' ? '2px solid #3b82f6' : '2px solid #334155',
            background: editType === 'editQualifier1' ? 'rgba(59,130,246,0.15)' : 'rgba(30,41,59,0.5)',
            color: editType === 'editQualifier1' ? '#fff' : '#cbd5e1',
            fontWeight: 600,
            fontSize: '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          disabled={editType === 'editQualifier1'}
        >
          Edit Qualifier Round 1
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
      {editType === "editQualifier2" ? (
        <QualifierRound2Edit onClose={() => setEditType("round1")} />
      ) : editType === "editQualifier1" ? (
        <QualifierRound1Edit onClose={() => setEditType("round1")} />
      ) : editType === "final" ? (
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
                    // ...existing code...
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
                    // ...existing code...
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
