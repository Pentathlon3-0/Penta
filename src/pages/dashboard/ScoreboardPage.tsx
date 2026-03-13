import { useEffect, useState, useRef } from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "lottie-player": any;
    }
  }
}
// using Lottie web component instead of react package
// add this script tag in index.html or useEffect: 
// <script src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js"></script>
// place crown.json at public/animations/crown.json
import "../../Styles/ScoreboardPage.css";
import { supabase } from "../../integrations/supabase/client";

interface SchoolScore {
  id: string;
  name: string;
  score: number;
  logo_path?: string | null;
}

const ScoreboardPage = () => {
  const [schools, setSchools] = useState<SchoolScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [glowIndices, setGlowIndices] = useState<boolean[]>([]);
  const [fullSchool, setFullSchool] = useState<SchoolScore | null>(null);

  // keep previous schools for comparison
  const prevSchoolsRef = useRef<SchoolScore[]>([]);

  // no static URLs any more; will use logo_path from database

  useEffect(() => {
    loadScores();

    // Re-fetch whenever a score row is inserted, updated, or deleted
    const channel = supabase
      .channel("scores-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scores" },
        () => loadScores()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadScores = async () => {
    setLoading(true);

    // cast to any so TS doesn't complain about unknown columns
    const { data: schoolsData } = await (supabase.from("teams").select("id, name, logo_path") as any);
    const { data: scoresData } = await supabase.from("scores").select("team_id, points");

    if (!schoolsData || !scoresData) {
      setLoading(false);
      return;
    }

    const result: SchoolScore[] = schoolsData.map((school: any) => {
      const total = scoresData
        .filter((s) => s.team_id === school.id)
        .reduce((sum, s) => sum + (s.points ?? 0), 0);

      return {
        id: school.id,
        name: school.name,
        score: total,
        logo_path: school.logo_path || null,
      };
    });

    // sort and save
    result.sort((a, b) => b.score - a.score);
    // determine which rows changed score
    const prev = prevSchoolsRef.current;
    const newGlows = result.map((s, i) => {
      return prev[i] ? prev[i].score !== s.score : false;
    });
    setGlowIndices(newGlows);
    // clear glows after animation duration
    setTimeout(() => setGlowIndices([]), 1200);

    setSchools(result);
    setLoading(false);
    prevSchoolsRef.current = result;
  };

  return (
    <div className="score-bg">
      <div className="score-overlay">
        <div className="score-container">

          <h1 className="score-title">Score Board</h1>

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
                  {/* header row */}
                  <div className="timeline-row header-row">
                    <div className="rank-col">RANK</div>
                    <div className="school-col">SCHOOL NAME</div>
                    <div className="score-col">SCORE</div>
                  </div>
                  {schools.slice(0,7).map((school, index) => (
                    <div key={school.id} className={`timeline-row color-${index + 1}`} onClick={() => setFullSchool(school)}>
                      {/* crown animation on first row */}
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

export default ScoreboardPage;
