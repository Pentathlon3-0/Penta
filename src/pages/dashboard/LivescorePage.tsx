import { useEffect, useState, useRef } from "react";
import "../../Styles/ScoreboardPage.css";
import { supabase } from "../../integrations/supabase/client";

interface SchoolScore {
  id: string;
  name: string;
  score: number;
  logo_path?: string | null;
}

const LivescorePage = () => {
  const [schools, setSchools] = useState<SchoolScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [glowIndices, setGlowIndices] = useState<boolean[]>([]);
  const [fullSchool, setFullSchool] = useState<SchoolScore | null>(null);

  const prevSchoolsRef = useRef<SchoolScore[]>([]);

  useEffect(() => {
    loadScores(true);

    const channel = supabase
      .channel("livescore-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "livescore" },
        () => loadScores(false)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "livescore" },
        () => loadScores(false)
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "livescore" },
        () => loadScores(false)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadScores = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    const { data: schoolsData } = await (supabase.from("teams").select("id, name, logo_path") as any);
    const { data: liveData } = await ((supabase as any)
      .from("livescore")
      .select("school_id, round1_final,round2_final, qualifier_round1_final, qualifier_round2_final") as any);

    if (!schoolsData || !liveData) {
      setLoading(false);
      return;
    }

    const result: SchoolScore[] = schoolsData.map((school: any) => {
      const live = liveData.find((l: any) => l.school_id === school.id) || {};
      const r1 = live.round1_final || 0;
      const r2 = live.round2_final || 0;
      const q1 = live.qualifier_round1_final || 0;
      const q2 = live.qualifier_round2_final || 0;
      const total = r1 + r2 + q1 + q2;
      return {
        id: school.id,
        name: school.name,
        score: total,
        logo_path: school.logo_path || null,
      };
    });

    result.sort((a, b) => b.score - a.score);
    const prev = prevSchoolsRef.current;
    const newGlows = result.map((s, i) => {
      return prev[i] ? prev[i].score !== s.score : false;
    });
    setGlowIndices(newGlows);
    setTimeout(() => setGlowIndices([]), 1200);

    setSchools(result);
    setLoading(false);
    prevSchoolsRef.current = result;
  };

  return (
    <div className="score-bg">
      <div className="score-overlay">
        <div className="score-container">

          <h1 className="score-title">Live Scores</h1>

          {loading ? (
            <p className="loading-text">Loading...</p>
          ) : (
            <>
              {fullSchool && (
                <div className="fs-overlay" onClick={() => setFullSchool(null)}>
                  <div className="fs-card" onClick={e => e.stopPropagation()}>
                    <div className="crest-circle large">
                      {fullSchool.logo_path ? (
                        <img
                          src={supabase.storage.from('School_logo').getPublicUrl(fullSchool.logo_path).data.publicUrl}
                          alt="crest"
                          className="crest-img"
                        />
                      ) : (
                        <span className="crest-initial">
                          {fullSchool.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <h2>{fullSchool.name}</h2>
                    <p className="fs-score">{fullSchool.score.toFixed(1)}</p>
                  </div>
                </div>
              )}

              <div className="glass-scoreboard">
                <div className="timeline">
                  <div className="timeline-row header-row">
                    <div className="rank-col">RANK</div>
                    <div className="school-col">SCHOOL NAME</div>
                    <div className="score-col">SCORE</div>
                  </div>
                  {schools.slice(0, 7).map((school, index) => (
                    <div key={school.id} className={`timeline-row color-${index + 1}`} onClick={() => setFullSchool(school)}>
                      {index === 0 && (
                        <div className="crown-wrapper">
                          <lottie-player
                            src="/animations/crown.json"
                            background="transparent"
                            speed="1"
                            loop
                            autoplay
                            style={{ width: 40, height: 40 }}
                          ></lottie-player>
                        </div>
                      )}

                      <div className="rank-col">{index + 1}</div>

                      <div className="school-col">
                        <div className="crest-circle">
                          {school.logo_path ? (
                            <img
                              src={supabase.storage.from('School_logo').getPublicUrl(school.logo_path).data.publicUrl}
                              alt="crest"
                              className="crest-img"
                            />
                          ) : (
                            <span className="crest-initial">
                              {school.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        {school.name}
                      </div>

                      <div className={`score-col glow-on-update ${glowIndices[index] ? 'active' : ''}`}>
                        {school.score.toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default LivescorePage;
