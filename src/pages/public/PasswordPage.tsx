import { useState, useRef, useEffect } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getTop3TeamsFromLivescore } from "../dashboard/utils/getTop3Teams";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import "../../Styles/PasswordPage.css";

import { Check, Lock, FileText } from "lucide-react";

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


const FALLBACK_SCHOOL_PASSWORD = "ABCDE";

export default function PasswordPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin } = useAuth();

  const [schoolName, setSchoolName] = useState("");
  const [finalistSchools, setFinalistSchools] = useState<{ id: string; name: string }[]>([]);
  const [step, setStep] = useState<
    "enterSchool" | "quiz1" | "quiz2"
  >("enterSchool");

  const [quiz1Enabled, setQuiz1Enabled] = useState<boolean>(false);
  const [quiz2Enabled, setQuiz2Enabled] = useState<boolean>(false);
  const isCompetitionLocked = !(quiz1Enabled && quiz2Enabled);

  // quiz questions fetched from database
  const [quiz1, setQuiz1] = useState<QuizItem[]>([]);
  const [quiz2, setQuiz2] = useState<QuizItem[]>([]);

  // reveal buttons linking to quizzes after school entered
  const [showLinks, setShowLinks] = useState(false);
  const quiz1Ref = useRef<HTMLDivElement>(null);
  const quiz2Ref = useRef<HTMLDivElement>(null);
  // const clueRef = useRef<HTMLDivElement>(null);  // removed
  // const doneRef = useRef<HTMLDivElement>(null);  // removed

  const [answers1, setAnswers1] = useState<string[]>([]);
  const [answers2, setAnswers2] = useState<string[]>([]);
  const [quiz1MultiSelected, setQuiz1MultiSelected] = useState<boolean[]>([]);

  // reinitialise answer arrays whenever the questions change
  useEffect(() => {
    setAnswers1(Array(quiz1.length).fill(""));

    // for quiz1 special format (12 answers + correct flags), reset multi-select state
    const first = quiz1[0] as any;
    if (first && Array.isArray(first.answers)) {
      setQuiz1MultiSelected(Array(first.answers.length).fill(false));
    } else {
      setQuiz1MultiSelected([]);
    }
  }, [quiz1]);
  useEffect(() => {
    setAnswers2(Array(quiz2.length).fill(""));
  }, [quiz2]);

  const [part1, setPart1] = useState("");
  const [part2, setPart2] = useState("");
  const [activeSchoolId, setActiveSchoolId] = useState<number>(1);
  const [schoolPasswordWord, setSchoolPasswordWord] = useState<string>(FALLBACK_SCHOOL_PASSWORD);

  const [quiz1Started, setQuiz1Started] = useState(false);
  const [quiz2Started, setQuiz2Started] = useState(false);

  const [currentQ1, setCurrentQ1] = useState(0);
  const [currentQ2, setCurrentQ2] = useState(0);
  const [showQuestionPanel1, setShowQuestionPanel1] = useState(false);
  const [showQuestionPanel2, setShowQuestionPanel2] = useState(false);
  const [quiz1Submitted, setQuiz1Submitted] = useState(false);
  const [quiz2Submitted, setQuiz2Submitted] = useState(false);
  const [showDocumentLock, setShowDocumentLock] = useState(false);
  const [documentPasswordInput, setDocumentPasswordInput] = useState("");
  const [documentUnlocked, setDocumentUnlocked] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const documentInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const parseIndexKey = (key: string) => {
    const idx = Number.parseInt(key, 10);
    return Number.isNaN(idx) ? -1 : idx;
  };

  const normalizePasswordWord = (value?: string) => {
    const clean = (value || "").trim().replace(/[^a-zA-Z]/g, "");
    return clean.length === 5 ? clean : FALLBACK_SCHOOL_PASSWORD;
  };

  const shuffleLetters = (letters: string[]) => {
    const copy = [...letters];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const normalizePasswordInput = (value: string) => {
    return value.replace(/[^a-zA-Z]/g, "").slice(0, 5);
  };

  const setDocumentPasswordChar = (idx: number, value: string) => {
    const char = value.replace(/[^a-zA-Z]/g, "").slice(0, 1);
    const chars = Array.from({ length: 5 }, (_, i) => documentPasswordInput[i] || "");
    chars[idx] = char;
    setDocumentPasswordInput(chars.join(""));
    if (documentError) setDocumentError("");
    if (char && idx < 4) {
      documentInputRefs.current[idx + 1]?.focus();
      documentInputRefs.current[idx + 1]?.select();
    }
  };

  // Hide top header while quiz is active (question view)
  useEffect(() => {
    const className = "hide-header";
    if (quiz1Started || quiz2Started) {
      document.body.classList.add(className);
    } else {
      document.body.classList.remove(className);
    }
    return () => {
      document.body.classList.remove(className);
    };
  }, [quiz1Started, quiz2Started]);

  useEffect(() => {
    if (isCompetitionLocked) {
      setQuiz1Started(false);
      setQuiz2Started(false);
    }
  }, [isCompetitionLocked]);

  // load status on mount
  // read step/school/question from query string on mount or when location changes
  useEffect(() => {
    const stepParam = (searchParams.get("step") as "enterSchool" | "quiz1" | "quiz2") || "enterSchool";
    const schoolParam = searchParams.get("school") || "";
    const qParam = parseInt(searchParams.get("q") || "0", 10);
    const startedParam = searchParams.get("started") === "1";

    if (schoolParam) {
      setSchoolName(schoolParam);
    }

    setStep(stepParam);
    setShowLinks(stepParam !== "enterSchool");

    // Keep the correct quiz state when reloading (so users land back on the question view)
    setQuiz1Started(stepParam === "quiz1" && startedParam);
    setQuiz2Started(stepParam === "quiz2" && startedParam);

    if (stepParam === "quiz1") {
      setCurrentQ1(isNaN(qParam) ? 0 : Math.max(0, Math.min(qParam, quiz1.length - 1)));
    }
    if (stepParam === "quiz2") {
      setCurrentQ2(isNaN(qParam) ? 0 : Math.max(0, Math.min(qParam, quiz2.length - 1)));
    }
  }, [location.search, quiz1.length, quiz2.length]);

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

  // keep the URL in sync with the current question so refresh preserves it
  useEffect(() => {
    if (step === "quiz1") {
      setSearchParams({
        step: "quiz1",
        school: schoolName,
        q: String(currentQ1),
        started: quiz1Started ? "1" : "0",
      });
    }
  }, [step, schoolName, currentQ1, quiz1Started, setSearchParams]);

  useEffect(() => {
    if (step === "quiz2") {
      setSearchParams({
        step: "quiz2",
        school: schoolName,
        q: String(currentQ2),
        started: quiz2Started ? "1" : "0",
      });
    }
  }, [step, schoolName, currentQ2, quiz2Started, setSearchParams]);

  useEffect(() => {
    const load = async () => {
      // load status flags
      const { data } = await (supabase as any)
        .from("quiz_status")
        .select("quiz1_enabled, quiz2_enabled, active_school_id")
        .eq("id", "1")
        .single();
      let activeSchoolId = 1;
      if (data) {
        setQuiz1Enabled(data.quiz1_enabled);
        setQuiz2Enabled(data.quiz2_enabled);
        activeSchoolId = data.active_school_id || 1;
        setActiveSchoolId(activeSchoolId);
      }

      // fetch top 3 schools using livescore logic

      try {
        let top3 = await getTop3TeamsFromLivescore();
        // Shuffle the array
        for (let i = top3.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [top3[i], top3[j]] = [top3[j], top3[i]];
        }
        setFinalistSchools(top3);
      } catch (err) {
        console.error("Error fetching top 3 teams from livescore:", err);
        setFinalistSchools([]);
      }

      // fetch the questions for both quizzes filtered by active_school_id
      const { data: q1 } = await (supabase as any)
        .from("quiz_questions")
        .select("qa")
        .eq("quiz_name", "quiz1")
        .eq("school_id", activeSchoolId)
        .order("id", { ascending: true });
      if (q1) setQuiz1(q1.map((r: any) => r.qa));

      const { data: q2 } = await (supabase as any)
        .from("quiz_questions")
        .select("qa")
        .eq("quiz_name", "quiz2")
        .eq("school_id", activeSchoolId)
        .order("id", { ascending: true });
      if (q2) setQuiz2(q2.map((r: any) => r.qa));

      const { data: schoolPasswordRow } = await (supabase as any)
        .from("school_quiz_passwords")
        .select("password_word")
        .eq("school_id", activeSchoolId)
        .maybeSingle();
      setSchoolPasswordWord(normalizePasswordWord(schoolPasswordRow?.password_word));
    };
    load();
  }, []);

  useEffect(() => {
    const normalizedSchoolName = schoolName.trim();
    if (!normalizedSchoolName) return;

    const restoreProgress = async () => {
      const { data, error } = await (supabase as any)
        .from("school_quiz_progress")
        .select("quiz1_answers, quiz2_answers, quiz1_submitted, quiz2_submitted, letters_given")
        .eq("school_name", normalizedSchoolName)
        .maybeSingle();

      if (error) {
        console.error("Failed to load quiz progress:", error);
        return;
      }
      if (!data) return;

      setQuiz1Submitted(Boolean(data.quiz1_submitted));
      setQuiz2Submitted(Boolean(data.quiz2_submitted));

      const lettersGiven = (data.letters_given || {}) as { quiz1?: string[]; quiz2?: string[] };
      const restoredQuiz1Letters = Array.isArray(lettersGiven.quiz1) ? lettersGiven.quiz1 : [];
      const restoredQuiz2Letters = Array.isArray(lettersGiven.quiz2) ? lettersGiven.quiz2 : [];
      setPart1(restoredQuiz1Letters.join(" "));
      setPart2(restoredQuiz2Letters.join(" "));

      const rawQuiz1Answers = (data.quiz1_answers || {}) as Record<string, string | boolean | null>;
      const rawQuiz2Answers = (data.quiz2_answers || {}) as Record<string, string | null>;

      const firstQuiz1Item = quiz1[0] as any;
      if (firstQuiz1Item && Array.isArray(firstQuiz1Item.answers)) {
        const restoredMulti = Array(firstQuiz1Item.answers.length).fill(false) as boolean[];
        Object.entries(rawQuiz1Answers).forEach(([k, v]) => {
          const idx = parseIndexKey(k);
          if (idx >= 0 && idx < restoredMulti.length) {
            restoredMulti[idx] = Boolean(v);
          }
        });
        setQuiz1MultiSelected(restoredMulti);
      } else {
        const restoredQuiz1 = Array(quiz1.length).fill("") as string[];
        Object.entries(rawQuiz1Answers).forEach(([k, v]) => {
          const idx = parseIndexKey(k);
          if (idx >= 0 && idx < restoredQuiz1.length && typeof v === "string") {
            restoredQuiz1[idx] = v;
          }
        });
        setAnswers1(restoredQuiz1);
      }

      const restoredQuiz2 = Array(quiz2.length).fill("") as string[];
      Object.entries(rawQuiz2Answers).forEach(([k, v]) => {
        const idx = parseIndexKey(k);
        if (idx >= 0 && idx < restoredQuiz2.length && typeof v === "string") {
          restoredQuiz2[idx] = v;
        }
      });
      setAnswers2(restoredQuiz2);
    };

    restoreProgress();
  }, [schoolName, quiz1, quiz2]);

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

  // Persist progress (answers + score) for a school name
  const upsertQuizProgress = async (payload: {
    school_name: string;
    quiz1_answers?: Record<string, string | boolean> | null;
    quiz1_score?: number | null;
    quiz2_answers?: Record<string, string> | null;
    quiz2_score?: number | null;
    quiz1_submitted?: boolean;
    quiz2_submitted?: boolean;
    letters_given?: { quiz1?: string[]; quiz2?: string[] };
    document_marks?: number | null;
  }) => {
    try {
      const row: Record<string, any> = {
        school_name: payload.school_name,
        updated_at: new Date().toISOString(),
      };
      if (payload.quiz1_answers !== undefined) row.quiz1_answers = payload.quiz1_answers;
      if (payload.quiz1_score !== undefined) row.quiz1_score = payload.quiz1_score;
      if (payload.quiz2_answers !== undefined) row.quiz2_answers = payload.quiz2_answers;
      if (payload.quiz2_score !== undefined) row.quiz2_score = payload.quiz2_score;
      if (payload.quiz1_submitted !== undefined) row.quiz1_submitted = payload.quiz1_submitted;
      if (payload.quiz2_submitted !== undefined) row.quiz2_submitted = payload.quiz2_submitted;
      if (payload.letters_given !== undefined) row.letters_given = payload.letters_given;
      if (payload.document_marks !== undefined) row.document_marks = payload.document_marks;

      const { data, error } = await (supabase as any)
        .from("school_quiz_progress")
        .upsert(row)
        .select();
      
      if (error) {
        console.error("Failed to save quiz progress - Supabase error:", error);
        return false;
      }
      
      console.log("Quiz progress saved successfully:", data);
      return true;
    } catch (err) {
      console.error("Failed to save quiz progress - Exception:", err);
      return false;
    }
  };

  // Award document marks: 50 if document unlocked and marked correctly, else 0
  const awardDocumentMarks = async (schoolName: string, unlocked: boolean, markedCorrectly: boolean) => {
    const marks = unlocked && markedCorrectly ? 50 : 0;
    await upsertQuizProgress({ school_name: schoolName, document_marks: marks });
  };

  const handleContinueSchool = async () => {
    const normalizedSchoolName = schoolName.trim();
    if (!normalizedSchoolName) return;
    setSchoolName(normalizedSchoolName);
    setShowDocumentLock(false);
    setDocumentPasswordInput("");
    setDocumentUnlocked(false);
    setDocumentError("");
    setShowLinks(true);
    // once school entered we no longer need the input card
    setStep("quiz1");
    // update url so reload stays on quiz1
    setSearchParams({ step: "quiz1", school: normalizedSchoolName, q: "0" });

    // Persist the school entry and initialize progress row
    const saved = await upsertQuizProgress({ school_name: normalizedSchoolName });
    if (!saved) {
      console.warn("School progress row was not saved. Check Supabase schema/policies.");
    }
    // Award document marks when document is unlocked and marked correctly
    if (documentUnlocked) {
      await awardDocumentMarks(normalizedSchoolName, documentUnlocked, true);
    } else {
      await awardDocumentMarks(normalizedSchoolName, false, false);
    }

    // scroll to quiz1
    setTimeout(() => quiz1Ref.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleSubmitQuiz1 = () => {
    if (quiz1Submitted) return;
    if (!quiz1?.length) return;

    const first = quiz1[0] as any;
    const isMultiFormat = first && Array.isArray(first.answers);

    const quiz1LettersPool = schoolPasswordWord.slice(0, 3).split("");

    if (isMultiFormat) {
      // Ensure at least one answer is selected
      if (!quiz1MultiSelected.some(Boolean)) return;

      // Calculate correct selections (only count correctly selected answers)
      const correctArray: boolean[] = Array.isArray(first.correct) ? first.correct : [];
      let correct = 0;
      correctArray.forEach((isCorrect, idx) => {
        if (isCorrect && quiz1MultiSelected[idx]) correct++;
      });

      const awardedCount = Math.max(0, Math.min(correct, quiz1LettersPool.length));
      const awardedLetters = shuffleLetters(quiz1LettersPool).slice(0, awardedCount);
      setPart1(awardedLetters.join(" "));

      // Persist progress for Quiz 1 (multi-select): store selected flags and score
      const q1Answers: Record<string, boolean> = {};
      quiz1MultiSelected.forEach((v, idx) => {
        q1Answers[String(idx)] = v;
      });
      upsertQuizProgress({
        school_name: schoolName,
        quiz1_answers: q1Answers as any,
        quiz1_score: correct * 10,
        quiz1_submitted: true,
        letters_given: {
          quiz1: awardedLetters,
          quiz2: part2 ? part2.split(" ").filter(Boolean) : [],
        },
      });
      setQuiz1Submitted(true);

      setQuiz1Started(false);
      setCurrentQ1(0);
      setStep("quiz2");
      setSearchParams({ step: "quiz2", school: schoolName, q: "0" });
      setTimeout(() => quiz2Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      return;
    }

    // Prevent advancing without selecting an answer
    const currentAnswer = (answers1[currentQ1] || "").trim().toLowerCase();
    if (!currentAnswer) return;

    // If there are more questions, move to the next question
    if (currentQ1 < quiz1.length - 1) {
      const nextQ = currentQ1 + 1;
      setCurrentQ1(nextQ);
      setSearchParams({ step: "quiz1", school: schoolName, q: String(nextQ), started: "1" });
      return;
    }

    // Final question: compute the score for the entire quiz
    let correct = 0;
    quiz1.forEach((q, idx) => {
      let expected = (q.answer || "").toString().trim().toLowerCase();
      if (expected === "1" || expected === "option_a" || expected === q.option_a?.toLowerCase()) expected = "a";
      if (expected === "2" || expected === "option_b" || expected === q.option_b?.toLowerCase()) expected = "b";
      if (expected === "3" || expected === "option_c" || expected === q.option_c?.toLowerCase()) expected = "c";
      if (expected === "4" || expected === "option_d" || expected === q.option_d?.toLowerCase()) expected = "d";

      if ((answers1[idx] || "").trim().toLowerCase() === expected) {
        correct++;
      }
    });

    const awardedCount = Math.max(0, Math.min(correct, quiz1LettersPool.length));
    const awardedLetters = shuffleLetters(quiz1LettersPool).slice(0, awardedCount);
    setPart1(awardedLetters.join(" "));

    // Persist progress for Quiz 1 (single-answer): store selected answers + score
    const quiz1Answers: Record<string, string> = {};
    answers1.forEach((val, idx) => {
      if (val) quiz1Answers[String(idx)] = val;
    });
    upsertQuizProgress({
      school_name: schoolName,
      quiz1_answers: quiz1Answers,
      quiz1_score: correct * 10,
      quiz1_submitted: true,
      letters_given: {
        quiz1: awardedLetters,
        quiz2: part2 ? part2.split(" ").filter(Boolean) : [],
      },
    });
    setQuiz1Submitted(true);

    // advance to quiz2 and reset state
    setQuiz1Started(false);
    setCurrentQ1(0);
    setStep("quiz2");
    setSearchParams({ step: "quiz2", school: schoolName });
    setTimeout(() => quiz2Ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  };

  // removed clue navigation

  const handleSubmitQuiz2 = () => {
      const quiz2LettersPool = schoolPasswordWord.slice(3, 5).split("");

    if (quiz2Submitted) return;
    if (!quiz2?.length) return;

    const currentAnswer = (answers2[currentQ2] || "").trim().toLowerCase();
    if (!currentAnswer) return;

    // move to next question if available
    if (currentQ2 < quiz2.length - 1) {
      const nextQ = currentQ2 + 1;
      setCurrentQ2(nextQ);
      setSearchParams({ step: "quiz2", school: schoolName, q: String(nextQ), started: "1" });
      return;
    }

    // calculate final score for quiz2
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
    const awardedCount = Math.max(0, Math.min(correct, quiz2LettersPool.length));
    const awardedLetters = shuffleLetters(quiz2LettersPool).slice(0, awardedCount);
    setPart2(awardedLetters.join(" "));

    // Persist progress for Quiz 2: store answers + score
    const quiz2Answers: Record<string, string> = {};
    answers2.forEach((val, idx) => {
      if (val) quiz2Answers[String(idx)] = val;
    });
    upsertQuizProgress({
      school_name: schoolName,
      quiz2_answers: quiz2Answers,
      quiz2_score: correct * 10,
      quiz2_submitted: true,
      letters_given: {
        quiz1: part1 ? part1.split(" ").filter(Boolean) : [],
        quiz2: awardedLetters,
      },
    });
    setQuiz2Submitted(true);

    // reset started state so other cards come back into view
    setQuiz2Started(false);
    setCurrentQ2(0);

    // no done card; remain on quiz2
  };

  const renderEnter = () => (
    <div className="flex justify-center">
      <Card className="w-full max-w-md bg-[#0B1120]/95 text-white border border-blue-900/30 shadow-2xl rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-3xl font-extrabold tracking-tight">Select School</CardTitle>
          <p className="text-sm text-white/70">Choose your school from the finalists to begin the challenge rounds.</p>
        </CardHeader>
        <CardContent className="space-y-5 pt-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white/80">School</label>
            <select
              value={schoolName}
              onChange={e => setSchoolName(e.target.value)}
              className="h-12 text-base bg-black/40 border-blue-900/40 focus-visible:ring-blue-500 w-full rounded-md"
            >
              <option value="">Select a school</option>
              {finalistSchools.map(school => (
                <option key={school.id} value={school.name}>{school.name}</option>
              ))}
            </select>
          </div>
          <Button
            onClick={handleContinueSchool}
            className="h-12 px-8 text-lg font-semibold bg-blue-500 hover:bg-blue-600 text-white"
            disabled={!schoolName}
          >
            Continue
          </Button>
          {showLinks && null}
        </CardContent>
      </Card>
    </div>
  );

  const renderQuiz1 = () => {
    const question = quiz1[currentQ1];
    const isLast = currentQ1 === quiz1.length - 1;
    const isMulti = question && Array.isArray((question as any).answers);
    const questionAnswers: string[] =
      question && Array.isArray((question as any).answers)
        ? (question as any).answers
        : [];

    return (
      <div ref={quiz1Ref} className="mt-8 flex justify-center">
        <Card className="max-w-2xl w-full mx-auto bg-[#0B1120] text-white border-muted/30 shadow-xl">
          <CardHeader>
            <div className="flex flex-col gap-3">
              <CardTitle className="text-2xl text-center md:text-left pb-4 md:pb-0 border-b border-muted/20 md:border-b-0">
                Photographic Memory
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            {!quiz1Started ? (
              <div className="flex flex-col items-center justify-center space-y-5 text-center pt-2 pb-6">
                <ul className="space-y-2 text-base font-medium text-gray-100 text-left max-w-xl" onCopy={(e) => e.preventDefault()}>
                  <li className="flex gap-2">
                    <span className="font-bold">•</span>
                    <span>
                      You need to find the missing items that are in the first image but not in the second image.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold">•</span>
                    <span>
                      If you identify the missing items correctly according to the correct answer, you will get the letters that are in the password.
                    </span>
                  </li>
                </ul>
                <Button 
                  onClick={() => {
                    if (isCompetitionLocked) return;
                    if (quiz1Submitted) return;
                    setQuiz1Started(true);
                    setCurrentQ1(0);
                    setShowQuestionPanel1(false);
                    setSearchParams({ step: "quiz1", school: schoolName, q: "0", started: "1" });
                  }}
                  disabled={quiz1Submitted || isCompetitionLocked}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-2 rounded-md font-semibold"
                >
                  {quiz1Submitted ? "Already Submitted" : "Start Round"}
                </Button>
                {isCompetitionLocked && (
                  <p className="text-sm text-amber-300">Quiz is currently disabled by admin.</p>
                )}
                {quiz1Submitted && (
                  <div className="space-y-2">
                    <p className="text-sm text-white/80">
                      Letters earned here: <span className="font-semibold tracking-widest text-white">{part1 || "-"}</span>
                    </p>
                  </div>
                )}
              </div>
            ) : quiz1.length === 0 ? (
              <div className="text-center text-white/70 py-12">Loading questions...</div>
            ) : isMulti ? (
              <div className="space-y-4 select-none" onCopy={(e) => e.preventDefault()}>
                <div className="space-y-2">
                  <p className="text-sm text-white/70">
                    Select all the items that are missing in the second image. Each correct selection earns letters for the password.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {questionAnswers.map((ans, idx) => {
                      const selected = quiz1MultiSelected[idx];
                      const correctCount = Array.isArray((question as any).correct)
                        ? ((question as any).correct as boolean[]).filter(Boolean).length
                        : 0;
                      const selectedCount = quiz1MultiSelected.filter(Boolean).length;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (isCompetitionLocked) return;
                            // prevent selecting more than the number of correct answers
                            if (!selected && correctCount > 0 && selectedCount >= correctCount) return;
                            const next = [...quiz1MultiSelected];
                            next[idx] = !next[idx];
                            setQuiz1MultiSelected(next);
                          }}
                          className={`w-full p-3 rounded-xl text-left flex items-center justify-between transition ${
                            selected
                              ? "bg-green-950/40 border border-green-900/50"
                              : "bg-teal-950/20 border border-transparent hover:bg-teal-900/30"
                          }`}
                        >
                          <span className={`text-sm font-medium ${selected ? "text-white" : "text-white/90"}`}>
                            {ans}
                          </span>
                          {selected && (
                            <span className="text-green-500 text-sm font-bold flex items-center gap-1">
                              <Check className="w-4 h-4" strokeWidth={3} /> Selected
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => {
                      if (isCompetitionLocked) return;
                      setQuiz1MultiSelected(Array(questionAnswers.length).fill(false));
                    }}
                    variant="outline"
                    disabled={isCompetitionLocked}
                    className="w-full sm:w-auto py-4 text-lg border-white/20 text-white"
                  >
                    Clear
                  </Button>
                  <Button
                    onClick={handleSubmitQuiz1}
                    disabled={isCompetitionLocked}
                    className="w-full sm:w-auto py-4 text-lg bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                  >
                    Submit Answers
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {showQuestionPanel1 && (
                  <div className="grid grid-cols-5 gap-2">
                    {quiz1.map((_, idx) => (
                      <div
                        key={idx}
                        className={`text-xs font-semibold rounded-lg px-2 py-2 text-center border ${
                          idx === currentQ1
                            ? "bg-blue-500 text-white border-blue-500"
                            : "bg-white/10 text-white/70 border-white/10"
                        }`}
                      >
                        {idx + 1}
                      </div>
                    ))}
                  </div>
                )}

                {question ? (
                  <div className="space-y-4 select-none" onCopy={(e) => e.preventDefault()}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/70">Question {currentQ1 + 1} of {quiz1.length}</span>
                    </div>

                    <div>
                      <div className="font-medium text-lg lg:text-xl text-white mb-2">
                        {question.question}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                          { key: "a", label: "A", text: question.option_a },
                          { key: "b", label: "B", text: question.option_b },
                          { key: "c", label: "C", text: question.option_c },
                          { key: "d", label: "D", text: question.option_d },
                        ].map((opt) => {
                          if (!opt.text) return null;
                          const isSelected = answers1[currentQ1] === opt.key;
                          return (
                            <div
                              key={opt.key}
                              onClick={() => {
                                if (isCompetitionLocked) return;
                                const copy = [...answers1];
                                copy[currentQ1] = opt.key;
                                setAnswers1(copy);
                                setSearchParams({ step: "quiz1", school: schoolName, q: String(currentQ1), started: "1" });

                                // persist progress for Quiz 1 answers as JSON
                                const quiz1Answers: Record<string, string> = {};
                                copy.forEach((val, idx) => {
                                  if (val) quiz1Answers[String(idx)] = val;
                                });
                                upsertQuizProgress({
                                  school_name: schoolName,
                                  quiz1_answers: quiz1Answers,
                                });
                              }}
                              className={`p-3 sm:p-4 rounded-xl flex justify-between items-center cursor-pointer transition-all duration-200 ${
                                isSelected
                                  ? "bg-green-950/40 border border-green-900/50 shadow-[0_0_15px_rgba(20,83,45,0.2)]"
                                  : "bg-teal-950/20 border border-transparent hover:bg-teal-900/30"
                              } ${isCompetitionLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                            >
                              <div className="flex items-center gap-4">
                                <span
                                  className={`flex justify-center items-center w-8 h-8 rounded-lg font-bold transition-colors ${
                                    isSelected
                                      ? "bg-teal-700 text-white"
                                      : "bg-teal-900/40 text-teal-300"
                                  }`}
                                >
                                  {opt.label}
                                </span>
                                <span className={`text-[15px] font-medium ${isSelected ? "text-white" : "text-white/90"}`}>
                                  {opt.text}
                                </span>
                              </div>
                              {isSelected && (
                                <span className="text-green-500 text-sm font-bold flex items-center gap-1 pr-2">
                                  <Check className="w-4 h-4" strokeWidth={3} /> Selected
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="pt-4 flex flex-col sm:flex-row gap-3">
                      {currentQ1 > 0 && (
                        <Button
                          variant="outline"
                          onClick={() => setCurrentQ1(currentQ1 - 1)}
                          disabled={isCompetitionLocked}
                          className="w-full sm:w-auto py-4 text-lg border-white/20 text-white"
                        >
                          Back
                        </Button>
                      )}
                      <Button
                        onClick={handleSubmitQuiz1}
                        disabled={isCompetitionLocked}
                        className="w-full sm:w-auto py-4 text-lg bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                      >
                        {isLast ? "Submit Answers" : "Next"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // clue card removed

  const renderQuiz2 = () => {
    const question = quiz2[currentQ2];
    const isLast = currentQ2 === quiz2.length - 1;

    return (
      <div ref={quiz2Ref} className="mt-8 flex justify-center">
        <Card className="max-w-2xl w-full mx-auto bg-[#0B1120] text-white border-muted/30">
          <CardHeader>
            <div className="flex flex-col gap-3">
              <CardTitle className="text-2xl text-center md:text-left pb-4 md:pb-0 border-b border-muted/20 md:border-b-0">
                Listening
              </CardTitle>
              {quiz2Started && quiz2.length > 0 && (
                <div className="w-full">
                  <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                    <span>
                      Question {currentQ2 + 1} of {quiz2.length}
                    </span>
                    <span>
                      {Math.round(((currentQ2 + 1) / quiz2.length) * 100)}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${((currentQ2 + 1) / quiz2.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            {!quiz2Started ? (
              <div className="flex flex-col items-center justify-center space-y-5 text-center pt-2 pb-6">
                <ul className="space-y-2 text-base font-medium text-gray-100 text-left max-w-xl" onCopy={(e) => e.preventDefault()}>
                  <li className="flex gap-2">
                    <span className="font-bold">•</span>
                    <span>
                      You should listen to the playing audio carefully, then answer the questions using the given choices.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold">•</span>
                    <span>
                      Select the correct choice (A/B/C/D) based on what you heard; if you answer correctly, you will get the letters that are in the password.
                    </span>
                  </li>
                </ul>
                <Button 
                  onClick={() => {
                    if (isCompetitionLocked) return;
                    if (quiz2Submitted) return;
                    setQuiz2Started(true);
                    setCurrentQ2(0);
                    setShowQuestionPanel2(false);
                    setSearchParams({ step: "quiz2", school: schoolName, q: "0", started: "1" });
                  }}
                  disabled={quiz2Submitted || isCompetitionLocked}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-2 rounded-md font-semibold"
                >
                  {quiz2Submitted ? "Already Submitted" : "Start Quiz"}
                </Button>
                {isCompetitionLocked && (
                  <p className="text-sm text-amber-300">Quiz is currently disabled by admin.</p>
                )}
                {quiz2Submitted && (
                  <div className="space-y-2">
                    <p className="text-sm text-white/80">
                      Letters earned here: <span className="font-semibold tracking-widest text-white">{part2 || "-"}</span>
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
                {showQuestionPanel2 && (
                  <div className="grid grid-cols-5 gap-2">
                    {quiz2.map((_, idx) => (
                      <div
                        key={idx}
                        className={`text-xs font-semibold rounded-lg px-2 py-2 text-center border ${
                          idx === currentQ2
                            ? "bg-blue-500 text-white border-blue-500"
                            : "bg-white/10 text-white/70 border-white/10"
                        }`}
                      >
                        {idx + 1}
                      </div>
                    ))}
                  </div>
                )}

                {question ? (
                  <div className="space-y-4 select-none" onCopy={(e) => e.preventDefault()}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/70">Question {currentQ2 + 1}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { key: "a", label: "A" },
                        { key: "b", label: "B" },
                        { key: "c", label: "C" },
                        { key: "d", label: "D" },
                      ].map((opt) => {
                          if (!question[`option_${opt.key}`]) return null;
                          const isSelected = answers2[currentQ2] === opt.key;
                          return (
                            <div
                              key={opt.key}
                              onClick={() => {
                                if (isCompetitionLocked) return;
                                const copy = [...answers2];
                                copy[currentQ2] = opt.key;
                                setAnswers2(copy);
                                setSearchParams({ step: "quiz2", school: schoolName, q: String(currentQ2), started: "1" });

                                // persist progress for Quiz 2 answers as JSON
                                const quiz2Answers: Record<string, string> = {};
                                copy.forEach((val, idx) => {
                                  if (val) quiz2Answers[String(idx)] = val;
                                });
                                upsertQuizProgress({
                                  school_name: schoolName,
                                  quiz2_answers: quiz2Answers,
                                });
                              }}
                              className={`p-3 sm:p-4 rounded-xl flex justify-between items-center cursor-pointer transition-all duration-200 ${
                                isSelected
                                  ? "bg-green-950/40 border border-green-900/50 shadow-[0_0_15px_rgba(20,83,45,0.2)]"
                                  : "bg-teal-950/20 border border-transparent hover:bg-teal-900/30"
                              } ${isCompetitionLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                            >
                              <div className="flex items-center gap-4">
                                <span
                                  className={`flex justify-center items-center w-8 h-8 rounded-lg font-bold transition-colors ${
                                    isSelected
                                      ? "bg-teal-700 text-white"
                                      : "bg-teal-900/40 text-teal-300"
                                  }`}
                                >
                                  {opt.label}
                                </span>
                              </div>
                              {isSelected && (
                                <span className="text-green-500 text-sm font-bold flex items-center gap-1 pr-2">
                                  <Check className="w-4 h-4" strokeWidth={3} /> Selected
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                    <div className="pt-4 flex flex-col sm:flex-row gap-3">
                      {currentQ2 > 0 && (
                        <Button
                          variant="outline"
                          onClick={() => {
                            if (isCompetitionLocked) return;
                            const prev = Math.max(0, currentQ2 - 1);
                            setCurrentQ2(prev);
                            setSearchParams({ step: "quiz2", school: schoolName, q: String(prev) });
                          }}
                          disabled={isCompetitionLocked}
                          className="w-full sm:w-auto py-4 text-lg border-white/20 text-white"
                        >
                          Back
                        </Button>
                      )}
                      <Button
                        onClick={handleSubmitQuiz2}
                        disabled={isCompetitionLocked}
                        className="w-full sm:w-auto py-4 text-lg bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                      >
                        {isLast ? "Submit Answers" : "Next"}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  // done card removed

  const renderPasswordSolver = () => (
    <div className="mt-8 flex justify-center">
      <Card className="max-w-2xl w-full mx-auto bg-[#0B1120] text-white border-muted/30">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Password Solver</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="space-y-3 text-sm text-gray-200">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-white flex-shrink-0" />
              <span>
                You need to find out the password to open this locked document. The password is a meaningful word.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-white flex-shrink-0" />
              <span>
                After finishing Photographic Memory and Listening, you will get some letters. Rearrange those letters to form the correct password.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-white flex-shrink-0" />
              <span>
                Enter the correct password to open the document.
              </span>
            </li>
          </ul>

          {!showDocumentLock ? (
            <div className="flex justify-center">
              <Button
                className="bg-blue-500 hover:bg-blue-600 text-white"
                disabled={isCompetitionLocked}
                onClick={() => {
                  setShowDocumentLock(true);
                  setDocumentError("");
                }}
              >
                Open Document
              </Button>
            </div>
          ) : (
            <div className="space-y-4 rounded-xl border border-white/20 bg-white/5 p-4">
              {!documentUnlocked ? (
                <>
                  <div className="flex items-center gap-2 text-white">
                    <Lock className="w-5 h-5" />
                    <span className="font-semibold">Document Locked</span>
                  </div>
                  <p className="text-sm text-white/80">
                    Enter the 5-letter password to unlock this document.
                  </p>
                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 5 }).map((_, idx) => {
                      const char = documentPasswordInput[idx] || "";
                      return (
                        <Input
                          key={idx}
                          ref={(el) => {
                            documentInputRefs.current[idx] = el;
                          }}
                          value={char}
                          onChange={(e) => setDocumentPasswordChar(idx, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace" && !char && idx > 0) {
                              documentInputRefs.current[idx - 1]?.focus();
                              documentInputRefs.current[idx - 1]?.select();
                            }
                          }}
                          onPaste={(e) => {
                            e.preventDefault();
                            const pasted = normalizePasswordInput(e.clipboardData.getData("text"));
                            if (!pasted) return;
                            const chars = Array.from({ length: 5 }, (_, i) => documentPasswordInput[i] || "");
                            for (let i = idx; i < 5 && i - idx < pasted.length; i++) {
                              chars[i] = pasted[i - idx];
                            }
                            setDocumentPasswordInput(chars.join(""));
                            if (documentError) setDocumentError("");
                          }}
                          maxLength={1}
                          className="h-11 bg-white/10 border-white/30 text-center text-lg font-bold"
                        />
                      );
                    })}
                  </div>
                  {documentError ? <p className="text-sm document-error-text">{documentError}</p> : null}
                  <div className="flex justify-center">
                    <Button
                      className="bg-blue-500 hover:bg-blue-600 text-white"
                      disabled={isCompetitionLocked}
                      onClick={() => {
                        const attempt = normalizePasswordInput(documentPasswordInput);
                        if (attempt.length !== 5) {
                          setDocumentError("Password must be exactly 5 letters.");
                          return;
                        }
                        if (attempt !== normalizePasswordWord(schoolPasswordWord)) {
                          setDocumentError("Incorrect password. Try again");
                          return;
                        }
                        setDocumentUnlocked(true);
                        setDocumentError("");
                        // Award document marks immediately when unlocked
                        awardDocumentMarks(schoolName, true, true);
                      }}
                    >
                      Unlock Document
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-300 font-semibold">
                    <FileText className="w-5 h-5" />
                    <span>Document Unlocked</span>
                  </div>
                  <div className="rounded-lg border border-green-800/40 bg-black/20 p-4 text-sm text-gray-100 whitespace-pre-line">
{`Competition Document\n\nCongratulations! You unlocked the document.\n\nSchool: ${schoolName || "Unknown"}\nSet ID: ${activeSchoolId}\n\nKeep this document visible for the invigilator review.`}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className={`py-8 password-container flex flex-col justify-center ${(quiz1Started || quiz2Started) ? 'min-h-[90vh]' : ''}`}>
      {!showLinks && renderEnter()}
      {showLinks && !quiz2Started && renderQuiz1()}
      {/* clue removed */}
      {showLinks && !quiz1Started && renderQuiz2()}
      {showLinks && !quiz1Started && !quiz2Started && renderPasswordSolver()}
      {/* no done card */}
    </div>
  );
}
