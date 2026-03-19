import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Trash2 } from "lucide-react"; // add trash icon for deletion


interface ScoreRow {
  school_name: string;
  score: number;
  total: number;
  created_at: string;
  timer_remaining?: number;
}


export default function DichotomousScoreboardPage() {
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScores = async () => {
    setLoading(true);
    const db: any = supabase;

    // Fetch all quiz scores and join timer_remaining from dichotomous_user_trees
    const { data: rawScores, error } = await db
      .from("quiz_scores")
      .select("school_name, score, total, created_at, question_id")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch scores:", error);
      setLoading(false);
      return;
    }

    // For each score, fetch timer_remaining from dichotomous_user_trees
    const rows: ScoreRow[] = await Promise.all((rawScores ?? []).map(async (r: any) => {
      let timer_remaining: number | undefined = undefined;
      if (r.question_id) {
        const { data: userTree } = await db
          .from("dichotomous_user_trees")
          .select("timer_remaining")
          .eq("school_name", r.school_name)
          .eq("question_id", r.question_id)
          .maybeSingle();
        timer_remaining = userTree?.timer_remaining;
      }
      return {
        school_name: r.school_name,
        score: r.score,
        total: r.total,
        created_at: r.created_at,
        timer_remaining,
      };
    }));

    setScores(rows);
    setLoading(false);
  };

  useEffect(() => {
    fetchScores();
  }, []);

  // delete an individual score row and refresh list
  const deleteScore = async (row: ScoreRow) => {
    if (!window.confirm(`Delete score for ${row.school_name}?`)) {
      return;
    }
    const db: any = supabase;
    const { error } = await db
      .from("quiz_scores")
      .delete()
      .match({
        school_name: row.school_name,
        created_at: row.created_at,
      });
    if (error) {
      console.error("failed to delete score", error);
      return;
    }
    // refetch after removal
    fetchScores();
  };

  // compute percentage for each row (table already groups by school in raw data)
  const schoolRows = scores.map((r) => {
    const pct = r.total > 0 ? Math.round((r.score )) : 0;
    return {
      school_name: r.school_name,
      score100: pct,
      totalScore: r.score,
      maxPossible: r.total,
      timer_remaining: r.timer_remaining,
    };
  });

  // Format seconds as mm:ss
  function formatTime(s?: number) {
    if (typeof s !== "number" || isNaN(s)) return "-";
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold">🌳 Dichotomous Tree — Score Bord</h1>
        <Button variant="outline" size="sm" onClick={fetchScores} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary table: school totals out of 100 */}
      <Card>
        <CardHeader>
          <CardTitle>School-wise Scores</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-4">Loading...</p>
          ) : schoolRows.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No scores yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>School Name</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Time Remaining</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schoolRows.map((row, idx) => (
                  <TableRow key={row.school_name}>
                    <TableCell className="font-medium">{idx + 1}</TableCell>
                    <TableCell className="font-semibold">{row.school_name}</TableCell>
                    <TableCell className="text-center font-bold text-primary text-lg">{row.score100}</TableCell>
                    <TableCell className="text-center">{formatTime(row.timer_remaining)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detailed table: individual scores per question */}
    </div>
  );
}
