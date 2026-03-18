import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuestionRow {
  id: number;
  title: string;
  description: string | null;
  html_content: string;
}

interface BlankRow {
  blank_id: string;
  correct_answer: string;
}

export default function ExpectedOutputPage() {
  const [question, setQuestion] = useState<QuestionRow | null>(null);
  const [blanks, setBlanks] = useState<BlankRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const db: any = supabase;
      const { data: qData } = await db
        .from("questions")
        .select("id, title, description, html_content")
        .order("id", { ascending: true })
        .limit(1)
        .single();

      if (qData) {
        setQuestion(qData);
        const { data: bData } = await db
          .from("question_blanks")
          .select("blank_id, correct_answer")
          .eq("question_id", qData.id);
        setBlanks(bData ?? []);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const expectedHTML = useCallback(() => {
    if (!question) return "";
    let html = question.html_content;
    for (const b of blanks) {
      html = html.replace(new RegExp(`<__${b.blank_id}__>`, "g"), `<${b.correct_answer}>`);
      html = html.replace(new RegExp(`</__${b.blank_id}__>`, "g"), `</${b.correct_answer}>`);
      html = html.replace(new RegExp(`__${b.blank_id}__`, "g"), b.correct_answer);
    }
    return `<style>html,body{background:#0f172a;color:#fff;font-family:Inter,sans-serif;margin:0;padding:8px;}*{color:#fff;}</style>${html}`;
  }, [question, blanks]);

  if (loading) return <p className="p-8 text-center text-muted-foreground">Loading...</p>;
  if (!question) return <p className="p-8 text-center text-destructive">No question found.</p>;

  return (
    <div style={{ width: "100%", height: "100vh", margin: 0, padding: 0 }}>
      <iframe
        srcDoc={expectedHTML()}
        title="Expected Output"
        style={{
          width: "100%",
          height: "100vh",
          border: "none",
          margin: 0,
          padding: 0,
          display: "block",
          background: "#0f172a"
        }}
        sandbox="allow-scripts"
      />
    </div>
  );
}
