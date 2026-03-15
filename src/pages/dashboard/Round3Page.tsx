import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/Round3Page.css";
import { supabase } from "../../integrations/supabase/client";

type Team = {
  id: string;
  name: string;
  members: string[];
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
    loadFinalists();
  }, []);

  const loadFinalists = async () => {
    // 1️⃣ Get Qualifier round IDs
    const { data: q1 } = await supabase
      .from("rounds")
      .select("id")
      .eq("name", "Qualifier 1")
      .single();

    const { data: q2 } = await supabase
      .from("rounds")
      .select("id")
      .eq("name", "Qualifier 2")
      .single();

    if (!q1 || !q2) {
      alert("Qualifier rounds not found in database");
      return;
    }

    // make sure round2 has been scored before showing final page
    const { count: round2Count } = await supabase
      .from("scores")
      .select("id", { count: "exact", head: true })
      .eq("round_id", q2.id as string);

    if (!round2Count || round2Count === 0) {
      setQualifier2Done(false);
      return;
    }
    setQualifier2Done(true);

    // 2️⃣ Get scores from Qualifier rounds
    const { data: scores1 } = await supabase
      .from("scores")
      .select("team_id, points")
      .eq("round_id", q1.id);

    const { data: scores2 } = await supabase
      .from("scores")
      .select("team_id, points")
      .eq("round_id", q2.id);

    // 3️⃣ Get teams
    const { data: teams } = await supabase
      .from("teams")
      .select("id, name");

    if (!teams) return;

    // 4️⃣ Sum scores per team from both qualifier rounds
    const map = new Map<string, number>();

    scores1?.forEach(s => {
      map.set(s.team_id, (map.get(s.team_id) || 0) + s.points);
    });

    scores2?.forEach(s => {
      map.set(s.team_id, (map.get(s.team_id) || 0) + s.points);
    });

    // 5️⃣ Sort teams by score and get top 3
    const sorted = [...teams]
      .map(t => ({
        ...t,
        total: map.get(t.id) || 0
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);

    // 6️⃣ Load members for each team
    const loadTeam = async (team: any): Promise<Team> => {
      const { data: members } = await supabase
        .from("players")
        .select("name")
        .eq("team_id", team.id);

      return {
        id: team.id,
        name: team.name,
        members: members?.map(m => m.name) || []
      };
    };

    const t1 = await loadTeam(sorted[0]);
    const t2 = await loadTeam(sorted[1]);
    const t3 = await loadTeam(sorted[2]);

    setTeam1(t1);
    setTeam2(t2);
    setTeam3(t3);
  };

  /* ================= ROUND SCORES ================= */

  const [round1, setRound1] = useState<{ t1: number | ""; t2: number | ""; t3: number | "" }>(
    {
      t1: "",
      t2: "",
      t3: ""
    }
  );

  const [round2, setRound2] = useState<{ t1: number | ""; t2: number | ""; t3: number | "" }>(
    {
      t1: "",
      t2: "",
      t3: ""
    }
  );

  const [round1Finished, setRound1Finished] = useState(false);
  const [round2Finished, setRound2Finished] = useState(false);
  const [finalFinished, setFinalFinished] = useState(false);

  /* ================= BUZZER ================= */

  const [team1Circles, setTeam1Circles] = useState<CircleState[][]>(
    Array.from({ length: ROWS }, createRow)
  );
  const [team2Circles, setTeam2Circles] = useState<CircleState[][]>(
    Array.from({ length: ROWS }, createRow)
  );
  const [team3Circles, setTeam3Circles] = useState<CircleState[][]>(
    Array.from({ length: ROWS }, createRow)
  );

  const [team1Selected, setTeam1Selected] = useState<string[]>(Array(ROWS).fill(""));
  const [team2Selected, setTeam2Selected] = useState<string[]>(Array(ROWS).fill(""));
  const [team3Selected, setTeam3Selected] = useState<string[]>(Array(ROWS).fill(""));
  const [expandedBuzzerTeam, setExpandedBuzzerTeam] = useState<1 | 2 | 3 | null>(1);

  const toggleCircle = (team: 1 | 2 | 3, r: number, c: number) => {
    if (finalFinished) return;
    const setter =
      team === 1 ? setTeam1Circles : team === 2 ? setTeam2Circles : setTeam3Circles;
    const data =
      team === 1 ? team1Circles : team === 2 ? team2Circles : team3Circles;

    const updated = [...data];
    updated[r] = [...updated[r]];
    updated[r][c] = updated[r][c] === "green" ? "empty" : "green";
    setter(updated);
  };

  const markWrong = (team: 1 | 2 | 3, r: number, c: number) => {
    if (finalFinished) return;
    const setter =
      team === 1 ? setTeam1Circles : team === 2 ? setTeam2Circles : setTeam3Circles;
    const data =
      team === 1 ? team1Circles : team === 2 ? team2Circles : team3Circles;

    const updated = [...data];
    updated[r] = [...updated[r]];
    updated[r][c] = "red";
    setter(updated);
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
          <div className="team-column">
            <span className="team-name">{team1.name}</span>
            <input
              className="glass-score"
              type="number"
              value={round1.t1}
              onChange={e =>
                setRound1({ ...round1, t1: Number(e.target.value) || "" })
              }
              disabled={round1Finished}
              placeholder="Score"
            />
          </div>

          <div className="team-column">
            <span className="team-name">{team2.name}</span>
            <input
              className="glass-score"
              type="number"
              value={round1.t2}
              onChange={e =>
                setRound1({ ...round1, t2: Number(e.target.value) || "" })
              }
              disabled={round1Finished}
              placeholder="Score"
            />
          </div>

          {team3 && (
            <div className="team-column">
              <span className="team-name">{team3.name}</span>
              <input
                className="glass-score"
                type="number"
                value={round1.t3}
                onChange={e =>
                  setRound1({ ...round1, t3: Number(e.target.value) || "" })
                }
                disabled={round1Finished}
                placeholder="Score"
              />
            </div>
          )}
        </div>

        <div className="round-btn-row">
          <button
            className={`round-finish-btn ${round1Finished ? "finished" : ""}`}
            onClick={() => setRound1Finished(true)}
            disabled={round1Finished}
          >
            {round1Finished ? "Finished" : "Finish Round"}
          </button>
        </div>

      </div>


        <h3 className="round-title">Brain maze</h3>
        <div className="round-section">

          <div className="teams-grid">
            <div className="team-column">
              <span className="team-name">{team1.name}</span>
              <input
                className="glass-score"
                type="number"
                value={round2.t1}
                onChange={e =>
                  setRound2({ ...round2, t1: Number(e.target.value) || "" })
                }
                disabled={round2Finished}
                placeholder="Score"
              />
            </div>

            <div className="team-column">
              <span className="team-name">{team2.name}</span>
              <input
                className="glass-score"
                type="number"
                value={round2.t2}
                onChange={e =>
                  setRound2({ ...round2, t2: Number(e.target.value) || "" })
                }
                disabled={round2Finished}
                placeholder="Score"
              />
            </div>

            {team3 && (
              <div className="team-column">
                <span className="team-name">{team3.name}</span>
                <input
                  className="glass-score"
                  type="number"
                  value={round2.t3}
                  onChange={e =>
                    setRound2({ ...round2, t3: Number(e.target.value) || "" })
                  }
                  disabled={round2Finished}
                  placeholder="Score"
                />
              </div>
            )}
          </div>

          <div className="round-btn-row">
            <button
              className={`round-finish-btn ${round2Finished ? "finished" : ""}`}
              onClick={() => setRound2Finished(true)}
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
                >
                  <option value="" disabled hidden style={{ color: "#0f172a", backgroundColor: "#f8fafc" }}>
                    Select member
                  </option>
                  {team.members.filter(m => m.trim().length > 0).map(m => (
                    <option key={m} value={m} style={{ color: "#0f172a", backgroundColor: "#f8fafc" }}>
                      {m}
                    </option>
                  ))}
                </select>

                <div className="circle-row">
                  {circles[r].map((c, i) => (
                    <div
                      key={i}
                      className={`buzzer-circle ${c}`}
                      onClick={() => toggleCircle(teamNo, r, i)}
                      onDoubleClick={() => markWrong(teamNo, r, i)}
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


        <button className="finish-btn" onClick={finishFinal}>
          Finish Final
        </button>
      </div>
    </div>
  );
};

export default Round3Page;

