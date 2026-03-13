import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Pencil, Trash2, Check } from "lucide-react";

export default function QuizAdminPage() {
  const [quiz1, setQuiz1] = useState(false);
  const [quiz2, setQuiz2] = useState(false);
  const [loading, setLoading] = useState(true);

  // questions stored in new table
  type QuizRow = { id: number; quiz_name: string; qa: any };
  const [questions, setQuestions] = useState<QuizRow[]>([]);

  // form state for new/edit
  const [editId, setEditId] = useState<number | null>(null);
  const [formQuizName, setFormQuizName] = useState("quiz1");
  // structured fields rather than raw JSON
  const [formQuestion, setFormQuestion] = useState("");
  const [optionA, setOptionA] = useState("");
  const [optionB, setOptionB] = useState("");
  const [optionC, setOptionC] = useState("");
  const [optionD, setOptionD] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await (supabase as any)
        .from("quiz_status")
        .select("quiz1_enabled,quiz2_enabled")
        .eq("id", "1")
        .single();
      if (error) {
        toast.error("Failed to load quiz status");
      } else if (data) {
        setQuiz1(data.quiz1_enabled);
        setQuiz2(data.quiz2_enabled);
      }
      setLoading(false);
      await fetchQuestions();
    };
    load();
  }, []);

  const update = async (field: "quiz1_enabled" | "quiz2_enabled", value: boolean) => {
    setLoading(true);
    const { error } = await (supabase as any)
      .from("quiz_status")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", "1");
    if (error) {
      toast.error("Update failed");
    } else {
      toast.success("Status updated");
      if (field === "quiz1_enabled") setQuiz1(value);
      else setQuiz2(value);
    }
    setLoading(false);
  };

  const fetchQuestions = async () => {
    const { data, error } = await (supabase as any)
      .from("quiz_questions")
      .select("id,quiz_name,qa")
      .order("id", { ascending: true });
    if (error) {
      toast.error("Unable to load questions");
    } else if (data) {
      setQuestions(data);
    }
  };

  const handleSave = async () => {
    setFormSaving(true);
    try {
      // build the JSON object from individual fields
      const qaObj: any = { question: formQuestion, answer: correctAnswer };
      if (optionA) qaObj.option_a = optionA;
      if (optionB) qaObj.option_b = optionB;
      if (optionC) qaObj.option_c = optionC;
      if (optionD) qaObj.option_d = optionD;

      if (editId === null) {
        const { data, error } = await (supabase as any)
          .from("quiz_questions")
          .insert([{ quiz_name: formQuizName, qa: qaObj }])
          .select();
        if (error) throw error;
        toast.success("Question added");
      } else {
        const { error } = await (supabase as any)
          .from("quiz_questions")
          .update({ quiz_name: formQuizName, qa: qaObj, updated_at: new Date().toISOString() })
          .eq("id", editId);
        if (error) throw error;
        toast.success("Question updated");
      }
      setFormQuizName("quiz1");
      setFormQuestion("");
      setOptionA("");
      setOptionB("");
      setOptionC("");
      setOptionD("");
      setCorrectAnswer("");
      setEditId(null);
      setShowForm(false);
      await fetchQuestions();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save question");
    }
    setFormSaving(false);
  };

  const handleEdit = (row: QuizRow) => {
    setEditId(row.id);
    setShowForm(false); // Hide the global add form if it was open
    setFormQuizName(row.quiz_name);
    // populate structured fields
    const qa = row.qa || {};
    setFormQuestion(qa.question || "");
    setOptionA(qa.option_a || "");
    setOptionB(qa.option_b || "");
    setOptionC(qa.option_c || "");
    setOptionD(qa.option_d || "");
    setCorrectAnswer(qa.answer || "");
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    const { error } = await (supabase as any)
      .from("quiz_questions")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Delete failed");
    } else {
      toast.success("Question removed");
      await fetchQuestions();
    }
  };

  const renderForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium">Quiz Name</label>
        <select
          value={formQuizName}
          onChange={e => setFormQuizName(e.target.value)}
          className="input bg-muted w-full p-2 rounded-md"
        >
          <option value="quiz1">quiz1</option>
          <option value="quiz2">quiz2</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium">Question</label>
        <Input
          className="bg-muted"
          value={formQuestion}
          onChange={e => setFormQuestion(e.target.value)}
        />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm">Option A</label>
          <Input value={optionA} onChange={e => setOptionA(e.target.value)} className="bg-muted" />
        </div>
        <div className="space-y-1">
          <label className="text-sm">Option B</label>
          <Input value={optionB} onChange={e => setOptionB(e.target.value)} className="bg-muted" />
        </div>
        <div className="space-y-1">
          <label className="text-sm">Option C</label>
          <Input value={optionC} onChange={e => setOptionC(e.target.value)} className="bg-muted" />
        </div>
        <div className="space-y-1">
          <label className="text-sm">Option D</label>
          <Input value={optionD} onChange={e => setOptionD(e.target.value)} className="bg-muted" />
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium">Correct Answer</label>
        <Input
          className="bg-muted"
          placeholder="e.g. 4 or option_c"
          value={correctAnswer}
          onChange={e => setCorrectAnswer(e.target.value)}
        />
      </div>
      <div className="flex gap-2 pt-2">
        <Button onClick={handleSave} disabled={formSaving}>
          {editId === null ? "Save" : "Update"}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setEditId(null);
            setFormQuizName("quiz1");
            setFormQuestion("");
            setOptionA("");
            setOptionB("");
            setOptionC("");
            setOptionD("");
            setCorrectAnswer("");
            setShowForm(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Quiz Configuration</h2>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span>Quiz 1 enabled</span>
          <Switch
            checked={quiz1}
            onCheckedChange={checked => update("quiz1_enabled", checked)}
            disabled={loading}
          />
        </div>
        <div className="flex items-center justify-between">
          <span>Quiz 2 enabled</span>
          <Switch
            checked={quiz2}
            onCheckedChange={checked => update("quiz2_enabled", checked)}
            disabled={loading}
          />
        </div>
      </div>

      {/* question management */}
      <div className="pt-6 border-t border-muted">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold">Manage Questions</h3>
          {!showForm && editId === null && (
            <Button onClick={() => {
              setEditId(null);
              setFormQuizName("quiz1");
              setFormQuestion("");
              setOptionA("");
              setOptionB("");
              setOptionC("");
              setOptionD("");
              setCorrectAnswer("");
              setShowForm(true);
            }}>Add Question</Button>
          )}
        </div>

        {showForm && editId === null && (
          <Card className="mt-4 p-4 bg-card">
            <h3 className="text-xl font-bold mb-4">Add New Question</h3>
            {renderForm()}
          </Card>
        )}

        <div className="mt-8 space-y-6">
          {questions.length === 0 ? (
            <p className="text-center text-muted-foreground">No questions yet.</p>
          ) : (
            questions
              .filter(q => q.qa && q.qa.question && q.qa.question.trim() !== "")
              .map((q, index) => {
                if (editId === q.id) {
                  return (
                    <Card key={q.id} className="p-4 sm:p-6 bg-[#0B1120] border-muted/30">
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-xl font-bold text-white">Editing Q{index + 1}</span>
                      </div>
                      {renderForm()}
                    </Card>
                  );
                }

                const qa = q.qa || {};

                // Helper to match the correctAnswer against possible typed inputs
                const isCorrect = (optKey: string, optLetter: string, optNum: string, optVal: string) => {
                  if (!qa.answer) return false;
                  const ans = String(qa.answer).toLowerCase().trim();
                  const val = String(optVal).toLowerCase().trim();
                  return (
                    ans === optKey.toLowerCase() ||
                    ans === optLetter.toLowerCase() ||
                    ans === optNum ||
                    (val !== "" && ans === val)
                  );
                };

                return (
                  <Card key={q.id} className="p-4 sm:p-6 bg-[#0B1120] border-muted/30">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-6 gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl font-bold text-white">Q{index + 1}.</span>
                        <span className="px-3 py-1 bg-amber-500/10 text-amber-500 rounded text-sm font-medium border border-amber-500/20">
                          {q.quiz_name}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleEdit(q)} 
                          className="gap-2 bg-transparent border-muted-foreground/30 hover:bg-muted-foreground/10"
                        >
                          <Pencil className="w-4 h-4" /> Edit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive" 
                          onClick={() => handleDelete(q.id)} 
                          className="gap-2 bg-red-950 hover:bg-red-900 border border-red-900 text-red-100"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </Button>
                      </div>
                    </div>

                    <h3 className="text-lg font-medium text-white mb-6">{qa.question}</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { key: "option_a", letter: "A", num: "1" },
                        { key: "option_b", letter: "B", num: "2" },
                        { key: "option_c", letter: "C", num: "3" },
                        { key: "option_d", letter: "D", num: "4" },
                      ].map(opt => {
                        if (!qa[opt.key]) return null;
                        const correct = isCorrect(opt.key, opt.letter, opt.num, qa[opt.key]);
                        return (
                          <div
                            key={opt.key}
                            className={`p-3 rounded-xl flex justify-between items-center ${
                              correct ? "bg-green-950/40 border border-green-900/50" : "bg-teal-950/20"
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <span
                                className={`flex items-center justify-center w-8 h-8 rounded-lg font-bold ${
                                  correct
                                    ? "bg-teal-700 text-white"
                                    : "bg-teal-900/40 text-teal-300"
                                }`}
                              >
                                {opt.letter}
                              </span>
                              <span className="text-sm font-medium text-white/90">
                                {qa[opt.key]}
                              </span>
                            </div>
                            {correct && (
                              <span className="text-green-500 text-sm font-bold flex items-center gap-1 pr-2">
                                <Check className="w-4 h-4" strokeWidth={3} /> Correct
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}
