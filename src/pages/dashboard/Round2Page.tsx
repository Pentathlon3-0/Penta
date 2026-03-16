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

  // collapsed list: only subject names shown until expanded
  const [expandedSubject, setExpandedSubject] = useState<number | null>(null);

  useEffect(() => {
    loadQualifiedTeams();
  }, []);

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
      .slice(0, 4)
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
      SUBJECTS.map(() => ({ playerId: "", circles: [], extra: "" }))
    );

    // load any saved subject details so we can prefill
    const { data: details } = await (supabase as any)
      .from('qualifier1_details')
      .select('subject, performance, extras, players');

    const finished: Record<string,boolean> = {};
    if (details) {
      details.forEach((d: any) => {
        // only consider the subject finished if some score/extra data exists
        const hasScores = Object.values(d.performance || {}).some(
          (arr: any) => Array.isArray(arr) && arr.length > 0
        );
        const hasExtras = Object.values(d.extras || {}).some((v: any) => v !== 0 && v !== "");
        if (hasScores || hasExtras) {
          finished[d.subject] = true;
        }

        const si = SUBJECTS.findIndex(s => s.key === d.subject);
        if (si >= 0) {
          finalTeams.forEach((team, t) => {
            blankScores[t][si].circles = d.performance?.[team.id] || [];
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

    setRound2Scores(r2scores);
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
        : team.map((subj, si) =>
            si !== sidx
              ? subj
              : {
                  ...subj,
                  circles: subj.circles.includes(c)
                    ? subj.circles.filter(x => x !== c)
                    : [...subj.circles, c]
                }
          )
    );

    setScores(updated);

    await upsertSubjectDetail(sidx);

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

    const pts = Math.round(teamTotal(t, updated) * 100);
    updateLiveScore(teams[t].id, {
      qualifier_round1_live: liveObj,
      qualifier_round1_final: pts
    });
  };

  const subjectTotal = (m: SubjectScore) => {
    const extra = m.extra === "" ? 0 : m.extra;
    return m.circles.length * 2 + extra;
  };

  const teamTotal = (t: number, arr?: SubjectScore[][]) => {
    const src = arr || scores;
    let sum = 0;
    src[t].forEach((m, si) => {
      const credit = SUBJECTS[si].credit;
      sum += subjectTotal(m) * credit;
    });
    return Number((sum / 10).toFixed(2));
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

    const roundId = await getOrCreateRound("Qualifier 1");

    // remove any previous entries for this round/teams
    const teamIds = teams.map(t => t.id);
    await supabase.from("scores").delete().eq("round_id", roundId).in("team_id", teamIds);

    const inserts = teams.map((team, t) => ({
      round_id: roundId,
      team_id: team.id,
      player_id: scores[t][si].playerId,
      points: Math.round(subjectTotal(scores[t][si]) * 100) // scaled int
    }));

    await supabase.from("scores").insert(inserts);

    // persist subject-level JSON details as requested
    await upsertSubjectDetail(si);

    // mark finished immediately so UI disables
    setFinishedSubjects(prev => ({ ...prev, [SUBJECTS[si].key]: true }));

    // update running totals (optional)
    setTeamTotals(prev =>
      prev.map((v, t) => teamTotal(t))
    );
  };

  // helper to persist detail info per subject
  const upsertSubjectDetail = async (si: number) => {
    const key = SUBJECTS[si].key;
    const performance: Record<string, number[]> = {};
    const extras: Record<string, number> = {};
    const players: Record<string, string> = {};

    teams.forEach((team, t) => {
      performance[team.id] = scores[t][si].circles;
      extras[team.id] = scores[t][si].extra === "" ? 0 : (scores[t][si].extra as number);
      players[team.id] = scores[t][si].playerId;
    });

    const { data, error } = await (supabase as any)
      .from('qualifier1_details')
      .upsert({
        subject: key,
        performance,
        extras,
        players
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
  };

  /* ================= UI (100% UNCHANGED) ================= */
  // ⚠️ UI PART CONTINUES EXACTLY AS YOUR ORIGINAL FILE


  return (
    <div className="round2-bg">
      <div className="round2-card">
        <h1 className="qualifier-title">Qualifier</h1>
        <h2>Qualifier Round 1</h2>

        {(!allSubjectsDone || showRound1) && SUBJECTS.map((s, si) => {
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
                            <select
                              className="glass-select subject-select"
                              disabled={lockedTeams[t] || finishedSubjects[SUBJECTS[si].key]}
                              value={scores[t][si].playerId}
                              onChange={async e => {
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
                                  const chosen = scores[t]
                                    .map((x, idx) => (idx === si ? "" : x.playerId))
                                    .filter(id => id);
                                  return !chosen.includes(m.id);
                                })
                                .map(m => (
                                  <option key={m.id} value={m.id}>
                                    {m.name}
                                  </option>
                                ))}
                            </select>
                          </td>

                          <td>
                            <div className="circle-group">
                              {[0, 1, 2, 3, 4].map(c => {
                                const takenByOther = scores.some((team, ti) => ti !== t && team[si].circles.includes(c));
                                return (
                                  <div
                                    key={c}
                                    className={`circle ${
                                      scores[t][si].circles.includes(c) ? "active" : ""
                                    } ${takenByOther ? "disabled" : ""}`}
                                    onClick={() => {
                                      if (finishedSubjects[SUBJECTS[si].key] || takenByOther) return;
                                      toggleCircle(t, si, c);
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
                              disabled={lockedTeams[t] || finishedSubjects[SUBJECTS[si].key]}
                              value={scores[t][si].extra}
                              placeholder=""
                              onChange={async e => {
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
                                updateLiveScore(teams[t].id, { qualifier_round1_final: pts, qualifier_round1_live: liveObj });
                              }
                              }
                            />
                          </td>

                          <td>{subjectTotal(scores[t][si])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {
                    // determine whether all teams have selected a player for this subject
                    (() => {
                      const allHavePlayers = teams.every((team, t) => scores[t][si].playerId);
                      return (
                        <button
                          className="finish-btn left"
                          onClick={() => finishSubject(si)}
                          disabled={
                            finishedSubjects[SUBJECTS[si].key] || !allHavePlayers
                          }
                          title={
                            !allHavePlayers &&
                            "Every team must choose a player before finishing"
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
          SHOW QUALIFIER ROUND 1
        </button>
      )}

        {allSubjectsDone && (
          <>
            <h2 style={{ textAlign: "left", marginTop: "60px" }}>
              Qualifier Round 2
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
                    disabled={round2Locked}
                    value={round2Scores[i]}
                    onChange={e => {
                      const copy = [...round2Scores];
                      copy[i] =
                        e.target.value === "" ? "" : Number(e.target.value);
                      setRound2Scores(copy);

                      // persist live score immediately
                      const pts = Math.round(Number(copy[i] || 0));
                      updateLiveScore(teams[i].id, { qualifier_round2_final: pts });
                    }}
                  />
                </div>
              ))}
            </div>

            <div className="button-group">
              <button
                className="finish-btn"
                onClick={finishRound2}
                disabled={round2Locked}
              >
                {round2Locked ? "ROUND 2 FINISHED" : "FINISH ROUND 2"}
              </button>


              {/* glass style button (not gradient) */}
              <button
                className="glass-btn"
                onClick={() => setShowCodingModal(true)}
              >
                HTML SCORES
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