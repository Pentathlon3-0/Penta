import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Pencil, Save, X } from "lucide-react";

interface QuestionRow {
  id: number;
  title: string;
  description: string | null;
  difficulty: string;
  html_content: string;
  blanks_count: number;
  timer_seconds: number;
}

interface BlankRow {
  id: string;
  blank_id: string;
  correct_answer: string;
  position: number;
}

export default function EditQuestionPage() {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [blanksMap, setBlanksMap] = useState<Record<number, BlankRow[]>>({});
  const [loading, setLoading] = useState(true);

  // editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editHtmlContent, setEditHtmlContent] = useState("");
  const [editTimerSeconds, setEditTimerSeconds] = useState(600);
  const [editBlanks, setEditBlanks] = useState<BlankRow[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const db: any = supabase;

    const { data: qData } = await db
      .from("questions")
      .select("id, title, description, difficulty, html_content, blanks_count, timer_seconds")
      .order("id", { ascending: true });

    const qs: QuestionRow[] = qData ?? [];
    setQuestions(qs);

    const map: Record<number, BlankRow[]> = {};
    for (const q of qs) {
      const { data: bData } = await db
        .from("question_blanks")
        .select("id, blank_id, correct_answer, position")
        .eq("question_id", q.id)
        .order("position", { ascending: true });
      map[q.id] = bData ?? [];
    }
    setBlanksMap(map);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const startEdit = (q: QuestionRow) => {
    setEditingId(q.id);
    setEditTitle(q.title);
    setEditDescription(q.description ?? "");
    setEditHtmlContent(q.html_content);
    setEditTimerSeconds(q.timer_seconds || 600);
    setEditBlanks((blanksMap[q.id] ?? []).map((b) => ({ ...b })));
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleBlankAnswerChange = (index: number, value: string) => {
    setEditBlanks((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], correct_answer: value };
      return updated;
    });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setSaving(true);
    const db: any = supabase;

    // Update the question row
    const { error: qErr } = await db
      .from("questions")
      .update({
        title: editTitle,
        description: editDescription || null,
        html_content: editHtmlContent,
        blanks_count: editBlanks.length,
        timer_seconds: editTimerSeconds,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingId);

    if (qErr) {
      toast.error("Failed to update question: " + qErr.message);
      setSaving(false);
      return;
    }

    // Update each blank's correct_answer
    for (const b of editBlanks) {
      const { error: bErr } = await db
        .from("question_blanks")
        .update({ correct_answer: b.correct_answer })
        .eq("id", b.id);

      if (bErr) {
        toast.error(`Failed to update ${b.blank_id}: ${bErr.message}`);
        setSaving(false);
        return;
      }
    }

    toast.success("Question updated!");
    setSaving(false);
    setEditingId(null);
    fetchAll();
  };

  // Build a preview: replace blanks with correct answers
  const buildPreview = (htmlContent: string, qBlanks: BlankRow[]) => {
    let html = htmlContent;
    for (const b of qBlanks) {
      html = html.replace(new RegExp(`<__${b.blank_id}__>`, "g"), `<${b.correct_answer}>`);
      html = html.replace(new RegExp(`</__${b.blank_id}__>`, "g"), `</${b.correct_answer}>`);
      html = html.replace(new RegExp(`__${b.blank_id}__`, "g"), b.correct_answer);
    }
    return `<style>html,body{background:#0f172a;color:#fff;font-family:Inter,sans-serif;margin:0;padding:8px;}*{color:#fff;}</style>${html}`;
  };

  if (loading) {
    return <p className="text-center text-muted-foreground p-8">Loading questions...</p>;
  }

  if (questions.length === 0) {
    return <p className="text-center text-muted-foreground p-8">No questions found in database.</p>;
  }

  return (
    <div className="p-4 space-y-6">
      <h2 className="font-display text-2xl font-semibold">Edit Questions</h2>

      {questions.map((q) => {
        const isEditing = editingId === q.id;
        const qBlanks = blanksMap[q.id] ?? [];

        return (
          <Card key={q.id} className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">
                #{q.id} — {isEditing ? "Editing" : q.title}
              </CardTitle>
              {!isEditing && (
                <Button variant="outline" size="sm" onClick={() => startEdit(q)}>
                  <Pencil className="h-4 w-4 mr-1" /> Edit
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  {/* Editable fields */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Title</label>
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Timer (minutes)</label>
                    <Input
                      type="number"
                      min={1}
                      value={Math.round(editTimerSeconds / 60)}
                      onChange={(e) => setEditTimerSeconds(Math.max(60, parseInt(e.target.value || "1", 10) * 60))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">HTML Content (with __BLANK_X__ placeholders)</label>
                    <textarea
                      value={editHtmlContent}
                      onChange={(e) => setEditHtmlContent(e.target.value)}
                      rows={6}
                      className="w-full font-mono text-sm border rounded-lg p-3 bg-muted"
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium">Blank Answers</label>
                    {editBlanks.map((b, idx) => (
                      <div key={b.id} className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground w-24">{b.blank_id}:</span>
                        <Input
                          value={b.correct_answer}
                          onChange={(e) => handleBlankAnswerChange(idx, e.target.value)}
                          className="flex-1 font-mono"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Live preview */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Live Preview</label>
                    <iframe
                      srcDoc={buildPreview(editHtmlContent, editBlanks)}
                      title="Edit Preview"
                      style={{ width: "100%", height: "180px", border: "none", borderRadius: "4px" }}
                      sandbox="allow-scripts"
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={handleUpdate} disabled={saving}>
                      <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Update"}
                    </Button>
                    <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                      <X className="h-4 w-4 mr-1" /> Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Read-only view */}
                  {q.description && (
                    <p className="text-sm text-muted-foreground">{q.description}</p>
                  )}
                  <p className="text-sm"><span className="text-muted-foreground">Timer:</span> {Math.round((q.timer_seconds || 600) / 60)} minutes</p>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">HTML Template</label>
                    <div className="font-mono bg-muted p-3 rounded-lg text-sm whitespace-pre-wrap">
                      {q.html_content}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Blank Answers</label>
                    <div className="space-y-1">
                      {qBlanks.map((b) => (
                        <div key={b.id} className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground w-24">{b.blank_id}:</span>
                          <span className="font-mono font-medium">{b.correct_answer}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Expected Output</label>
                    <iframe
                      srcDoc={buildPreview(q.html_content, qBlanks)}
                      title="Expected Output Preview"
                      style={{ width: "100%", height: "180px", border: "none", borderRadius: "4px" }}
                      sandbox="allow-scripts"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
