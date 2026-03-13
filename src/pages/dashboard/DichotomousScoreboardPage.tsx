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
}


export default function DichotomousScoreboardPage() {
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchScores = async () => {
    setLoading(true);
    const db: any = supabase;

    // Fetch all quiz scores (current schema has only school_name, score, total)
    const { data: rawScores, error } = await db
      .from("quiz_scores")
      .select("school_name, score, total, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch scores:", error);
      setLoading(false);
      return;
    }

    const rows: ScoreRow[] = (rawScores ?? []).map((r: any) => ({
      school_name: r.school_name,
      score: r.score,
      total: r.total,
      created_at: r.created_at,
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
    const pct = r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;
    return {
      school_name: r.school_name,
      score100: pct,
      totalScore: r.score,
      maxPossible: r.total,
    };
  });

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
          <CardTitle>School-wise Total Scores (Out of 100)</CardTitle>
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
                  <TableHead className="text-center">Questions</TableHead>
                  <TableHead className="text-center">Total Points</TableHead>
                  <TableHead className="text-center">Out of 100</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schoolRows.map((row, idx) => (
                  <TableRow key={row.school_name}>
                    <TableCell className="font-medium">{idx + 1}</TableCell>
                    <TableCell className="font-semibold">{row.school_name}</TableCell>
                    <TableCell className="text-center">{row.totalScore}/{row.maxPossible}</TableCell>
                    <TableCell className="text-center font-bold text-primary text-lg">{row.score100}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detailed table: individual scores per question */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Scores</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-4">Loading...</p>
          ) : scores.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No scores yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>School Name</TableHead>
                  <TableHead className="text-center">Points</TableHead>
                  <TableHead className="text-center">Time</TableHead>
                  <TableHead className="w-20">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scores.map((row, idx) => (
                  <TableRow key={`${row.school_name}-${idx}`}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="font-semibold">{row.school_name}</TableCell>
                    <TableCell className="text-center font-bold">{row.score}/{row.total}</TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => deleteScore(row)}
                        title="Delete this score"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
