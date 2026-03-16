import { useEffect, useState } from "react";
import { supabase } from "../../integrations/supabase/client";
import "../../Styles/PlayerPerformancePage.css";



type SchoolQuizProgress = {
  school_name: string;
  quiz1_score: number;
  quiz2_score: number;
  document_marks: number;
};


const SchoolQuizProgressPage = () => {
  const [rows, setRows] = useState<SchoolQuizProgress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProgress = async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("school_quiz_progress")
        .select("school_name, quiz1_score, quiz2_score, document_marks")
        .order("school_name");
      setRows(data || []);
      setLoading(false);
    };
    loadProgress();
  }, []);

  return (
    <div className="player-performance-bg">
      <div className="player-performance-card">
        <h1 className="player-performance-title">School Quiz Progress</h1>
        {loading ? (
          <p className="player-performance-loading">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="player-performance-loading">No data available yet.</p>
        ) : (
          <div className="player-performance-table-wrap">
            <table className="player-performance-table">
              <thead>
                <tr>
                  <th>School Name</th>
                  <th>Quiz 1 Score</th>
                  <th>Quiz 2 Score</th>
                  <th>Document Marks</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.school_name}>
                    <td>{row.school_name}</td>
                    <td>{row.quiz1_score}</td>
                    <td>{row.quiz2_score}</td>
                    <td>{row.document_marks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SchoolQuizProgressPage;
