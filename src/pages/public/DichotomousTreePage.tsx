/**
 * Extracts a detailed user tree format: { feature: [animals], ... }
 * Includes all split and pending features recursively.
 */
function extractDetailedUserTreeFormat(node: NodeData | null): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  function traverse(n: NodeData | null) {
    if (!n) return;
    // If this node is a split, recurse into children
    if (n.isSplit && n.left && n.right) {
      traverse(n.left);
      traverse(n.right);
    }
    // For pending features (pre-split), add them with their animals
    if (n.pendingFeatL) {
      result[n.pendingFeatL] = n.pendingLeft && n.pendingLeft.length > 0 ? n.pendingLeft : [];
    }
    if (n.pendingFeatR) {
      result[n.pendingFeatR] = n.pendingRight && n.pendingRight.length > 0 ? n.pendingRight : [];
    }
    // Also add this node's label if not root and not 'விலங்குகள்'
    if (n.label && n.label !== 'விலங்குகள்') {
      result[n.label] = n.animals;
    }
  }
  traverse(node);
  return result;
}
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import "@/Styles/DichotomousTreePage.css";

/* ── types ── */
interface QuestionRow {
  id: number;
  title: string;
  description: string | null;
  animals: string[];
  features: string[];
  timer_seconds: number;
}

interface AnswerNode {
  parent_label: string;
  feature_name: string;
  animals: string[];
  depth: number;
  position: number;
}

interface NodeData {
  animals: string[];
  label: string;
  isSplit: boolean;
  left?: NodeData;
  right?: NodeData;
  featL?: string;
  featR?: string;
  pendingLeft?: string[];
  pendingRight?: string[];
  pendingFeatL?: string;
  pendingFeatR?: string;
}

/**
 * Extracts the user tree format: { label: [animals], ... }
 * where label is a feature (from பண்புகளின் வங்கி) and the array is the animals assigned to that feature.
 */
function extractUserTreeFormat(node: NodeData | null): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  function traverse(n: NodeData | null, isRoot = false) {
    if (!n) return;
    // Always record the root node's animals, even if label is 'விலங்குகள்'
    if (n.label && (isRoot || n.label !== 'விலங்குகள்')) {
      result[n.label] = n.animals;
    }
    if (n.isSplit && n.left && n.right) {
      traverse(n.left);
      traverse(n.right);
    }
  }
  traverse(node, true);
  return result;
}

type Step = "enter" | "instructions" | "game" | "done";

/* ── helpers ── */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((val, idx) => val === b[idx]);
}

/**
 * Validate user answer against DB answer nodes using user_tree_detailed format.
 * Full marks only if all features match exactly, otherwise partial marks by feature.
 */
function validateTreeFromDB(treeData: NodeData | null, answerNodes: AnswerNode[]): number {
  if (!treeData) return 0;
  if (!answerNodes || answerNodes.length === 0) return 0;

  // Build correct answer mapping: feature_name -> animals[]
  const correctMap: Record<string, string[]> = {};
  for (const n of answerNodes) {
    if (n.feature_name) {
      correctMap[n.feature_name] = n.animals;
    }
  }

  // Get user answer in the same format
  const userMap = extractDetailedUserTreeFormat(treeData);

  // Collect all unique features from both user and correct answer
  const allFeatures = Array.from(new Set([
    ...Object.keys(userMap),
    ...Object.keys(correctMap)
  ]));

  let correctFeatures = 0;
  for (const feature of allFeatures) {
    const userAnimals = (userMap[feature] || []).slice().sort();
    const correctAnimals = (correctMap[feature] || []).slice().sort();
    if (arraysEqual(userAnimals, correctAnimals)) {
      correctFeatures++;
    }
  }

  // Full marks if all features are correct
  if (correctFeatures === allFeatures.length && allFeatures.length > 0) {
    return 100;
  }
  // Otherwise, partial marks by feature
  const score = Math.round((correctFeatures / allFeatures.length) * 100);
  return score;
}

function serializeNode(container: Element): NodeData {
  const node = container.querySelector(":scope > .node") as HTMLElement;
  const ui = node.querySelector(".ui-controls") as HTMLElement;
  const isSplit = ui.style.display === "none";
  const animals = Array.from(node.querySelectorAll(":scope > .parent-pool .animal-tag")).map(
    (el) => (el as HTMLElement).innerText,
  );
  const labelEl = node.querySelector(".node-header-label");
  const label = labelEl ? (labelEl as HTMLElement).innerText : "விலங்குகள்";
  const data: NodeData = { animals, label, isSplit };
  if (isSplit) {
    const leftChild = container.querySelector(".left-child")?.firstElementChild;
    const rightChild = container.querySelector(".right-child")?.firstElementChild;
    if (leftChild && rightChild) {
      data.left = serializeNode(leftChild);
      data.right = serializeNode(rightChild);
      data.featL = data.left.label;
      data.featR = data.right.label;
    }
  } else {
    // Capture pending (pre-split) drop zone state
    const zoneL = ui.querySelector("#zone-l");
    const zoneR = ui.querySelector("#zone-r");
    const slotL = ui.querySelector("#slot-l");
    const slotR = ui.querySelector("#slot-r");
    if (zoneL) {
      data.pendingLeft = Array.from(zoneL.querySelectorAll(".animal-tag")).map(
        (el) => (el as HTMLElement).innerText,
      );
    }
    if (zoneR) {
      data.pendingRight = Array.from(zoneR.querySelectorAll(".animal-tag")).map(
        (el) => (el as HTMLElement).innerText,
      );
    }
    if (slotL) {
      const txt = (slotL as HTMLElement).innerText;
      if (txt && txt !== "Drop Feature") data.pendingFeatL = txt;
    }
    if (slotR) {
      const txt = (slotR as HTMLElement).innerText;
      if (txt && txt !== "Drop Feature") data.pendingFeatR = txt;
    }
  }
  return data;
}

/* ── DOM-based tree builder ── */
function createBranch(
  animals: string[],
  nodeLabel = "",
  savedData: NodeData | null = null,
  saveTreeState: () => void,
): HTMLElement {
  const container = document.createElement("div");
  container.className = "node-container";
  const node = document.createElement("div");
  node.className = "node";

  if (nodeLabel) {
    const header = document.createElement("div");
    header.className = "node-header-label";
    header.innerText = nodeLabel;
    node.appendChild(header);
  }

  let leftSide: string[] = [];
  let rightSide: string[] = [];
  let featL = "";
  let featR = "";

  const pool = document.createElement("div");
  pool.className = "parent-pool";
  const ui = document.createElement("div");
  ui.className = "ui-controls";

  const renderPool = () => {
    pool.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "animals-wrap";
    animals.forEach((name) => {
      const isAssigned = leftSide.includes(name) || rightSide.includes(name);
      const span = document.createElement("span");
      span.className = "animal-tag" + (isAssigned ? " ghosted" : "");
      span.innerText = name;
      if (!isAssigned) {
        span.draggable = true;
        span.addEventListener("dragstart", (e) => {
          e.dataTransfer?.setData("type", "animal");
          e.dataTransfer?.setData("text", name);
        });
      }
      wrap.appendChild(span);
    });
    pool.appendChild(wrap);
  };

  if (animals.length > 1) {
    ui.innerHTML = `
      <div class="drop-container">
        <div class="drop-column"><div class="feature-slot" id="slot-l">Drop Feature</div><div class="drop-zone" id="zone-l"></div></div>
        <div class="drop-column"><div class="feature-slot" id="slot-r">Drop Feature</div><div class="drop-zone" id="zone-r"></div></div>
      </div>
      <button class="split-btn" disabled>Split Branch</button>
    `;

    const splitBtn = ui.querySelector(".split-btn") as HTMLButtonElement;

    const updateUI = () => {
      renderPool();
      const makeDraggable = (name: string, zone: 'left' | 'right' = 'left'): HTMLElement => {
        const s = document.createElement("span");
        s.className = "animal-tag";
        s.innerText = name;
        s.draggable = true;
        s.addEventListener("dragstart", (e) => {
          e.dataTransfer?.setData("type", "animal");
          e.dataTransfer?.setData("text", name);
        });
        // Add remove button if in drop zone (not in pool)
        if ((zone === 'left' && leftSide.includes(name)) || (zone === 'right' && rightSide.includes(name))) {
          const btn = document.createElement("button");
          btn.innerText = "×";
          btn.className = "animal-remove-btn";
          btn.title = "Remove";
          btn.onclick = (e) => {
            e.stopPropagation();
            // Remove from drop zone and return to pool
            if (zone === 'left') {
              leftSide = leftSide.filter((a) => a !== name);
            } else {
              rightSide = rightSide.filter((a) => a !== name);
            }
            updateUI();
            // Save the full tree from the root after removal
            setTimeout(() => {
              const root = document.getElementById('tree-root');
              if (root && root.firstElementChild) saveTreeState();
            }, 0);
          };
          s.appendChild(btn);
          s.style.position = "relative";
        }
        return s;
      };
      const zl = ui.querySelector("#zone-l") as HTMLElement;
      zl.innerHTML = "";
      leftSide.forEach((n) => zl.appendChild(makeDraggable(n, 'left')));
      const zr = ui.querySelector("#zone-r") as HTMLElement;
      zr.innerHTML = "";
      rightSide.forEach((n) => zr.appendChild(makeDraggable(n, 'right')));
      splitBtn.disabled = !(
        featL && featR &&
        leftSide.length + rightSide.length === animals.length &&
        leftSide.length > 0 && rightSide.length > 0
      );
      // Do NOT call saveTreeState here; only after drop/removal/split
    };

    ui.addEventListener("dragover", (e) => e.preventDefault());
    ui.addEventListener("drop", (e) => {
      const type = e.dataTransfer?.getData("type");
      const val = e.dataTransfer?.getData("text");
      const target = (e.target as HTMLElement).closest(".feature-slot, .drop-zone") as HTMLElement;
      if (!target || !type || !val) return;
      let changed = false;
      if (type === "feature" && target.classList.contains("feature-slot")) {
        target.innerText = val;
        target.style.borderStyle = "solid";
        if (target.id === "slot-l" && featL !== val) { featL = val; changed = true; }
        else if (target.id === "slot-r" && featR !== val) { featR = val; changed = true; }
      } else if (type === "animal" && target.classList.contains("drop-zone")) {
        // Only update if the animal is actually moved
        if (target.id === "zone-l" && !leftSide.includes(val)) {
          leftSide = leftSide.filter((n) => n !== val);
          rightSide = rightSide.filter((n) => n !== val);
          leftSide.push(val);
          changed = true;
        } else if (target.id === "zone-r" && !rightSide.includes(val)) {
          leftSide = leftSide.filter((n) => n !== val);
          rightSide = rightSide.filter((n) => n !== val);
          rightSide.push(val);
          changed = true;
        }
      }
      updateUI();
      // Save the full tree from the root after drop
      setTimeout(() => {
        const root = document.getElementById('tree-root');
        if (root && root.firstElementChild) saveTreeState();
      }, 0);
    });

    splitBtn.onclick = () => {
      ui.style.display = "none";
      const connector = document.createElement("div");
      connector.className = "connector-container";
      connector.innerHTML = `
        <div class="line-v"></div>
        <div class="branch-row">
          <div class="branch-path"><div class="h-line left"></div><div class="arrow-v"></div><div class="left-child"></div></div>
          <div class="branch-path"><div class="h-line right"></div><div class="arrow-v"></div><div class="right-child"></div></div>
        </div>`;
      const lc = connector.querySelector(".left-child") as HTMLElement;
      const rc = connector.querySelector(".right-child") as HTMLElement;
      lc.appendChild(createBranch(leftSide, featL, savedData?.left || null, saveTreeState));
      rc.appendChild(createBranch(rightSide, featR, savedData?.right || null, saveTreeState));
      container.appendChild(connector);
      // Save the full tree from the root after split
      setTimeout(() => {
        const root = document.getElementById('tree-root');
        if (root && root.firstElementChild) saveTreeState();
      }, 0);
    };

    if (savedData?.isSplit && savedData.left && savedData.right) {
      leftSide = savedData.left.animals;
      rightSide = savedData.right.animals;
      featL = savedData.featL || "";
      featR = savedData.featR || "";
      setTimeout(() => {
        const slotL = ui.querySelector("#slot-l") as HTMLElement;
        const slotR = ui.querySelector("#slot-r") as HTMLElement;
        slotL.innerText = featL;
        slotR.innerText = featR;
        splitBtn.disabled = false;
        splitBtn.click();
      }, 0);
    } else if (savedData && !savedData.isSplit) {
      // Restore pending (pre-split) drop zone state
      if (savedData.pendingLeft) leftSide = savedData.pendingLeft;
      if (savedData.pendingRight) rightSide = savedData.pendingRight;
      if (savedData.pendingFeatL) featL = savedData.pendingFeatL;
      if (savedData.pendingFeatR) featR = savedData.pendingFeatR;
      setTimeout(() => {
        if (featL) {
          const slotL = ui.querySelector("#slot-l") as HTMLElement;
          if (slotL) { slotL.innerText = featL; slotL.style.borderStyle = "solid"; }
        }
        if (featR) {
          const slotR = ui.querySelector("#slot-r") as HTMLElement;
          if (slotR) { slotR.innerText = featR; slotR.style.borderStyle = "solid"; }
        }
        updateUI();
      }, 0);
    }
  } else {
    const finalChoice = document.createElement("div");
    finalChoice.className = "final-choice-text";
    finalChoice.innerText = "Final Choice!";
    ui.appendChild(finalChoice);
  }

  node.appendChild(pool);
  node.appendChild(ui);
  container.appendChild(node);
  renderPool();
  return container;
}

/* ── Main Component ── */
export default function DichotomousTreePage() {
  const { schoolName: urlSchoolName, questionId: urlQuestionId } = useParams<{ schoolName: string; questionId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isGameUrl = location.pathname.endsWith("/game");

  const [schoolNameInput, setSchoolNameInput] = useState("");
  const [schoolOptions, setSchoolOptions] = useState<string[]>([]);
  const [step, setStep] = useState<Step>("enter");
  const [timeLeft, setTimeLeft] = useState(180);
  const [score, setScore] = useState(0);

  // DB-driven question data
  const [question, setQuestion] = useState<QuestionRow | null>(null);
  const [answerNodes, setAnswerNodes] = useState<AnswerNode[]>([]);
  const [loadingQ, setLoadingQ] = useState(true);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const treeRootRef = useRef<HTMLDivElement>(null);
  const featureBankRef = useRef<HTMLDivElement>(null);
  const submittedRef = useRef(false);
  const saveTreeStateRef = useRef<() => void>(() => {});
  const undoStackRef = useRef<NodeData[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Always use the selected school name from the URL after navigation
  const schoolName = urlSchoolName ? decodeURIComponent(urlSchoolName) : "";

  /* ── fullscreen ── */
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  /* ── Fetch school names for dropdown ── */
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("teams").select("name").limit(7);
      if (!error && data) {
        setSchoolOptions(data.map((row: { name: string }) => row.name));
      }
    })();
  }, []);

  /* ── Fetch question + answer nodes from DB ── */
  useEffect(() => {
    if (!urlSchoolName) return;
    if (submittedRef.current) return; // already submitted, don't re-fetch
    (async () => {
      setLoadingQ(true);
      const db: any = supabase;
      const decodedSchool = decodeURIComponent(urlSchoolName);
      const qId = urlQuestionId ? parseInt(urlQuestionId, 10) : null;

      // Helper: fetch a question (by ID if available, otherwise first)
      const fetchQuestion = async () => {
        if (qId) {
          const { data } = await db
            .from("dichotomous_questions")
            .select("id, title, description, animals, features, timer_seconds")
            .eq("id", qId)
            .single();
          return data;
        }
        const { data } = await db
          .from("dichotomous_questions")
          .select("id, title, description, animals, features, timer_seconds")
          .order("id", { ascending: true })
          .limit(1)
          .single();
        return data;
      };

      // Helper: fetch answer nodes for a question
      const fetchAnswerNodes = async (questionId: number) => {
        const { data } = await db
          .from("dichotomous_answer_nodes")
          .select("parent_label, feature_name, animals, depth, position")
          .eq("question_id", questionId)
          .order("depth", { ascending: true })
          .order("position", { ascending: true });
        return data ?? [];
      };

      // Fetch question first
      const qData = await fetchQuestion();
      if (!qData) {
        toast.error("No question found in database");
        setLoadingQ(false);
        return;
      }

      // If no questionId in URL, redirect to include it
      if (!urlQuestionId) {
        navigate(`/dichotomous/${encodeURIComponent(decodedSchool)}/${qData.id}`, { replace: true });
        return;
      }

      // Check if already submitted for this school + question
      const { data: existingSub } = await db
        .from("quiz_scores")
        .select("score, total")
        .eq("school_name", decodedSchool)
        .eq("question_id", qData.id)
        .maybeSingle();
      if (existingSub) {
        setScore(existingSub.score);
        setQuestion(qData);
        setAnswerNodes(await fetchAnswerNodes(qData.id));
        setLoadingQ(false);
        setStep("done");
        return;
      }

      setQuestion(qData);
      setTimeLeft(qData.timer_seconds || 180);
      setAnswerNodes(await fetchAnswerNodes(qData.id));

      setLoadingQ(false);
      // If URL ends with /game, go directly to game step (refresh during game)
      setStep(isGameUrl ? "game" : "instructions");
    })();
  }, [urlSchoolName, urlQuestionId, navigate, isGameUrl]);

  /* ── save tree state to DB (debounced) ── */
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRestoringRef = useRef(false);
  const saveTreeState = useCallback(() => {
    const root = treeRootRef.current;
    if (!root?.firstElementChild || !question) return;
    const state = serializeNode(root.firstElementChild);

    // Defensive: log if schoolName is missing
    if (!schoolName) {
      console.error("[Dichotomous] schoolName is missing when saving tree!", { urlSchoolName, schoolNameInput });
      toast.error("School name missing, cannot save progress.");
      return;
    }

    // Push previous state to undo stack (skip if we're restoring from undo)
    if (!isRestoringRef.current) {
      const prevJson = sessionStorage.getItem(`dichotomous_${schoolName}`);
      if (prevJson) {
        const prev: NodeData = JSON.parse(prevJson);
        undoStackRef.current.push(prev);
        // Keep max 50 states
        if (undoStackRef.current.length > 50) undoStackRef.current.shift();
        setCanUndo(true);
      }
    }
    isRestoringRef.current = false;

    // Also keep sessionStorage as fast fallback
    sessionStorage.setItem(`dichotomous_${schoolName}`, JSON.stringify(state));
    // Debounce DB save to avoid too many writes
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const db: any = supabase;
      const timerVal = parseInt(sessionStorage.getItem(`dichotomous_timer_${schoolName}`) || '180', 10);
      // Always update tree_data and user_tree_detailed with the latest state
      const userTreeDetailed = extractDetailedUserTreeFormat(state);
      const { error } = await db.from("dichotomous_user_trees").upsert({
        school_name: schoolName,
        question_id: question.id,
        tree_data: state, // always update tree_data
        user_tree_detailed: userTreeDetailed, // always update user_tree_detailed
        timer_remaining: timerVal,
        updated_at: new Date().toISOString(),
      }, { onConflict: "school_name,question_id" });
      if (error) console.error("Failed to save tree:", error);
    }, 1000);
  }, [schoolName, question, urlSchoolName, schoolNameInput]);

  // Keep ref always pointing to latest saveTreeState
  useEffect(() => {
    saveTreeStateRef.current = saveTreeState;
  }, [saveTreeState]);

  /* ── save score to DB ── */
  const saveScore = useCallback(
    async (sc: number, total: number, treeData: NodeData | null) => {
      if (!schoolName || !question) return;
      const db: any = supabase;
      const { error } = await db.from("quiz_scores").insert({
        school_name: schoolName,
        question_id: question.id,
        score: sc,
        total,
        tree_data: treeData,
      });
      if (error) {
        console.error("Failed to save score:", error);
        toast.error("Score save failed: " + error.message);
      }
    },
    [schoolName, question],
  );

  /* ── end game ── */
  const endGame = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);

    // Always save the latest tree state before submit
    if (saveTreeStateRef.current) {
      saveTreeStateRef.current();
    }

    const root = treeRootRef.current;
    const firstChild = root?.firstElementChild ?? null;
    const treeData = firstChild ? serializeNode(firstChild) : null;
    const sc = validateTreeFromDB(treeData, answerNodes);
    setScore(sc);
    await saveScore(sc, 10, treeData);

    // After submit, upsert tree_data and user_tree_detailed in dichotomous_user_trees
    try {
      if (schoolName && question && treeData) {
        const userTreeDetailed = extractDetailedUserTreeFormat(treeData);
        const db: any = supabase;
        await db.from("dichotomous_user_trees").upsert({
          school_name: schoolName,
          question_id: question.id,
          tree_data: treeData,
          user_tree_detailed: userTreeDetailed,
          updated_at: new Date().toISOString(),
        }, { onConflict: "school_name,question_id" });
      }
    } catch (err) {
      console.error("Failed to upsert tree_data, user_tree_detailed after submit", err);
    }

    sessionStorage.removeItem(`dichotomous_${schoolName}`);
    sessionStorage.removeItem(`dichotomous_timer_${schoolName}`);
    // Do NOT delete in-progress tree from DB after submit; keep the data for review/analytics
    setStep("done");
    // Exit fullscreen on submit
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    // Navigate away from /game URL so refresh shows done state (DB will detect submission)
    if (urlQuestionId) {
      navigate(`/dichotomous/${encodeURIComponent(schoolName)}/${urlQuestionId}`, { replace: true });
    }
    toast.success("Submitted!");
  }, [saveScore, schoolName, answerNodes, urlQuestionId, navigate, question]);

  /* ── init game when entering game step ── */
  useEffect(() => {
    if (step !== "game" || !question) return;

    // feature bank from DB
    const bank = featureBankRef.current;
    if (bank) {
      bank.innerHTML = "";
      (question.features as string[]).forEach((feat) => {
        const span = document.createElement("span");
        span.className = "feature-tag";
        span.innerText = feat;
        span.draggable = true;
        span.addEventListener("dragstart", (e) => {
          e.dataTransfer?.setData("type", "feature");
          e.dataTransfer?.setData("text", feat);
        });
        bank.appendChild(span);
      });
    }

    // tree — root label from first answer node parent_label
    const rootLabel = answerNodes.length > 0 ? answerNodes[0].parent_label : question.title;
    const animals = question.animals as string[];
    const root = treeRootRef.current;

    // Stable wrapper that always calls the latest saveTreeState via ref
    const stableSave = () => saveTreeStateRef.current();

    // Try to load saved tree from DB first, then sessionStorage fallback
    const loadAndBuild = async () => {
      if (!root) return;
      root.innerHTML = "";
      let savedTree: NodeData | null = null;
      let savedTimerVal: number | null = null;

      // Try DB first
      const db: any = supabase;
      const { data: dbSaved } = await db
        .from("dichotomous_user_trees")
        .select("tree_data, timer_remaining")
        .eq("school_name", schoolName)
        .eq("question_id", question.id)
        .maybeSingle();
      if (dbSaved) {
        savedTree = dbSaved.tree_data as NodeData;
        savedTimerVal = dbSaved.timer_remaining;
      } else {
        // Fallback to sessionStorage
        const saved = sessionStorage.getItem(`dichotomous_${schoolName}`);
        if (saved) {
          savedTree = JSON.parse(saved);
        }
      }

      if (savedTree) {
        root.appendChild(createBranch(savedTree.animals, rootLabel, savedTree, stableSave));
      } else {
        root.appendChild(createBranch(animals, rootLabel, null, stableSave));
      }

      // timer
      const duration = question.timer_seconds || 180;
      const sessionTimer = sessionStorage.getItem(`dichotomous_timer_${schoolName}`);
      let remaining = savedTimerVal ?? (sessionTimer !== null ? parseInt(sessionTimer, 10) : duration);
      if (remaining <= 0) {
        endGame();
        return;
      }
      setTimeLeft(remaining);

      timerRef.current = setInterval(() => {
        remaining--;
        setTimeLeft(remaining);
        if (remaining <= 0) {
          clearInterval(timerRef.current!);
          toast.info("Time's up! Auto-submitting…");
          endGame();
        } else {
          sessionStorage.setItem(`dichotomous_timer_${schoolName}`, String(remaining));
        }
      }, 1000);
    };

    loadAndBuild();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step, schoolName, saveTreeState, endGame]);

  /* helpers */
  const handleContinue = () => {
    if (!schoolNameInput.trim()) {
      toast.error("Please enter a school name");
      return;
    }
    navigate(`/dichotomous/${encodeURIComponent(schoolNameInput.trim())}${urlQuestionId ? '/' + urlQuestionId : ''}`);
  };

  const handleReset = async () => {
    if (!confirm("This will delete all progress. Continue?")) return;
    sessionStorage.removeItem(`dichotomous_${schoolName}`);
    sessionStorage.removeItem(`dichotomous_timer_${schoolName}`);
    // Delete in-progress tree from DB
    if (question) {
      const db: any = supabase;
      await db.from("dichotomous_user_trees")
        .delete()
        .eq("school_name", schoolName)
        .eq("question_id", question.id);
    }
    submittedRef.current = false;
    undoStackRef.current = [];
    setCanUndo(false);
    setStep("game"); // re-trigger init
    // Force re-mount by clearing and re-entering
    const root = treeRootRef.current;
    if (root) root.innerHTML = "";
  };

  const handleUndo = () => {
    if (undoStackRef.current.length === 0) return;
    const prevState = undoStackRef.current.pop()!;
    setCanUndo(undoStackRef.current.length > 0);

    // Mark as restoring so saveTreeState doesn't push this back onto undo stack
    isRestoringRef.current = true;

    const root = treeRootRef.current;
    if (!root || !question) return;
    const rootLabel = answerNodes.length > 0 ? answerNodes[0].parent_label : question.title;
    root.innerHTML = "";
    const stableSave = () => saveTreeStateRef.current();
    root.appendChild(createBranch(prevState.animals, rootLabel, prevState, stableSave));

    // Save restored state
    sessionStorage.setItem(`dichotomous_${schoolName}`, JSON.stringify(prevState));
    stableSave();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  // Show difference between user answer and correct answer after submit
  const [userTreeMap, setUserTreeMap] = useState<Record<string, string[]> | null>(null);

  useEffect(() => {
    if (step !== "done" || !schoolName || !question) return;
    (async () => {
      const db: any = supabase;
      // Fetch from dichotomous_user_trees.user_tree_detailed (new format)
      const { data } = await db
        .from("dichotomous_user_trees")
        .select("user_tree_detailed")
        .eq("school_name", schoolName)
        .eq("question_id", question.id)
        .maybeSingle();
      if (data && data.user_tree_detailed) {
        setUserTreeMap(data.user_tree_detailed);
      } else {
        setUserTreeMap(null);
      }
    })();
  }, [step, schoolName, question]);

  // No answer comparison display needed
  const renderDifferenceJSX = () => null;

  /* ── RENDER ── */
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full p-4 dt-page flex items-center justify-center">
      {/* Loading state when URL has school name but DB check is in progress */}
      {loadingQ && urlSchoolName && (
        <Card className="w-full max-w-md mx-auto animate-scale-in glass-card">
          <CardContent className="pt-8 pb-8 text-center">
            <p className="text-muted-foreground">Loading...</p>
          </CardContent>
        </Card>
      )}

      {/* Step: enter school name (only when no school name in URL) */}
      {step === "enter" && !urlSchoolName && (
        <Card className="w-full max-w-md mx-auto animate-scale-in glass-card">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-display">🌳 Dichotomous Tree Builder</CardTitle>
            <p className="text-muted-foreground text-sm mt-1">Select your school to begin</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              value={schoolNameInput}
              onChange={e => setSchoolNameInput(e.target.value)}
              className="text-center text-lg w-full border rounded p-2 bg-transparent focus:bg-transparent focus:ring-2 focus:ring-primary/40 custom-select-white-options"
            /* Add this style at the end of the file for white dropdown options */
            // ...existing code...

            // Add to the bottom of the file (or in your CSS):
            // .custom-select-white-options option {
            //   background: #fff;
            //   color: #222;
            // }
            >
              <option value="" disabled>Select School</option>
              {schoolOptions.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <Button onClick={handleContinue} className="w-full" size="lg" disabled={!schoolNameInput}>
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step: instructions */}
      {step === "instructions" && !loadingQ && (
        <Card className="w-full max-w-lg mx-auto animate-scale-in glass-card">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-display">
              {question?.title ?? "விளையாட்டு விளக்கங்கள்"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {question?.description && (
              <div>
                <h3 className="font-semibold">📋 விளையாட்டு பற்றி:</h3>
                <p className="text-muted-foreground">{question.description}</p>
              </div>
            )}
            <div>
              <h3 className="font-semibold">⏱️ நேர வரம்பு:</h3>
              <p className="text-muted-foreground">
                <strong>
                  மொத்த நேரம்: {Math.floor((question?.timer_seconds || 180) / 60)} நிமிடங்கள்
                </strong>
              </p>
            </div>
            <div>
              <h3 className="font-semibold">📊 மதிப்பெண்:</h3>
              <p className="text-muted-foreground"><strong>10 மதிப்பெண்:</strong> அனைத்தும் சரியாக இருந்தால்</p>
              <p className="text-muted-foreground"><strong>0 மதிப்பெண்:</strong> அனைத்தும் தவறாக இருந்தால்</p>
            </div>
            <Button className="w-full" size="lg" onClick={() => {
              navigate(`/dichotomous/${encodeURIComponent(schoolName)}/${urlQuestionId}/game`, { replace: true });
              setStep("game");
            }}>
              விளையாட்டைத் தொடங்கவும்
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step: game */}
      {step === "game" && (
        <div className="w-full animate-fade-in dt-game">
          {loadingQ ? (
            <p className="text-center text-muted-foreground">Loading question...</p>
          ) : !question ? (
            <p className="text-center text-destructive">No question found.</p>
          ) : (
          <>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display text-xl font-semibold">
              {schoolName} — {question.title}
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={toggleFullscreen}>
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
              <span
                className={`font-mono text-lg font-bold px-3 py-1 rounded-lg ${
                  timeLeft <= 30
                    ? "bg-destructive/10 text-destructive animate-pulse"
                    : timeLeft <= 60
                    ? "bg-yellow-500/10 dt-timer-warning"
                    : "bg-primary/10 text-primary"
                }`}
              >
                ⏱ {formatTime(timeLeft)}
              </span>
            </div>
          </div>

          <div className="dt-main-layout ">
            <div className="dt-tree-viewport">
              <div className="dt-tree-root" ref={treeRootRef} id="tree-root"></div>
            </div>

            <div className="dt-feature-sidebar lg:w-[20%] space-y-6">
              <h3 className="font-semibold mb-2">பண்புகளின் வங்கி</h3>
              <p className="text-xs text-muted-foreground mb-2">
                இவற்றை பண்பு செல்களுக்குள் இழுக்கவும்
              </p>
              <div ref={featureBankRef} id="feature-bank"></div>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={handleReset}>
              முழு மரத்தை மீட்டமை
            </Button>
            <Button variant="outline" onClick={handleUndo} disabled={!canUndo}>
              முந்தைய நிலை
            </Button>
            <Button onClick={() => endGame()}>Submit</Button>
          </div>
          </>
          )}
        </div>
      )}

      {/* Step: done */}
      {step === "done" && (
        <div className="max-w-lg mx-auto space-y-6 animate-scale-in">
          <Card className="glass-card text-center">
            <CardContent className="pt-8 pb-8">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="font-display text-2xl font-bold mb-2">விளையாட்டு முடிந்தது</h2>
              <div className="text-4xl font-bold text-primary mb-1">{score}/100</div>
              <p className="text-muted-foreground">
                <strong>{schoolName}</strong> — மொத்த மதிப்பெண்
              </p>
            </CardContent>
          </Card>
          {renderDifferenceJSX()}
        </div>
      )}
    </div>
  );
}
