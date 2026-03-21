import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/Round2Page.css";
import { supabase } from "../../integrations/supabase/client";

const SUBJECTS = [
  { key: "maths", label: "Maths", credit: 3 },
  { key: "science", label: "Science", credit: 3 },
  { key: "it", label: "IT", credit: 2 },
  { key: "gk", label: "GK", credit: 1 },
  { key: "sports", label: "Sports", credit: 1 }
];


interface Team {
  id: string;
  name: string;
  members: { id: string; name: string }[];
}

interface SubjectScore {
  playerId: string;          // chosen player from the team roster
  circles: number[];
  extra: number | "";
  _circleColors?: { [circleIndex: number]: 'green' | 'red' | 'yellow' };
}

// coding score types (mirrors DashboardCoding)
interface BlankRow {
  blank_id: string;
  correct_answer: string;
  position: number;
}

interface QuestionRow {
  id: number;
  html_content: string;
  blanks_count: number;
}

const Round2Page = () => {
  const navigate = useNavigate();

  const [teams, setTeams] = useState<Team[]>([]);
  const [scores, setScores] = useState<SubjectScore[][]>([]);
  const [lockedTeams, setLockedTeams] = useState<boolean[]>([]);

  // helper to upsert into livescore table
  const updateLiveScore = async (
    teamId: string,
    fields: Partial<{
      qualifier_round1_live: any;
      qualifier_round1_final: number;
      qualifier_round2_final: number;
    }>
  ) => {
    try {
      const { error } = await (supabase as any)
        .from("livescore")
        .upsert({ school_id: teamId, ...fields }, { onConflict: "school_id" });
      if (error) console.error("livescore upsert error", error);
    } catch (err) {
      console.error("failed livescore update", err);
    }
  };
  const [teamTotals, setTeamTotals] = useState<number[]>([]);
  const [round1Finished, setRound1Finished] = useState(false);
  const [finishedSubjects, setFinishedSubjects] = useState<Record<string,boolean>>({});
  const [showRound1, setShowRound1] = useState(true);

  // coding modal state & score storage
  const [showCodingModal, setShowCodingModal] = useState(false);
  const [codingScores, setCodingScores] = useState<Array<{ school_name: string; correct: number; total: number; score: number;}>>([]);
  const [codingQuestion, setCodingQuestion] = useState<QuestionRow | null>(null);
  const [codingBlanks, setCodingBlanks] = useState<BlankRow[]>([]);

  // derived helper to know when all subjects have been completed
  const allSubjectsDone = SUBJECTS.every(s => finishedSubjects[s.key]);

  // once all subjects are finished we auto‑hide the round1 card
  useEffect(() => {
    if (allSubjectsDone) {
      setShowRound1(false);
    }
  }, [allSubjectsDone]);

  // when coding modal opens, fetch data
  useEffect(() => {
    if (showCodingModal) {
      fetchCodingQuestion();
    }
  }, [showCodingModal]);

  const fetchCodingQuestion = async () => {
    const { data: qData } = await (supabase as any)
      .from("questions")
      .select("id, html_content, blanks_count")
      .order("id", { ascending: true })
      .limit(1)
      .single();
    if (qData) {
      setCodingQuestion(qData);
      const { data: bData } = await (supabase as any)
        .from("question_blanks")
        .select("blank_id, correct_answer, position")
        .eq("question_id", qData.id)
        .order("position", { ascending: true });
      setCodingBlanks(bData || []);
      await fetchCodingSubs(qData, bData || []);
    }
  };

  const fetchCodingSubs = async (q: QuestionRow, bl: BlankRow[]) => {
    const { data } = await (supabase as any)
      .from("coding_submissions")
      .select("*")
      .order("created_at", { ascending: false });
    const subs: any[] = data || [];
    computeCodingScores(subs, q, bl);
  };

  const computeCodingScores = (subs: any[], q: QuestionRow, bl: BlankRow[]) => {
    if (!q || bl.length === 0) return;
    const total = bl.length;
    const submitted = subs.filter((s) => s.submitted && s.final_output);

    // compute scores similar to DashboardCoding
    const expectedHTML = (() => {
      let html = q.html_content;
      for (const b of bl) {
        html = html.replace(new RegExp(`<__${b.blank_id}__>`, "g"), `<${b.correct_answer}>`);
        html = html.replace(new RegExp(`</__${b.blank_id}__>`, "g"), `</${b.correct_answer}>`);
        html = html.replace(new RegExp(`__${b.blank_id}__`, "g"), b.correct_answer);
      }
      return html;
    })();

    const results = submitted.map((s) => {
      let correct = 0;
      for (const b of bl) {
        if (s.final_output === expectedHTML) {
          correct = total;
          break;
        }
        const userOutput = s.final_output!;
        const correctTag = b.correct_answer;
        const tagOpen = `<${correctTag}>`;
        const tagClose = `</${correctTag}>`;
        if (q.html_content.includes(`<__${b.blank_id}__>`)) {
          if (userOutput.includes(tagOpen) && userOutput.includes(tagClose)) {
            correct++;
          }
        } else {
          if (userOutput.includes(correctTag)) {
            correct++;
          }
        }
      }
      const score = Math.round((100 / total) * correct);
      return { school_name: s.school_name, correct, total, score };
    });
    setCodingScores(results);
  };

  const [round2Scores, setRound2Scores] = useState<(number | "")[]>([]);
  const [round2Locked, setRound2Locked] = useState(false);
  const [qualifierRound2Status, setQualifierRound2Status] = useState(false);

  // collapsed list: only subject names shown until expanded
  const [expandedSubject, setExpandedSubject] = useState<number | null>(null);

  useEffect(() => {
    loadQualifiedTeams();
    fetchQualifierRound2Status();
  }, []);

  const fetchQualifierRound2Status = async () => {
    const { data, error } = await (supabase.from("qualifier_round2_status" as any) as any)
      .select("qualifier_round2_status")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Error fetching qualifier_round2_status:", error);
      return;
    }

    if (!data) {
      // Insert a default row if none exists
      await (supabase.from("qualifier_round2_status" as any) as any)
        .insert({ qualifier_round2_status: false });
      setQualifierRound2Status(false);
    } else if (typeof data.qualifier_round2_status === "boolean") {
      setQualifierRound2Status(data.qualifier_round2_status);
    }
  };

  const loadQualifiedTeams = async () => {
    // fetch both round records in one request
    const { data: rounds } = await supabase
      .from("rounds")
      .select("id,name")
      .in("name", ["Knockout 1", "Knockout 2"]);

    if (!rounds || rounds.length < 2) {
      alert("Round 1 data missing");
      return;
    }

    const r1 = rounds.find(r => r.name === "Knockout 1")!;
    const r2 = rounds.find(r => r.name === "Knockout 2")!;

    // grab all scores for both rounds in a single query
    const { data: allScores } = await supabase
      .from("scores")
      .select("team_id, points, round_id")
      .in("round_id", [r1.id, r2.id]);

    const totals: Record<string, number> = {};

    allScores?.forEach(s => {
      totals[s.team_id] = (totals[s.team_id] || 0) + s.points;
    });

    // if there is already any score for Knockout 2, disable editing
    const { data: existingQ2, count: q2count } = await supabase
      .from('scores')
      .select('id', { head: true, count: 'exact' })
      .eq('round_id', r2.id);
    if (q2count && q2count > 0) {
      setRound2Locked(true);
    }

    const sortedTeamIds = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(x => x[0]);

    // fetch team and player rows in parallel
    const [teamResp, playerResp] = await Promise.all([
      supabase.from("teams").select("id, name").in("id", sortedTeamIds),
      supabase
        .from("players")
        .select("id, name, team_id")
        .in("team_id", sortedTeamIds),
    ]);

    const teamRows = teamResp.data || [];
    const playerRows = playerResp.data || [];

    const finalTeams: Team[] = teamRows.map(t => ({
      id: t.id,
      name: t.name,
      members: playerRows.filter(p => p.team_id === t.id),
    }));

    setTeams(finalTeams);

    // initialise empty score matrix
    const blankScores: SubjectScore[][] = finalTeams.map(team =>
      SUBJECTS.map(() => ({ playerId: "", circles: [], extra: "", _circleColors: {} }))
    );

    // load any saved subject details so we can prefill
    const { data: details } = await (supabase as any)
      .from('qualifier1_details')
      .select('subject, performance, extras, players, status');

    const finished: Record<string,boolean> = {};
    if (details) {
      details.forEach((d: any) => {
        // Always lock if status is true, regardless of teams
        if (d.status === true) {
          finished[d.subject] = true;
        }

        const si = SUBJECTS.findIndex(s => s.key === d.subject);
        if (si >= 0) {
          finalTeams.forEach((team, t) => {
            // New format: d.performance?.[team.id] is {green:[],red:[],yellow:[]}
            const perf = d.performance?.[team.id];
            if (perf && typeof perf === 'object' && ('green' in perf || 'red' in perf || 'yellow' in perf)) {
              // Restore _circleColors and circles
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

    setLockedTeams(finalTeams.map(() => false));
    setTeamTotals(finalTeams.map(() => 0));

    // load existing qualifier2 values from livescore if present
    const { data: liveRows } = await (supabase as any)
      .from('livescore')
      .select('school_id, qualifier_round2_final')
      .in('school_id', finalTeams.map(t => t.id));

    const r2scores = finalTeams.map(team => {
      const row: any = liveRows?.find((r: any) => r.school_id === team.id);
      return row ? row.qualifier_round2_final : "";
    });

    setRound2Scores(r2scores.map(v => v === undefined ? "" : v));
  };

  // keep round1Finished flag in sync with subjects or locked teams
  useEffect(() => {
    if (allSubjectsDone) {
      setRound1Finished(true);
    }
  }, [allSubjectsDone]);

  const toggleCircle = async (t: number, sidx: number, c: number) => {
    if (lockedTeams[t]) return;

    // prevent two different teams picking same circle in same subject
    const already = scores.some((team, ti) => ti !== t && team[sidx].circles.includes(c));
    if (already) {
      // maybe give feedback later
      return;
    }


    // update local state and compute a fresh copy for persistence
    const updated = scores.map((team, ti) =>
      ti !== t
        ? team
        : team.map((subj, si) => {
            if (si !== sidx) return subj;
            // Find the color state for this circle
            let colorState = subj._circleColors ? subj._circleColors[c] : undefined;
            let nextColor;
            if (!colorState) nextColor = 'green';
            else if (colorState === 'green') nextColor = 'red';
            else if (colorState === 'red') nextColor = 'yellow';
            else if (colorState === 'yellow') nextColor = undefined;

            // Update _circleColors
            const newCircleColors = { ...(subj._circleColors || {}) };
            if (nextColor) newCircleColors[c] = nextColor;
            else delete newCircleColors[c];

            // For score logic, keep the original array logic (only green counts)
            let newArr = subj.circles.filter((x) => x !== c);
            if (nextColor === 'green') newArr = [...newArr, c];

            return {
              ...subj,
              circles: newArr,
              _circleColors: newCircleColors
            };
          })
    );

    setScores(updated);

    // Pass updated scores to upsertSubjectDetail to ensure correct color is saved
    await upsertSubjectDetail(sidx, false, updated);

    // build JSON containing arrays of marked circles per subject
    // and individual extra values keyed by <subject>extra
    const liveObj: any = {};
    SUBJECTS.forEach((sub, j) => {
      const ci = updated[t][j].circles;
      if (ci.length) {
        liveObj[sub.key] = ci.slice();
      }
      const ex = updated[t][j].extra;
      if (ex !== "" && ex !== 0) {
        liveObj[`${sub.key}extra`] = ex;
      }
    });

    const pts = Math.round(teamTotal(t, updated) );
    updateLiveScore(teams[t].id, {
      qualifier_round1_live: liveObj,
      qualifier_round1_final: Math.round(teamTotal(t, updated))
    });
  };

  const subjectTotal = (m: SubjectScore) => {
    const extra = m.extra === "" ? 0 : m.extra;
    // Count circles by color
    let green = 0, yellow = 0, red = 0;
    if (m._circleColors) {
      Object.values(m._circleColors).forEach(color => {
        if (color === 'green') green++;
        else if (color === 'yellow') yellow++;
        else if (color === 'red') red++;
      });
    } else {
      // fallback: all are green
      green = m.circles.length;
    }
    // Calculation: green*2 + yellow*1 + red*(-5) + extra*count for each color
    const total = (green * 2 + yellow * 1 + red * -5) + extra * (green+yellow);
    return total;
  };

  const teamTotal = (t: number, arr?: SubjectScore[][]) => {
    const src = arr || scores;
    let sum = 0;
    src[t].forEach((m, si) => {
      const credit = SUBJECTS[si].credit;
      sum += subjectTotal(m) * credit;
    });
    return Number((sum).toFixed(2));
  };

  const getOrCreateRound = async (roundName: string) => {
    let { data } = await supabase.from("rounds").select("id").eq("name", roundName).single();

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

  /* ================= SAVE QUALIFIER ROUND 1 ================= */
  // finish a *subject* (save one row per team for the chosen player)
  const finishSubject = async (si: number) => {
    // ensure every team has chosen a player for this subject
    for (let t = 0; t < teams.length; t++) {
      const m = scores[t][si];
      if (!m.playerId) {
        alert(`Choose a player for team ${teams[t].name}`);
        return;
      }
    }

    // Immediately lock the subject in UI
    setFinishedSubjects(prev => ({ ...prev, [SUBJECTS[si].key]: true }));

    // persist subject-level JSON details as requested, set status true
    await upsertSubjectDetail(si, true);

    // update running totals (optional)
    setTeamTotals(prev => prev.map((v, t) => teamTotal(t)));

    // Insert scores for each team for this subject
    const roundId = await getOrCreateRound("Qualifier 1");

    // Remove any existing scores for this round/team/subject
    await supabase
      .from("scores")
      .delete()
      .match({
        round_id: roundId,
        subject: SUBJECTS[si].key
      });

    // Insert new scores
    const inserts = teams.map((team, t) => {
      const m = scores[t][si];
      const credit = SUBJECTS[si].credit;
      // Count circles by color
      let green = 0, yellow = 0, red = 0;
      if (m._circleColors) {
        Object.values(m._circleColors).forEach(color => {
          if (color === 'green') green++;
          else if (color === 'yellow') yellow++;
          else if (color === 'red') red++;
        });
      } else {
        green = m.circles.length;
      }
      const extra = m.extra === "" ? 0 : m.extra;
      // New logic: (green*2 + yellow*1 + red*-1) + extra*(green+yellow-red)
      const total = (green * 2 + yellow * 1 + red * -5 + extra * (green+yellow )) * credit;
      return {
        round_id: roundId,
        team_id: team.id,
        subject: SUBJECTS[si].key,
        points: Math.round(total),
      };
    });
    await supabase.from("scores").insert(inserts);

    // Update qualifier_round1_live in livescore for each team with new color-based JSON
    for (let t = 0; t < teams.length; t++) {
      const team = teams[t];
      const teamScores = scores[t];
      const liveObj = {};
      SUBJECTS.forEach((sub, j) => {
        const m = teamScores[j];
        // Build color arrays for each subject
        const colorMap = m._circleColors || {};
        const green = [], yellow = [], red = [];
        Object.entries(colorMap).forEach(([idx, color]) => {
          if (color === 'green') green.push(Number(idx));
          else if (color === 'yellow') yellow.push(Number(idx));
          else if (color === 'red') red.push(Number(idx));
        });
        // Save as {green:[],yellow:[],red:[]}
        if (green.length || yellow.length || red.length) {
          liveObj[sub.key] = { green, yellow, red };
        }
        const ex = m.extra;
        if (ex !== "" && ex !== 0) {
          liveObj[`${sub.key}extra`] = ex;
        }
      });
      await updateLiveScore(team.id, { qualifier_round1_live: liveObj });
    }
  };

  // helper to persist detail info per subject
  // Accepts optional scoresOverride for correct state
  const upsertSubjectDetail = async (si: number, status: boolean = false, scoresOverride?: SubjectScore[][]) => {
    const key = SUBJECTS[si].key;
    const performance: Record<string, { green: number[]; red: number[]; yellow: number[] }> = {};
    const extras: Record<string, number> = {};
    const players: Record<string, string> = {};
    const srcScores = scoresOverride || scores;

    teams.forEach((team, t) => {
      // Build color arrays from _circleColors
      const colorMap = srcScores[t][si]._circleColors || {};
      const green: number[] = [];
      const red: number[] = [];
      const yellow: number[] = [];
      Object.entries(colorMap).forEach(([idx, color]) => {
        if (color === 'green') green.push(Number(idx));
        else if (color === 'red') red.push(Number(idx));
        else if (color === 'yellow') yellow.push(Number(idx));
      });
      performance[team.id] = { green, red, yellow };
      extras[team.id] = srcScores[t][si].extra === "" ? 0 : (srcScores[t][si].extra as number);
      players[team.id] = srcScores[t][si].playerId;
    });

    const { data, error } = await (supabase as any)
      .from('qualifier1_details')
      .upsert({
        subject: key,
        performance,
        extras,
        players,
        status
      }, { onConflict: 'subject' });

    // debug: confirm persistence
    console.log("upsertSubjectDetail result", { subject: key, data, error });
    if (error) {
      console.error("Failed to upsert qualifier1_details", error);
    }
  };
  /* ================= SAVE QUALIFIER ROUND 2 ================= */
  const finishRound2 = async () => {
    setRound2Locked(true);

    const roundId = await getOrCreateRound("Qualifier 2");

    await supabase.from("scores").delete().eq("round_id", roundId);

    const inserts = teams.map((t, i) => ({
      round_id: roundId,
      team_id: t.id,
      points: Math.round(Number(round2Scores[i] || 0)) // ✅ scaled int
    }));

    await supabase.from("scores").insert(inserts);

    // also update live score row with the round2 final values
    teams.forEach((t, i) => {
      const pts = Math.round(Number(round2Scores[i] || 0));
      updateLiveScore(t.id, { qualifier_round2_final: pts });
    });

    // Insert top 3 school IDs into final_round table if not already present
    // Sort teams by their round2Scores (descending), get top 3
    const scoredTeams = teams.map((t, i) => ({ id: t.id, score: Number(round2Scores[i] || 0) }));
    const top3 = scoredTeams.sort((a, b) => b.score - a.score).slice(0, 3);
    for (const t of top3) {
      await (supabase as any).from("final_round").upsert({
        school_id: t.id,
        clever_mind_score: 0,
        brain_maze_score: 0
      });
    }

    // Set qualifier_round2_status to true in qualifier_round2_status
    const { data } = await (supabase.from("qualifier_round2_status" as any) as any)
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data && data.id) {
      await (supabase.from("qualifier_round2_status" as any) as any)
        .update({ qualifier_round2_status: true })
        .eq("id", data.id);
      setQualifierRound2Status(true);
    }
  };

  /* ================= UI (100% UNCHANGED) ================= */
  // ⚠️ UI PART CONTINUES EXACTLY AS YOUR ORIGINAL FILE


  return (
    <div className="round2-bg">
      <div className="round2-card">
        <h1 className="qualifier-title">Qualifier</h1>
        <h2>Think & Stack</h2>

        {(!allSubjectsDone || showRound1) && SUBJECTS.map((s, si) => {
                  {/* Knockout Round 1 Finished button always visible at bottom, enabled only when all subjects are finished */}
                  {showRound1 && (
                    <button
                      className="finish-btn left"
                      disabled={!SUBJECTS.every(s => finishedSubjects[s.key])}
                      onClick={async () => {
                        if (!SUBJECTS.every(s => finishedSubjects[s.key])) return;
                        // Update scores table for each school
                        const roundId = await getOrCreateRound("Qualifier 1");
                        const teamIds = teams.map(t => t.id);
                        await supabase.from("scores").delete().eq("round_id", roundId).in("team_id", teamIds);
                        const inserts = teams.map((team, t) => {
                          let total = 0;
                          scores[t].forEach((m, si2) => {
                            const credit = SUBJECTS[si2].credit;
                            const extra = m.extra === "" ? 0 : m.extra;
                            total += (m.circles.length * 2 + extra * m.circles.length) * credit;
                          });
                          return {
                            round_id: roundId,
                            team_id: team.id,
                            points: Math.round(total), // not multiplied by 100
                          };
                        });
                        await supabase.from("scores").insert(inserts);
                        // Hide round 1 and show round 2
                        setShowRound1(false);
                      }}
                      style={{ marginTop: 24 }}
                    >
                      Think & Stack Round FINISHED
                    </button>
                  )}
          const isExpanded = expandedSubject === si;
          return (
            <div key={si} className="team-section">
              <h3
                style={{ textAlign: "left", cursor: "pointer" }}
                onClick={() =>
                  setExpandedSubject(prev => (prev === si ? null : si))
                }
              >
                {s.label} {isExpanded ? "▲" : "▼"}
              </h3>

              {isExpanded && (
                <>
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
                        <tr key={t} className={lockedTeams[t] || finishedSubjects[SUBJECTS[si].key] ? "row-disabled" : ""}>
                          <td>{team.name}</td>

                          <td>
                            {scores[t] && scores[t][si] ? (
                              <select
                                className="glass-select subject-select"
                                disabled={lockedTeams[t] || finishedSubjects[SUBJECTS[si].key]}
                                value={scores[t][si].playerId}
                                onChange={async e => {
                                  if (finishedSubjects[SUBJECTS[si].key]) return;
                                  setScores(prev =>
                                    prev.map((teamArr, ti) =>
                                      ti !== t
                                        ? teamArr
                                        : teamArr.map((mem, mi) =>
                                            mi !== si
                                              ? mem
                                              : ({ ...mem, playerId: e.target.value } as SubjectScore)
                                          )
                                    )
                                  );
                                  await upsertSubjectDetail(si);
                                }}
                              >
                                <option value="" disabled hidden>Select player</option>
                                {team.members
                                  .filter(m => {
                                    if (!scores[t]) return true;
                                    const chosen = scores[t]
                                      .map((x, idx) => (idx === si ? "" : (x ? x.playerId : "")))
                                      .filter(id => id);
                                    return !chosen.includes(m.id);
                                  })
                                  .map(m => (
                                    <option key={m.id} value={m.id}>
                                      {m.name}
                                    </option>
                                  ))}
                              </select>
                            ) : <span />} 
                          </td>

                          <td>
                            {scores[t] && scores[t][si] ? (
                              <div className="circle-group">
                                {[0, 1, 2, 3, 4].map(c => {
                                  const takenByOther = scores.some((teamArr, ti) => ti !== t && teamArr && teamArr[si] && teamArr[si].circles && teamArr[si].circles.includes(c));
                                  const color = scores[t][si]._circleColors ? scores[t][si]._circleColors[c] : undefined;
                                  return (
                                    <div
                                      key={c}
                                      className={`circle${color ? ` ${color}` : ""}${takenByOther ? " disabled" : ""}`}
                                      onClick={() => {
                                        if (finishedSubjects[SUBJECTS[si].key] || takenByOther) return;
                                        toggleCircle(t, si, c);
                                      }}
                                    />
                                  );
                                })}
                              </div>
                            ) : <span />} 
                          </td>

                          <td>
                            {scores[t] && scores[t][si] ? (
                              <input
                                type="number"
                                className="extra-input"
                                disabled={lockedTeams[t] || finishedSubjects[SUBJECTS[si].key]}
                                value={typeof scores[t][si].extra === "undefined" ? "" : scores[t][si].extra}
                                placeholder=""
                                onChange={async e => {
                                  if (finishedSubjects[SUBJECTS[si].key]) return;
                                  const newVal = e.target.value === "" ? "" : Number(e.target.value);
                                  // build updated scores array ourselves so we can use it immediately
                                  const updated = scores.map((teamArr, ti) =>
                                    ti !== t
                                      ? teamArr
                                      : teamArr.map((mem, mi) =>
                                          mi !== si
                                            ? mem
                                            : ({
                                                ...mem,
                                                extra: newVal
                                              } as SubjectScore)
                                        )
                                  );

                                  setScores(updated);
                                  await upsertSubjectDetail(si);

                                  // refresh final score after extra change; also update live payload using updated
                                  const pts = Math.round(teamTotal(t, updated) * 100);
                                  const liveObj: any = {};
                                  SUBJECTS.forEach((sub, j) => {
                                    const ci = updated[t][j].circles;
                                    if (ci.length) liveObj[sub.key] = ci.slice();
                                    const ex = updated[t][j].extra;
                                    if (ex !== "" && ex !== 0) liveObj[`${sub.key}extra`] = ex;
                                  });
                                  updateLiveScore(teams[t].id, { qualifier_round1_final: Math.round(teamTotal(t, updated)), qualifier_round1_live: liveObj });
                                }}
                              />
                            ) : <span />} 
                          </td>

                          <td>{scores[t] && scores[t][si] ? subjectTotal(scores[t][si]) : 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {
                    // determine whether all teams have selected a player for this subject
                    (() => {
                      const allHavePlayers = teams.every((team, t) => scores[t] && scores[t][si] && scores[t][si].playerId);
                      return (
                        <button
                          className="finish-btn left"
                          onClick={() => finishSubject(si)}
                          disabled={
                            finishedSubjects[SUBJECTS[si].key] || !allHavePlayers
                          }
                          title={
                            !allHavePlayers
                              ? "Every team must choose a player before finishing"
                              : undefined
                          }
                        >
                          {finishedSubjects[SUBJECTS[si].key]
                            ? "SUBJECT SAVED"
                            : "FINISH SUBJECT"}
                        </button>
                      );
                    })()
                  }
                </>
              )}
            </div>
          );
        })}

        

      {/* when round2 is unlocked, offer a button to re‑show round1 card */}
      {allSubjectsDone && !showRound1 && (
        <button
          className="finish-btn left"
          onClick={() => setShowRound1(true)}
        >
          SHOW THINK & STACK ROUND 1
        </button>
      )}

        {allSubjectsDone && (
          <>
            <h2 style={{ textAlign: "left", marginTop: "60px" }}>
              Code Wizard
            </h2>

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
                    value={typeof round2Scores[i] === "undefined" ? "" : round2Scores[i]}
                    onChange={e => {
                      if (qualifierRound2Status) return;
                      const copy = [...round2Scores];
                      copy[i] = e.target.value === "" ? "" : Number(e.target.value);
                      setRound2Scores(copy);

                      // persist live score immediately
                      const pts = Math.round(Number(copy[i] || 0));
                      updateLiveScore(teams[i].id, { qualifier_round2_final: pts });
                    }}
                    disabled={qualifierRound2Status}
                  />
                </div>
              ))}
            </div>

            <div className="button-group">
              <button
                className="finish-btn"
                onClick={finishRound2}
                disabled={qualifierRound2Status}
              >
                {qualifierRound2Status ? "ROUND 2 FINISHED" : "FINISH ROUND 2"}
              </button>


              {/* glass style button (not gradient) */}
              <button
                className="glass-btn"
                onClick={() => setShowCodingModal(true)}
              >
                Code Wizard SCORES
              </button>
            </div>
          </>
        )}
      {/* coding scores modal */}
      {showCodingModal && (
        <div className="modal-overlay" onClick={() => setShowCodingModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="finish-btn right" onClick={() => setShowCodingModal(false)}>
              Close
            </button>
            <h2 className="font-display text-xl font-bold">🏆 Coding Scores</h2>
            {codingScores.length === 0 ? (
              <p className="text-center">No scores available.</p>
            ) : (
              <table className="w-full mt-4 table-auto text-white">
                <thead>
                  <tr>
                    <th>School</th>
                    <th>Correct Blanks</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {codingScores.map(s => (
                    <tr key={s.school_name} className="border-b border-white/20">
                      <td className="py-2">{s.school_name}</td>
                      <td className="py-2">{s.correct} / {s.total}</td>
                      <td className="py-2 font-display font-bold text-lg">{s.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default Round2Page;