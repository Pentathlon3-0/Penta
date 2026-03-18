

import { supabase } from "../../integrations/supabase/client";
import { getTop3TeamsFromLivescore } from "./utils/getTop3Teams";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/Round3Page.css";



// --- FinalRoundScoresTable component and type ---
type FinalRoundScore = {
  school_id: string;
  clever_mind_score: number;
  brain_maze_score: number;
  buzar_score: number;
};

function FinalRoundScoresTable({ teams }: { teams: Team[] }) {
  const [scores, setScores] = useState<Record<string, FinalRoundScore>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const ids = teams.map(t => t.id);
      const { data } = await (supabase as any)
        .from("final_round")
        .select("school_id, clever_mind_score, brain_maze_score, buzar_score")
        .in("school_id", ids);
      const map: Record<string, FinalRoundScore> = {};
      data?.forEach((row: any) => {
        map[row.school_id] = {
          school_id: row.school_id,
          clever_mind_score: row.clever_mind_score,
          brain_maze_score: row.brain_maze_score,
          buzar_score: row.buzar_score ?? 0,
        };
      });
      setScores(map);
      setLoading(false);
    };
    load();
  }, [teams]);

  const updateScore = async (school_id: string, field: "clever_mind_score" | "brain_maze_score", value: number) => {
    setScores(prev => ({
      ...prev,
      [school_id]: {
        ...prev[school_id],
        [field]: value,
      },
    }));
    // Always send numbers, never empty string
    const clever = Number(field === "clever_mind_score" ? value : scores[school_id]?.clever_mind_score ?? 0) || 0;
    const brain = Number(field === "brain_maze_score" ? value : scores[school_id]?.brain_maze_score ?? 0) || 0;
    await (supabase as any).from("final_round").upsert({
      school_id,
      clever_mind_score: clever,
      brain_maze_score: brain,
      buzar_score: scores[school_id]?.buzar_score ?? 0,
    });
  };

  if (loading) return <p style={{ color: "#a0e7ff", textAlign: "center" }}>Loading final round scores...</p>;

  return (
    <table style={{ width: "100%", marginBottom: 24, background: "rgba(0,16,40,0.5)", borderRadius: 12 }}>
      <thead>
        <tr style={{ color: "#93c5fd" }}>
          <th style={{ padding: 8 }}>School</th>
          <th style={{ padding: 8 }}>Clever mind score</th>
          <th style={{ padding: 8 }}>Brain maze score</th>
        </tr>
      </thead>
      <tbody>
        {teams.map(team => (
          <tr key={team.id}>
            <td style={{ padding: 8, color: "#e0f7ff" }}>{team.name}</td>
            <td style={{ padding: 8 }}>
              <input
                type="number"
                className="glass-score"
                value={scores[team.id]?.clever_mind_score ?? 0}
                onChange={e => updateScore(team.id, "clever_mind_score", Number(e.target.value) || 0)}
                style={{ minWidth: 60 }}
              />
            </td>
            <td style={{ padding: 8 }}>
              <input
                type="number"
                className="glass-score"
                value={scores[team.id]?.brain_maze_score ?? 0}
                onChange={e => updateScore(team.id, "brain_maze_score", Number(e.target.value) || 0)}
                style={{ minWidth: 60 }}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}





type Team = {
  id: string;
  name: string;
  members: { id: string; name: string }[];
};

type CircleState = "empty" | "green" | "red";

const ROWS = 5;
const COLS = 5;

const createRow = (): CircleState[] => Array(COLS).fill("empty");

const Round3Page = () => {
  const navigate = useNavigate();

  const [team1, setTeam1] = useState<Team | null>(null);
  const [team2, setTeam2] = useState<Team | null>(null);
  const [team3, setTeam3] = useState<Team | null>(null);
  // track whether qualifier round2 has been completed (i.e. scores exist)
  const [qualifier2Done, setQualifier2Done] = useState<boolean | null>(null);

  /* ================= LOAD FINALISTS FROM DATABASE ================= */

  useEffect(() => {
    const loadFinalists = async () => {
      // Get top 3 teams from livescore
      const top3 = await getTop3TeamsFromLivescore();
      if (!top3 || top3.length < 3) return;

      // Load members for each team
      const loadTeam = async (team: any): Promise<Team> => {
        const { data: members } = await supabase
          .from("players")
          .select("id, name")
          .eq("team_id", team.id);
        return {
          id: team.id,
          name: team.name,
          members: members?.map(m => ({ id: m.id, name: m.name })) || []
        };
      };
      const t1 = await loadTeam(top3[0]);
      const t2 = await loadTeam(top3[1]);
      const t3 = await loadTeam(top3[2]);
      setTeam1(t1);
      setTeam2(t2);
      setTeam3(t3);
    };
    loadFinalists();
  }, []);

  /* ================= ROUND SCORES ================= */

  const [round1, setRound1] = useState<{ t1: number | ""; t2: number | ""; t3: number | "" }>({ t1: "", t2: "", t3: "" });
  const [round2, setRound2] = useState<{ t1: number | ""; t2: number | ""; t3: number | "" }>({ t1: "", t2: "", t3: "" });

  // Load initial scores from Supabase final_round table
  useEffect(() => {
    const fetchFinalRoundScores = async () => {
      if (!team1 || !team2 || !team3) return;
      const ids = [team1.id, team2.id, team3.id];
      const { data } = await (supabase as any)
        .from("final_round")
        .select("school_id, clever_mind_score, brain_maze_score")
        .in("school_id", ids);
      if (data) {
        setRound1({
          t1: data.find((row: any) => row.school_id === team1.id)?.clever_mind_score ?? "",
          t2: data.find((row: any) => row.school_id === team2.id)?.clever_mind_score ?? "",
          t3: data.find((row: any) => row.school_id === team3.id)?.clever_mind_score ?? "",
        });
        setRound2({
          t1: data.find((row: any) => row.school_id === team1.id)?.brain_maze_score ?? "",
          t2: data.find((row: any) => row.school_id === team2.id)?.brain_maze_score ?? "",
          t3: data.find((row: any) => row.school_id === team3.id)?.brain_maze_score ?? "",
        });
      }
    };
    fetchFinalRoundScores();
  }, [team1, team2, team3]);

  // Helper to update Supabase final_round table
  const saveFinalRoundScore = async (school_id: string, field: "clever_mind_score" | "brain_maze_score", value: number) => {
    // Get the other value from state to upsert both columns
    const clever = field === "clever_mind_score" ? value : round1[[team1.id, team2.id, team3.id].indexOf(school_id) === 0 ? "t1" : [team1.id, team2.id, team3.id].indexOf(school_id) === 1 ? "t2" : "t3"] || 0;
    const brain = field === "brain_maze_score" ? value : round2[[team1.id, team2.id, team3.id].indexOf(school_id) === 0 ? "t1" : [team1.id, team2.id, team3.id].indexOf(school_id) === 1 ? "t2" : "t3"] || 0;
    await (supabase as any).from("final_round").upsert({
      school_id,
      clever_mind_score: clever,
      brain_maze_score: brain,
    });
  };

  const [round1Finished, setRound1Finished] = useState(false);
  const [round2Finished, setRound2Finished] = useState(false);
  const [buzzerFinished, setBuzzerFinished] = useState(false);

  // Load finished state from DB
  useEffect(() => {
    const fetchFinished = async () => {
      const { data } = await (supabase as any)
        .from("final_round_status")
        .select("clever_mind_finished, brain_maze_finished, buzzer_finished")
        .limit(1)
        .single();
      if (data) {
        setRound1Finished(!!data.clever_mind_finished);
        setRound2Finished(!!data.brain_maze_finished);
        setBuzzerFinished(!!data.buzzer_finished);
      }
    };
    fetchFinished();
  }, []);

  // Helper to set finished state in DB
  const setRoundFinished = async (round: 1 | 2) => {
    if (round === 1) {
      setRound1Finished(true);
      await (supabase as any)
        .from("final_round_status")
        .update({ clever_mind_finished: true })
        .eq("id", 1);
    } else {
      setRound2Finished(true);
      await (supabase as any)
        .from("final_round_status")
        .update({ brain_maze_finished: true })
        .eq("id", 1);
    }
  };
  const [finalFinished, setFinalFinished] = useState(false);

  /* ================= BUZZER ================= */

  const [team1Circles, setTeam1Circles] = useState<CircleState[][]>(Array.from({ length: ROWS }, createRow));
  const [team2Circles, setTeam2Circles] = useState<CircleState[][]>(Array.from({ length: ROWS }, createRow));
  const [team3Circles, setTeam3Circles] = useState<CircleState[][]>(Array.from({ length: ROWS }, createRow));

  const [team1Selected, setTeam1Selected] = useState<string[]>(Array(ROWS).fill(""));
  const [team2Selected, setTeam2Selected] = useState<string[]>(Array(ROWS).fill(""));
  const [team3Selected, setTeam3Selected] = useState<string[]>(Array(ROWS).fill(""));

  // Restore Buzzer state from DB on load
  useEffect(() => {
    const fetchBuzzer = async (team: Team | null, setCircles: any, setSelected: any) => {
      if (!team) return;
      const { data } = await (supabase as any)
        .from("final_round")
        .select("buzar_performance")
        .eq("school_id", team.id)
        .single();
      if (!data || !data.buzar_performance) return;
      const perf = data.buzar_performance;
      // Build selected and circles from perf
      const selected: string[] = Array(ROWS).fill("");
      const circles: CircleState[][] = Array.from({ length: ROWS }, createRow);
      // Map playerId to row(s)
      let rowIdx = 0;
      Object.entries(perf).forEach(([playerId, val]: any) => {
        // Find all rows for this player (should be only one, but fallback)
        if (rowIdx < ROWS) {
          selected[rowIdx] = playerId;
          // Set correct and wrong circles
          val.correct?.forEach((c: number) => { circles[rowIdx][c] = "green"; });
          val.wrong?.forEach((c: number) => { circles[rowIdx][c] = "red"; });
          rowIdx++;
        }
      });
      setSelected(selected);
      setCircles(circles);
    };
    fetchBuzzer(team1, setTeam1Circles, setTeam1Selected);
    fetchBuzzer(team2, setTeam2Circles, setTeam2Selected);
    fetchBuzzer(team3, setTeam3Circles, setTeam3Selected);
  }, [team1, team2, team3]);
  const [expandedBuzzerTeam, setExpandedBuzzerTeam] = useState<1 | 2 | 3 | null>(1);

  // Helper to build buzar_performance JSON for a team
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

  // Helper to calculate buzar_score from buzar_performance
  function calcBuzarScore(perf: Record<string, { correct: number[]; wrong: number[] }>) {
    let correct = 0, wrong = 0;
    Object.values(perf).forEach(p => {
      correct += p.correct.length;
      wrong += p.wrong.length;
    });
    return correct * 20 - wrong * 10;
  }

  // Save buzar_performance and buzar_score to Supabase for a team
  async function saveBuzar(team: Team, circles: CircleState[][], selected: string[]) {
    const perf = buildBuzarPerformance(circles, selected, team);
    const score = calcBuzarScore(perf);
    await (supabase as any).from("final_round").upsert({
      school_id: team.id,
      buzar_performance: perf,
      buzar_score: score,
    });
  }

  const toggleCircle = (team: 1 | 2 | 3, r: number, c: number) => {
    if (finalFinished || buzzerFinished) return;
    const setter =
      team === 1 ? setTeam1Circles : team === 2 ? setTeam2Circles : setTeam3Circles;
    const data =
      team === 1 ? team1Circles : team === 2 ? team2Circles : team3Circles;
    const selected = team === 1 ? team1Selected : team === 2 ? team2Selected : team3Selected;
    const teamObj = team === 1 ? team1 : team === 2 ? team2 : team3;

    const updated = [...data];
    updated[r] = [...updated[r]];
    updated[r][c] = updated[r][c] === "green" ? "empty" : "green";
    setter(updated);
    if (teamObj) saveBuzar(teamObj, updated, selected);
  };

  const markWrong = (team: 1 | 2 | 3, r: number, c: number) => {
    if (finalFinished || buzzerFinished) return;
    const setter =
      team === 1 ? setTeam1Circles : team === 2 ? setTeam2Circles : setTeam3Circles;
    const data =
      team === 1 ? team1Circles : team === 2 ? team2Circles : team3Circles;
    const selected = team === 1 ? team1Selected : team === 2 ? team2Selected : team3Selected;
    const teamObj = team === 1 ? team1 : team === 2 ? team2 : team3;

    const updated = [...data];
    updated[r] = [...updated[r]];
    updated[r][c] = "red";
    setter(updated);
    if (teamObj) saveBuzar(teamObj, updated, selected);
  };

  const buzzerScore = (grid: CircleState[][]) => {
    let green = 0, red = 0;
    grid.forEach(row =>
      row.forEach(c => {
        if (c === "green") green++;
        if (c === "red") red++;
      })
    );
    return green * 2 - red;
  };

  /* ================= FINISH FINAL & SAVE TO DB ================= */

  const finishFinal = async () => {
    if (!team1 || !team2) return;

    setFinalFinished(true);
    setBuzzerFinished(true);

    // Set buzzer_finished in DB
    await (supabase as any)
      .from("final_round_status")
      .update({ buzzer_finished: true })
      .eq("id", 1);

    const t1Buzzer = buzzerScore(team1Circles);
    const t2Buzzer = buzzerScore(team2Circles);
    const t3Buzzer = team3 ? buzzerScore(team3Circles) : 0;

    const t1Total = ((Number(round1.t1) || 0)) + ((Number(round2.t1) || 0)) + t1Buzzer;
    const t2Total = ((Number(round1.t2) || 0)) + ((Number(round2.t2) || 0)) + t2Buzzer;
    const t3Total = ((Number(round1.t3) || 0)) + ((Number(round2.t3) || 0)) + t3Buzzer;

    // Get final round id
    const { data: finalRound } = await supabase
      .from("rounds")
      .select("id")
      .eq("name", "Final")
      .single();

    if (!finalRound) return;

    // Save scores
    const inserts: any[] = [
      { team_id: team1.id, round_id: finalRound.id, points: Number(round1.t1) || 0, sub_round: "great_mind" },
      { team_id: team1.id, round_id: finalRound.id, points: Number(round2.t1) || 0, sub_round: "puzzle" },
      { team_id: team1.id, round_id: finalRound.id, points: t1Buzzer, sub_round: "buzzer" },

      { team_id: team2.id, round_id: finalRound.id, points: Number(round1.t2) || 0, sub_round: "great_mind" },
      { team_id: team2.id, round_id: finalRound.id, points: Number(round2.t2) || 0, sub_round: "puzzle" },
      { team_id: team2.id, round_id: finalRound.id, points: t2Buzzer, sub_round: "buzzer" },
    ];
    if (team3) {
      inserts.push(
        { team_id: team3.id, round_id: finalRound.id, points: Number(round1.t3) || 0, sub_round: "great_mind" },
        { team_id: team3.id, round_id: finalRound.id, points: Number(round2.t3) || 0, sub_round: "puzzle" },
        { team_id: team3.id, round_id: finalRound.id, points: t3Buzzer, sub_round: "buzzer" },
      );
    }
    await supabase.from("scores").insert(inserts);

    // determine winner among three
    let winner = "Draw";
    if (t1Total > t2Total && t1Total > t3Total) winner = team1.name;
    else if (t2Total > t1Total && t2Total > t3Total) winner = team2.name;
    else if (t3Total > t1Total && t3Total > t2Total) winner = team3?.name || winner;

    navigate("/winner", {
      state: { team1, team2, team3, t1Total, t2Total, t3Total, winner }
    });
  };

  // if we determined that qualifier2 isn't complete, show a message
  if (qualifier2Done === false) {
    return (
      <p style={{ color: "white", textAlign: "center" }}>
        Qualifier round 2 has not been finished yet. Please complete it before
        accessing the final round.
      </p>
    );
  }

  if (!team1 || !team2 || !team3) {
    return <p style={{ color: "white", textAlign: "center" }}>Loading Final...</p>;
  }

  /* ================= UI ================= */
  // 🔴 UI PART IS UNCHANGED FROM YOUR ORIGINAL


  /* ================= UI ================= */

  return (
    <div className="round2-bg">
      <div className="round2-card">
        <h2 className="final-round-title">Final Round</h2>





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
                disabled={round1Finished || buzzerFinished}
                placeholder="Score"
              />
            </div>
          ))}
        </div>

        <div className="round-btn-row">
          <button
            className={`round-finish-btn ${round1Finished ? "finished" : ""}`}
            onClick={() => setRoundFinished(1)}
            disabled={round1Finished}
          >
            {round1Finished ? "Finished" : "Finish Round"}
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
                  disabled={round2Finished || buzzerFinished}
                  placeholder="Score"
                />
              </div>
            ))}
          </div>

          <div className="round-btn-row">
            <button
              className={`round-finish-btn ${round2Finished ? "finished" : ""}`}
              onClick={() => setRoundFinished(2)}
              disabled={round2Finished}
            >
              {round2Finished ? "Finished" : "Finish Round"}
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
                  disabled={buzzerFinished}
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
                      onClick={() => !buzzerFinished && toggleCircle(teamNo, r, i)}
                      onDoubleClick={() => !buzzerFinished && markWrong(teamNo, r, i)}
                      style={buzzerFinished ? { cursor: "not-allowed", opacity: 0.5 } : {}}
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


        <button className="finish-btn" onClick={finishFinal} disabled={buzzerFinished}>
          {buzzerFinished ? "Final Finished" : "Finish Final"}
        </button>
      </div>
    </div>
  );
};

export default Round3Page;

