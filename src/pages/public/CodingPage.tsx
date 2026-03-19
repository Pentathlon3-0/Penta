import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Maximize2, Minimize2 } from "lucide-react";

interface QuestionRow {
  id: number;
  title: string;
  description: string | null;
  html_content: string;
  blanks_count: number;
  timer_seconds: number;
}

interface BlankRow {
  blank_id: string;
  correct_answer: string;
  position: number;
}

export default function CodingPage() {
  const { schoolName: urlSchoolName } = useParams<{ schoolName: string }>();
  const navigate = useNavigate();
  const [schoolNameInput, setSchoolNameInput] = useState("");
  const [schoolOptions, setSchoolOptions] = useState<string[]>([]);

  // question data from DB
  const [question, setQuestion] = useState<QuestionRow | null>(null);
  const [blanks, setBlanks] = useState<BlankRow[]>([]);
  const [blankValues, setBlankValues] = useState<Record<string, string>>({});
  const [loadingQ, setLoadingQ] = useState(true);

  const [checked, setChecked] = useState(false);
  const [checkAttempts, setCheckAttempts] = useState(0);
  const [percentage, setPercentage] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const [timeLeft, setTimeLeft] = useState(600);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmitRef = useRef(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const schoolName = urlSchoolName ? decodeURIComponent(urlSchoolName) : "";
  const step = submitted ? "done" : urlSchoolName ? "code" : "enter";

  // Fetch available school list (top4 qualifiers) and question + blanks
  useEffect(() => {
    // Fetch top 5 schools from livescore table by sum of round1_final and round2_final
    (async () => {
      const { data: livescoreRows } = await (supabase as any)
        .from("livescore")
        .select("school_id, round1_final, round2_final");
      if (livescoreRows && livescoreRows.length > 0) {
        // Compute sum and sort
        const scored = livescoreRows.map((row: any) => ({
          school_id: row.school_id,
          total: (row.round1_final || 0) + (row.round2_final || 0)
        }));
        scored.sort((a, b) => b.total - a.total);
        const top5 = scored.slice(0, 5);
        const ids = top5.map(s => s.school_id);
        if (ids.length) {
          const { data: teams } = await supabase
            .from("teams")
            .select("id, name")
            .in("id", ids);
          // Map team names in the same order as top5
          const idToName = new Map((teams || []).map((t: any) => [t.id, t.name]));
          setSchoolOptions(ids.map(id => idToName.get(id)).filter(Boolean));
        }
      }
    })();

    if (!urlSchoolName) return;
    const fetchQuestion = async () => {
      setLoadingQ(true);
      const db: any = supabase;
      const { data: qData } = await db
        .from("questions")
        .select("id, title, description, html_content, blanks_count, timer_seconds")
        .order("id", { ascending: true })
        .limit(1)
        .single();

      if (!qData) {
        toast.error("No question found in database");
        setLoadingQ(false);
        return;
      }
      setQuestion(qData);
      setTimeLeft(qData.timer_seconds || 600);

      // Check if this school already submitted and is not re-enabled
      const { data: existingSub } = await supabase
        .from("coding_submissions")
        .select("submitted, enabled, percentage, check_attempts")
        .eq("school_name", decodeURIComponent(urlSchoolName!))
        .maybeSingle();

      if (existingSub && existingSub.submitted && !existingSub.enabled) {
        setPercentage(existingSub.percentage ?? 0);
        setCheckAttempts(existingSub.check_attempts ?? 0);
        setSubmitted(true);
        setLoadingQ(false);
        return;
      }

      const { data: bData } = await db
        .from("question_blanks")
        .select("blank_id, correct_answer, position")
        .eq("question_id", qData.id)
        .order("position", { ascending: true });

      setBlanks(bData ?? []);
      // initialise blank values — restore from localStorage if available
      const storageKey = `coding_blanks_${schoolName}`;
      const saved = localStorage.getItem(storageKey);
      const restored: Record<string, string> = saved ? JSON.parse(saved) : {};
      const init: Record<string, string> = {};
      (bData ?? []).forEach((b: BlankRow) => { init[b.blank_id] = restored[b.blank_id] || ""; });
      setBlankValues(init);
      setLoadingQ(false);
    };
    fetchQuestion();
  }, [urlSchoolName]);

  // Build user HTML by replacing blanks with user values
  const wrapWithDarkStyle = (html: string) =>
    `<style>html,body{background:#0f172a;color:#ffffff;font-family:Inter,sans-serif;margin:0;padding:8px;}*{color:#ffffff;}</style>${html}`;

  const buildUserHTML = useCallback(() => {
    if (!question) return "";
    let html = question.html_content;
    for (const b of blanks) {
      const val = blankValues[b.blank_id] || "";
      // replace both __BLANK_X__ (inline) and <__BLANK_X__>...</__BLANK_X__> (tag) patterns
      html = html.replace(new RegExp(`<__${b.blank_id}__>`, "g"), `<${val}>`);
      html = html.replace(new RegExp(`</__${b.blank_id}__>`, "g"), `</${val}>`);
      html = html.replace(new RegExp(`__${b.blank_id}__`, "g"), val);
    }
    return wrapWithDarkStyle(html);
  }, [question, blanks, blankValues]);

  // Build expected HTML by replacing blanks with correct answers
  const buildExpectedHTML = useCallback(() => {
    if (!question) return "";
    let html = question.html_content;
    for (const b of blanks) {
      html = html.replace(new RegExp(`<__${b.blank_id}__>`, "g"), `<${b.correct_answer}>`);
      html = html.replace(new RegExp(`</__${b.blank_id}__>`, "g"), `</${b.correct_answer}>`);
      html = html.replace(new RegExp(`__${b.blank_id}__`, "g"), b.correct_answer);
    }
    return wrapWithDarkStyle(html);
  }, [question, blanks]);

  // Calculate match percentage
  const computeMatch = (user: string, expected: string): number => {
    const a = user.trim().toLowerCase();
    const b = expected.trim().toLowerCase();
    if (a === b) return 100;
    let matches = 0;
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      if (a[i] === b[i]) matches++;
    }
    return Math.round((matches / maxLen) * 100);
  };

  const handleContinue = () => {
    if (!schoolNameInput.trim()) {
      toast.error("Please select or select or enter a school name");
      return;
    }
    navigate(`/coding/${encodeURIComponent(schoolNameInput.trim())}`);
  };

  const handleCheck = async () => {
    const userHTML = buildUserHTML();
    const expectedHTML = buildExpectedHTML();
    const pct = computeMatch(userHTML, expectedHTML);
    const newAttempts = checkAttempts + 1;
    setPercentage(pct);
    setCheckAttempts(newAttempts);
    setChecked(true);

    // Save percentage to DB so admin panel can see it in real-time
    const { data: existing } = await supabase
      .from("coding_submissions")
      .select("id")
      .eq("school_name", schoolName.trim())
      .maybeSingle();

    if (existing) {
      await supabase
        .from("coding_submissions")
        .update({ percentage: pct, check_attempts: newAttempts, final_output: userHTML })
        .eq("id", existing.id);
    } else {
      await supabase.from("coding_submissions").insert({
        school_name: schoolName.trim(),
        percentage: pct,
        check_attempts: newAttempts,
        final_output: userHTML,
        submitted: false,
        enabled: true,
      });
    }
  };

  const handleSubmit = async () => {
    setSubmitted(true);
    const userHTML = buildUserHTML();
    const time_remaining = timeLeft;

    const { data: existing } = await supabase
      .from("coding_submissions")
      .select("*")
      .eq("school_name", schoolName.trim())
      .maybeSingle();

    if (existing && existing.submitted && !existing.enabled) {
      toast.error("Already submitted! Wait for admin to re-enable.");
      setSubmitted(false);
      return;
    }

    if (existing) {
      await supabase
        .from("coding_submissions")
        .update({
          percentage,
          check_attempts: checkAttempts,
          final_output: userHTML,
          submitted: true,
          enabled: false,
          time_remaining,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("coding_submissions").insert({
        school_name: schoolName.trim(),
        percentage,
        check_attempts: checkAttempts,
        final_output: userHTML,
        submitted: true,
        enabled: false,
        time_remaining,
      });
    }

    toast.success("Submitted successfully!");
    // Clear saved blanks and timer after successful submission
    localStorage.removeItem(`coding_blanks_${schoolName}`);
    localStorage.removeItem(`coding_timer_${schoolName}`);
    if (timerRef.current) clearInterval(timerRef.current);
    // Exit fullscreen if active
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  // Also clear timer localStorage on auto-submit
  const handleAutoSubmitCleanup = () => {
    localStorage.removeItem(`coding_blanks_${schoolName}`);
    localStorage.removeItem(`coding_timer_${schoolName}`);
  };

  // Render html_content with Input components in place of __BLANK_X__
  const renderCodeWithBlanks = () => {
    if (!question) return null;

    // Split html_content by blank placeholders
    // Matches both <__BLANK_X__> tag usage and inline __BLANK_X__
    const parts = question.html_content.split(/(__BLANK_\d+__)/g);

    return parts.map((part, i) => {
      const blankMatch = part.match(/^__(.+)__$/);
      if (blankMatch) {
        const blankId = blankMatch[1]; // e.g. "BLANK_1"
        const blankInfo = blanks.find((b) => b.blank_id === blankId);
        if (blankInfo) {
          return (
            <Input
              key={`${blankId}-${i}`}
              value={blankValues[blankId] || ""}
              onChange={(e) => {
                if (!submitted) {
                  setBlankValues((prev) => ({ ...prev, [blankId]: e.target.value }));
                }
              }}
              placeholder={`Blank ${blankInfo.position}`}
              className="w-36 inline-block font-mono mx-1 h-7 text-sm"
              disabled={submitted}
            />
          );
        }
      }

      // Regular text — preserve whitespace
      if (!part) return null;
      return (
        <span key={i} className="text-primary whitespace-pre">
          {part}
        </span>
      );
    });
  };

  // Save blank values to localStorage whenever they change
  useEffect(() => {
    if (!schoolName || Object.keys(blankValues).length === 0) return;
    localStorage.setItem(`coding_blanks_${schoolName}`, JSON.stringify(blankValues));
  }, [blankValues, schoolName]);

  // Start countdown when entering code step, restore from localStorage
  useEffect(() => {
    if (step !== "code" || submitted || loadingQ) return;
    const storageKey = `coding_timer_${schoolName}`;
    const duration = question?.timer_seconds || 600;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const remaining = Math.max(0, parseInt(saved, 10));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        autoSubmitRef.current = true;
        return;
      }
    } else {
      setTimeLeft(duration);
      localStorage.setItem(storageKey, String(duration));
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        const next = prev - 1;
        localStorage.setItem(storageKey, String(Math.max(0, next)));
        if (next <= 0) {
          autoSubmitRef.current = true;
        }
        return Math.max(0, next);
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step, submitted, loadingQ, schoolName]);

  // Auto-submit when timer hits 0
  useEffect(() => {
    if (autoSubmitRef.current && !submitted && timeLeft <= 0) {
      autoSubmitRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      toast.info("Time's up! Auto-submitting your answers...");
      // Compute match before submitting so percentage is accurate
      const userHTML = buildUserHTML();
      const expectedHTML = buildExpectedHTML();
      const pct = computeMatch(userHTML, expectedHTML);
      setPercentage(pct);
      setChecked(true);
      // Exit fullscreen if active
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      // Submit with computed values directly
      (async () => {
        setSubmitted(true);
        const { data: existing } = await supabase
          .from("coding_submissions")
          .select("*")
          .eq("school_name", schoolName.trim())
          .maybeSingle();

        if (existing) {
          await supabase
            .from("coding_submissions")
            .update({
              percentage: pct,
              check_attempts: checkAttempts,
              final_output: userHTML,
              submitted: true,
              enabled: false,
            })
            .eq("id", existing.id);
        } else {
          await supabase.from("coding_submissions").insert({
            school_name: schoolName.trim(),
            percentage: pct,
            check_attempts: checkAttempts,
            final_output: userHTML,
            submitted: true,
            enabled: false,
          });
        }
        localStorage.removeItem(`coding_blanks_${schoolName}`);
        localStorage.removeItem(`coding_timer_${schoolName}`);
      })();
    }
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Sync state when user exits fullscreen via Escape key
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full p-4 flex items-center justify-center">
      {step === "enter" && (
        <Card className="max-w-md mx-auto animate-scale-in glass-card">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-display">💻 Code Wizard</CardTitle>
            <p className="text-muted-foreground text-sm mt-1">Select your school to begin the centered paragraph task</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <select
                value={schoolNameInput}
                onChange={e => setSchoolNameInput(e.target.value)}
                className="text-center text-lg w-full border rounded p-2 bg-transparent focus:bg-transparent focus:ring-2 focus:ring-primary/40 custom-select-white-options"
                style={{ minHeight: 48, fontWeight: 'bold', fontSize: '1.1rem', appearance: 'none', cursor: 'pointer' }}
              >
                <option value="" disabled>Select School</option>
                {schoolOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <Button onClick={handleContinue} className="w-full mt-2" size="lg">
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "code" && (
        <div className="w-full animate-fade-in">
          {loadingQ ? (
            <p className="text-center text-muted-foreground">Loading question...</p>
          ) : !question ? (
            <p className="text-center text-destructive">No question found.</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-1">
                <div className="flex-1" />
                <h2 className="font-display text-2xl font-semibold text-center">
                  {schoolName} — Code Wizard
                </h2>
                <div className="flex-1 flex justify-end gap-2">
                  <span
                    className={`font-mono text-lg font-bold px-3 py-1 rounded-lg ${
                      timeLeft <= 60
                        ? "bg-destructive/10 text-destructive animate-pulse"
                        : timeLeft <= 180
                        ? "bg-yellow-500/10 text-yellow-600"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    ⏱ {formatTime(timeLeft)}
                  </span>
                  <Button variant="outline" size="sm" onClick={toggleFullscreen}>
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <p className="text-center text-muted-foreground text-sm mb-4">
                {question.title}{question.description ? ` — ${question.description}` : ""}
              </p>

              <div className="flex flex-col-2 lg:flex-row items-start gap-6">
                {/* left column: code with blanks */}
                <div className="w-full lg:w-[50%] space-y-6">
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-lg">Fill in the blanks</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div
                        className="font-mono bg-muted p-4 rounded-lg text-sm leading-relaxed"
                        style={{
                          overflowX: 'auto',
                          overflowY: 'auto',
                          whiteSpace: 'pre',
                          maxWidth: '100%',
                          maxHeight: '420px',
                        }}
                      >
                        {renderCodeWithBlanks()}
                      </div>

                      <div className="flex gap-3">
                        
                        <Button
                          variant="outline"
                          disabled={submitted}
                          onClick={() => {
                            const cleared: Record<string, string> = {};
                            blanks.forEach((b) => { cleared[b.blank_id] = ""; });
                            setBlankValues(cleared);
                            setChecked(false);
                            setPercentage(0);
                          }}
                        >
                          Clear
                        </Button>
                        <Button onClick={handleCheck} disabled={submitted} variant="secondary">
                          Check 
                        </Button>
                        <Button onClick={handleSubmit} disabled={!checked || submitted}>
                          Submit
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* right column: outputs */}
                <div className="w-full lg:w-[50%] space-y-6">
                  <div className="flex flex-col gap-2">
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle className="text-sm">Expected Output</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <iframe
                          srcDoc={buildExpectedHTML()}
                          title="Expected Output"
                          style={{ width: '100%', height: '180px', border: 'none', borderRadius: '4px' }}
                          sandbox="allow-scripts"
                        />
                      </CardContent>
                    </Card>
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle className="text-sm">Your Output</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {checked ? (
                          <iframe
                            srcDoc={buildUserHTML()}
                            title="Your Output"
                            style={{ width: '100%', height: '180px', border: 'none', borderRadius: '4px' }}
                            sandbox="allow-scripts"
                          />
                        ) : (
                          <div className="border rounded-lg p-4 bg-background min-h-[80px]">
                            <p className="text-center text-muted-foreground">
                              Click "Check" to see your result
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {checked && (
                      <Card className="w-full glass-card">
                        <CardContent className="pt-6">
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-muted-foreground">Match:</span>
                            <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all duration-500"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="font-display font-bold text-lg">{percentage}%</span>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {step === "done" && (
        <Card className="w-full max-w-md animate-scale-in glass-card text-center">
          <CardContent className="pt-8 pb-8">
            <div className="text-6xl mb-4">✅</div>
            <h2 className="font-display text-2xl font-bold mb-2">Submitted!</h2>
            <p className="text-muted-foreground">
              <strong>{schoolName}</strong> scored <strong>{percentage}%</strong> with {checkAttempts} check attempt(s).
            </p>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
