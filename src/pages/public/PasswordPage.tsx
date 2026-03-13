import { useState, useRef, useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import "../../Styles/PasswordPage.css";

// quiz data will be loaded from the database table `quiz_questions`.
// each row stores a JSON object in `qa` with at least the following shape:
// {
//   question: string,
//   option_a?: string,
//   option_b?: string,
//   option_c?: string,
//   option_d?: string,
//   answer: string            <-- the correct answer value (not the key)
// }
// Example JSON for a multiple‑choice question:
// {"question":"What is 2+2?","option_a":"2","option_b":"3","option_c":"4","option_d":"5","answer":"4"}

interface QuizItem {
  question: string;
  answer: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  // allow any extra fields, we don't care
  [key: string]: any;
}

// quiz arrays will be stored in component state (see below)


// the final 10-character password; can be letters, numbers or symbols
const FINAL_PASSWORD = "Ab12!XyZ90";

export default function PasswordPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin } = useAuth();

  const [schoolName, setSchoolName] = useState("");
  const [step, setStep] = useState<
    "enterSchool" | "quiz1" | "quiz2"
  >("enterSchool");

  const [quiz1Enabled, setQuiz1Enabled] = useState<boolean>(false);
  const [quiz2Enabled, setQuiz2Enabled] = useState<boolean>(false);

  // quiz questions fetched from database
  const [quiz1, setQuiz1] = useState<QuizItem[]>([]);
  const [quiz2, setQuiz2] = useState<QuizItem[]>([]);

  // reveal buttons linking to quizzes after school entered
  const [showLinks, setShowLinks] = useState(false);
  const quiz1Ref = useRef<HTMLDivElement>(null);
  const quiz2Ref = useRef<HTMLDivElement>(null);
  // const clueRef = useRef<HTMLDivElement>(null);  // removed
  // const doneRef = useRef<HTMLDivElement>(null);  // removed
  const navRef = useRef<HTMLDivElement>(null);

  const [answers1, setAnswers1] = useState<string[]>([]);
  const [answers2, setAnswers2] = useState<string[]>([]);

  // reinitialise answer arrays whenever the questions change
  useEffect(() => {
    setAnswers1(Array(quiz1.length).fill(""));
  }, [quiz1]);
  useEffect(() => {
    setAnswers2(Array(quiz2.length).fill(""));
  }, [quiz2]);

  const [part1, setPart1] = useState("");
  const [part2, setPart2] = useState("");

  // load status on mount
  // read step/school from query string on mount or when location changes
  useEffect(() => {
    const stepParam = searchParams.get("step") as
      | "enterSchool"
      | "quiz1"
      | "quiz2";
    const schoolParam = searchParams.get("school") || "";
    if (schoolParam) {
      setSchoolName(schoolParam);
    }
    if (stepParam) {
      setStep(stepParam);
      setShowLinks(stepParam !== "enterSchool");
    }
  }, [location.search]);

  // when step changes we may need to scroll into view
  useEffect(() => {
    if (step === "quiz1") {
      // delayed until after render
      setTimeout(() => quiz1Ref.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
    if (step === "quiz2") {
      setTimeout(() => quiz2Ref.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
    if (step === "enterSchool") {
      // nothing special
    }
  }, [step]);

  useEffect(() => {
    const load = async () => {
      // load status flags
      const { data } = await (supabase as any)
        .from("quiz_status")
        .select("quiz1_enabled, quiz2_enabled")
        .eq("id", "1")
        .single();
      if (data) {
        setQuiz1Enabled(data.quiz1_enabled);
        setQuiz2Enabled(data.quiz2_enabled);
      }

      // fetch the questions for both quizzes
      const { data: q1 } = await (supabase as any)
        .from("quiz_questions")
        .select("qa")
        .eq("quiz_name", "quiz1")
        .order("id", { ascending: true });
      if (q1) setQuiz1(q1.map((r: any) => r.qa));

      const { data: q2 } = await (supabase as any)
        .from("quiz_questions")
        .select("qa")
        .eq("quiz_name", "quiz2")
        .order("id", { ascending: true });
      if (q2) setQuiz2(q2.map((r: any) => r.qa));
    };
    load();
  }, []);

  const updateStatus = async (field: "quiz1_enabled" | "quiz2_enabled", value: boolean) => {
    const { error } = await (supabase as any)
      .from("quiz_status")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", "1");
    if (!error) {
      if (field === "quiz1_enabled") setQuiz1Enabled(value);
      else setQuiz2Enabled(value);
    }
  };

  const handleContinueSchool = () => {
    if (!schoolName.trim()) return;
    setShowLinks(true);
    // once school entered we no longer need the input card
    setStep("quiz1");
    // update url so reload stays on quiz1
    setSearchParams({ step: "quiz1", school: schoolName });
    // scroll to navigation card
    setTimeout(() => {
      navRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleSubmitQuiz1 = () => {
    let correct = 0;
    quiz1.forEach((q, idx) => {
      const expected = (q.answer || "").toString().trim().toLowerCase();
      if (answers1[idx].trim().toLowerCase() === expected) {
        correct++;
      }
    });
    // 3 correct -> 6 chars, 2 -> 4, 1 -> 2, 0 -> 0
    const chunk = FINAL_PASSWORD.slice(0, correct * 2);
    setPart1(chunk);
    // immediately advance to quiz2 and scroll
    setStep("quiz2");
    setSearchParams({ step: "quiz2", school: schoolName });
    setTimeout(() => quiz2Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  // removed clue navigation

  const handleSubmitQuiz2 = () => {
    let correct = 0;
    quiz2.forEach((q, idx) => {
      let expected = (q.answer || "").toString().trim().toLowerCase();
      // map numeric/option answers back to a/b/c/d for comparison with button selection
      if (expected === "1" || expected === "option_a" || expected === q.option_a?.toLowerCase()) expected = "a";
      if (expected === "2" || expected === "option_b" || expected === q.option_b?.toLowerCase()) expected = "b";
      if (expected === "3" || expected === "option_c" || expected === q.option_c?.toLowerCase()) expected = "c";
      if (expected === "4" || expected === "option_d" || expected === q.option_d?.toLowerCase()) expected = "d";

      if ((answers2[idx] || "").trim().toLowerCase() === expected) {
        correct++;
      }
    });
    // 2 correct -> 4 chars, 1 -> 2, 0 -> 0
    setPart2(FINAL_PASSWORD.slice(6, 6 + correct * 2));
    // no done card; remain on quiz2 or nav
    setTimeout(() => navRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const renderEnter = () => (
    <Card className="max-w-lg mx-auto">
      <CardHeader>
        <CardTitle>Enter School</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          placeholder="School name"
          value={schoolName}
          onChange={e => setSchoolName(e.target.value)}
        />
        <Button onClick={handleContinueSchool}>Continue</Button>
        {/* keep links removed from input card now; nav card handles them */}
        {showLinks && null}
      </CardContent>
    </Card>
  );

  const renderQuiz1 = () => (
    <div ref={quiz1Ref} className="mt-8 flex justify-center">
      <Card className="max-w-lg w-full mx-auto">
        <CardHeader>
          <CardTitle>Photographic Memory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {quiz1.map((q, idx) => (
            <div key={idx} className="space-y-1">
              <label>{q.question}</label>
              {q.option_a && <div className="text-sm pl-4">a. {q.option_a}</div>}
              {q.option_b && <div className="text-sm pl-4">b. {q.option_b}</div>}
              {q.option_c && <div className="text-sm pl-4">c. {q.option_c}</div>}
              {q.option_d && <div className="text-sm pl-4">d. {q.option_d}</div>}
              <Input
                value={answers1[idx] ?? ""}
                onChange={e => {
                  const copy = [...answers1];
                  copy[idx] = e.target.value;
                  setAnswers1(copy);
                }}
              />
            </div>
          ))}
          <Button onClick={handleSubmitQuiz1}>Submit Answers</Button>
        </CardContent>
      </Card>
    </div>
  );

  // clue card removed

  const renderQuiz2 = () => (
    <div ref={quiz2Ref} className="mt-8 flex justify-center">
      <Card className="max-w-lg w-full mx-auto">
        <CardHeader>
          <CardTitle>Listening</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {quiz2.map((q, idx) => (
            <div key={idx} className="space-y-3">
              <label className="font-semibold text-lg">Question {idx + 1}</label>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {q.option_a && (
                  <Button
                    variant={answers2[idx] === "a" ? "default" : "outline"}
                    className="justify-start font-normal h-auto py-2"
                    onClick={() => {
                      const copy = [...answers2];
                      copy[idx] = "a";
                      setAnswers2(copy);
                    }}
                  >
                    A
                  </Button>
                )}
                {q.option_b && (
                  <Button
                    variant={answers2[idx] === "b" ? "default" : "outline"}
                    className="justify-start font-normal h-auto py-2"
                    onClick={() => {
                      const copy = [...answers2];
                      copy[idx] = "b";
                      setAnswers2(copy);
                    }}
                  >
                    B
                  </Button>
                )}
                {q.option_c && (
                  <Button
                    variant={answers2[idx] === "c" ? "default" : "outline"}
                    className="justify-start font-normal h-auto py-2"
                    onClick={() => {
                      const copy = [...answers2];
                      copy[idx] = "c";
                      setAnswers2(copy);
                    }}
                  >
                    C
                  </Button>
                )}
                {q.option_d && (
                  <Button
                    variant={answers2[idx] === "d" ? "default" : "outline"}
                    className="justify-start font-normal h-auto py-2"
                    onClick={() => {
                      const copy = [...answers2];
                      copy[idx] = "d";
                      setAnswers2(copy);
                    }}
                  >
                    D
                  </Button>
                )}
              </div>
            </div>
          ))}
          <Button onClick={handleSubmitQuiz2}>Submit Answers</Button>
        </CardContent>
      </Card>
    </div>
  );

  // done card removed

  const renderNavCard = () => (
    <div ref={navRef} className="mt-8 flex justify-center">
      <Card className="max-w-lg w-full mx-auto">
        <CardHeader>
          <CardTitle>Clever Minds</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {part1 && (
            <p>First part: <strong>{part1}</strong></p>
          )}
          {part2 && (
            <p>Second part: <strong>{part2}</strong></p>
          )}
          {part1 || part2 ? (
            <p>
              Combined: <strong>{(part1 + part2) || "(none)"}</strong>
            </p>
          ) : null}
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-100">
            <li className="ml-4">Discover the password for an important document.</li>
            <li className="ml-4">Complete both Photographic Memory and Listening successfully to earn parts of the password.</li>
            <li className="ml-4">After finishing both quizzes combine the pieces in the correct order to form a meaningful word.</li>
            <li className="ml-4">Enter the resulting password on the password card.</li>
          </ul>
          <div className="button-group">
                    <Button
              size="sm"
              onClick={() => {
                setStep("quiz1");
                setSearchParams({ step: "quiz1", school: schoolName });
                quiz1Ref.current?.scrollIntoView({ behavior: "smooth" });
              }}
            >
                Photographic Memory
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setStep("quiz2");
                setSearchParams({ step: "quiz2", school: schoolName });
                quiz2Ref.current?.scrollIntoView({ behavior: "smooth" });
              }}
            >
                Listening
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="py-8 password-container">
      {!showLinks && renderEnter()}
      {showLinks && renderNavCard()}
      {showLinks && quiz1Enabled && renderQuiz1()}
      {/* clue removed */}
      {showLinks && quiz2Enabled && renderQuiz2()}
      {/* no done card */}
    </div>
  );
}
