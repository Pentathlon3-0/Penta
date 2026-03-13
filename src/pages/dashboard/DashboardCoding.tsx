import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { RefreshCw, RotateCcw, Trash2, Unlock } from "lucide-react";

interface CodingSub {
  id: string;
  school_name: string;
  percentage: number;
  check_attempts: number;
  final_output: string | null;
  submitted: boolean;
  enabled: boolean;
}

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

interface SchoolScore {
  school_name: string;
  correct: number;
  total: number;
  score: number;
}

export default function DashboardCoding() {
  const [subs, setSubs] = useState<CodingSub[]>([]);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState<SchoolScore[]>([]);
  const [question, setQuestion] = useState<QuestionRow | null>(null);
  const [blanks, setBlanks] = useState<BlankRow[]>([]);
  const { isAdmin } = useAuth();

  const fetchQuestion = async () => {
    const db: any = supabase;
    const { data: qData } = await db
      .from("questions")
      .select("id, html_content, blanks_count")
      .order("id", { ascending: true })
      .limit(1)
      .single();
    if (qData) {
      setQuestion(qData);
      const { data: bData } = await db
        .from("question_blanks")
        .select("blank_id, correct_answer, position")
        .eq("question_id", qData.id)
        .order("position", { ascending: true });
      setBlanks(bData ?? []);
    }
  };

  const computeScores = (submissions: CodingSub[], q: QuestionRow | null, bl: BlankRow[]) => {
    if (!q || bl.length === 0) return;
    const total = bl.length;
    const submitted = submissions.filter((s) => s.submitted && s.final_output);

    // Build expected HTML to compare against
    const expectedHTML = (() => {
      let html = q.html_content;
      for (const b of bl) {
        html = html.replace(new RegExp(`<__${b.blank_id}__>`, "g"), `<${b.correct_answer}>`);
        html = html.replace(new RegExp(`</__${b.blank_id}__>`, "g"), `</${b.correct_answer}>`);
        html = html.replace(new RegExp(`__${b.blank_id}__`, "g"), b.correct_answer);
      }
      return html;
    })();

    const results: SchoolScore[] = submitted.map((s) => {
      // For each blank, check if replacing just that blank wrong while others correct changes the output
      // Simpler: count how many blanks the user got right by testing individually
      let correct = 0;
      for (const b of bl) {
        // Build HTML with all correct answers EXCEPT this blank uses empty string
        let withoutThisBlank = q.html_content;
        for (const ob of bl) {
          const val = ob.blank_id === b.blank_id ? "" : ob.correct_answer;
          withoutThisBlank = withoutThisBlank.replace(new RegExp(`<__${ob.blank_id}__>`, "g"), `<${val}>`);
          withoutThisBlank = withoutThisBlank.replace(new RegExp(`</__${ob.blank_id}__>`, "g"), `</${val}>`);
          withoutThisBlank = withoutThisBlank.replace(new RegExp(`__${ob.blank_id}__`, "g"), val);
        }
        // Build HTML with user's output minus the correct answer for this blank
        // Actually simplest: check if user output matches expected when we only vary this blank
        // Let's just check: does the user output contain the correct substitution for this blank?
        // Build user-like HTML with correct answer for this blank and "" for others
        let withOnlyThisBlank = q.html_content;
        for (const ob of bl) {
          const val = ob.blank_id === b.blank_id ? b.correct_answer : "";
          withOnlyThisBlank = withOnlyThisBlank.replace(new RegExp(`<__${ob.blank_id}__>`, "g"), `<${val}>`);
          withOnlyThisBlank = withOnlyThisBlank.replace(new RegExp(`</__${ob.blank_id}__>`, "g"), `</${val}>`);
          withOnlyThisBlank = withOnlyThisBlank.replace(new RegExp(`__${ob.blank_id}__`, "g"), val);
        }

        // Simple approach: check if the final_output equals expected (100%) or check per-blank
        // Most reliable: if user final_output === expectedHTML, all correct
        // Otherwise check per blank by seeing if the correct answer text appears in the right spot
        if (s.final_output === expectedHTML) {
          correct = total;
          break;
        }

        // Per-blank check: replace this blank with correct answer in template portion,
        // see if that portion exists in user output
        const correctTag = b.correct_answer;
        // Check both tag and inline patterns
        const tagOpen = `<${correctTag}>`;
        const tagClose = `</${correctTag}>`;
        const userOutput = s.final_output!;

        // If the blank is used as a tag (e.g. <div>), check tags exist
        if (q.html_content.includes(`<__${b.blank_id}__>`)) {
          if (userOutput.includes(tagOpen) && userOutput.includes(tagClose)) {
            correct++;
          }
        } else {
          // Inline blank — check if the correct answer text appears
          if (userOutput.includes(correctTag)) {
            correct++;
          }
        }
      }

      const score = Math.round((100 / total) * correct);
      return { school_name: s.school_name, correct, total, score };
    });

    setScores(results);
  };

  const fetchSubs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("coding_submissions")
      .select("*")
      .order("created_at", { ascending: false });
    const list = (data as CodingSub[]) || [];
    setSubs(list);
    setLoading(false);
    // recompute scores whenever subs change
    if (question && blanks.length > 0) {
      computeScores(list, question, blanks);
    }
  };

  useEffect(() => {
    fetchQuestion();
  }, []);

  useEffect(() => {
    fetchSubs();
    const channel = supabase
      .channel("coding-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "coding_submissions" }, () => {
        fetchSubs();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [question, blanks]);

  const enableSchool = async (id: string) => {
    await supabase.from("coding_submissions").update({ enabled: true, submitted: false }).eq("id", id);
    toast.success("School re-enabled for next attempt!");
  };

  const resetSubmission = async (id: string) => {
    await supabase.from("coding_submissions").update({
      percentage: 0,
      check_attempts: 0,
      final_output: null,
      submitted: false,
      enabled: true,
    }).eq("id", id);
    toast.success("Submission reset!");
  };

  const deleteSubmission = async (id: string) => {
    await supabase.from("coding_submissions").delete().eq("id", id);
    toast.success("Submission deleted!");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">💻 Coding Submissions</h1>
        <Button variant="ghost" size="sm" onClick={fetchSubs}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>Match %</TableHead>
                <TableHead>Check Attempts</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.school_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${s.percentage}%` }}
                        />
                      </div>
                      <span className="text-sm">{s.percentage}%</span>
                    </div>
                  </TableCell>
                  <TableCell>{s.check_attempts}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      s.submitted && !s.enabled
                        ? "bg-primary/10 text-primary"
                        : s.submitted && s.enabled
                        ? "bg-green-500/10 text-green-600"
                        : !s.submitted && s.enabled
                        ? "bg-yellow-500/10 text-yellow-600"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {s.submitted && !s.enabled
                        ? "Submitted (Locked)"
                        : s.submitted && s.enabled
                        ? "Re-enabled"
                        : "In Progress"}
                    </span>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => enableSchool(s.id)}>
                          <Unlock className="h-4 w-4 mr-1" /> Re-enable
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => resetSubmission(s.id)}>
                          <RotateCcw className="h-4 w-4 mr-1" /> Reset
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteSubmission(s.id)}>
                          <Trash2 className="h-4 w-4 mr-1" /> Delete
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {subs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground py-8">
                    No coding submissions yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Scores table — only submitted schools */}
      {scores.length > 0 && (
        <>
          <h2 className="font-display text-xl font-bold">🏆 Coding Scores</h2>
          <Card className="glass-card">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>School</TableHead>
                    <TableHead>Correct Blanks</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scores.map((s) => (
                    <TableRow key={s.school_name}>
                      <TableCell className="font-medium">{s.school_name}</TableCell>
                      <TableCell>{s.correct} / {s.total}</TableCell>
                      <TableCell>
                        <span className="font-display font-bold text-lg">{s.score}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
