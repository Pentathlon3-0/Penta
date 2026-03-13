import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Pencil, Save, X, Plus, Trash2, GitBranchPlus } from "lucide-react";

/* ── types ── */
interface QuestionRow {
  id: number;
  title: string;
  description: string | null;
  animals: string[];
  features: string[];
  timer_seconds: number;
}

interface AnswerNodeRow {
  id: number;
  question_id: number;
  parent_label: string;
  feature_name: string;
  animals: string[];
  depth: number;
  position: number;
}

/** Tree-based split node used in the editor UI */
interface SplitNode {
  parentLabel: string;
  left: { featureName: string; animals: string };
  right: { featureName: string; animals: string };
  children: SplitNode[]; // child splits (splitting left or right further)
}

/* ── Convert flat DB rows → tree of SplitNodes ── */
function dbNodesToTree(nodes: AnswerNodeRow[]): SplitNode[] {
  const byParent: Record<string, AnswerNodeRow[]> = {};
  for (const n of nodes) {
    if (!byParent[n.parent_label]) byParent[n.parent_label] = [];
    byParent[n.parent_label].push(n);
  }
  for (const k of Object.keys(byParent)) {
    byParent[k].sort((a, b) => a.position - b.position);
  }

  function buildChildren(parentLabel: string): SplitNode[] {
    const pair = byParent[parentLabel];
    if (!pair || pair.length < 2) return [];
    const split: SplitNode = {
      parentLabel,
      left: {
        featureName: pair[0].feature_name,
        animals: (pair[0].animals as string[]).join(", "),
      },
      right: {
        featureName: pair[1].feature_name,
        animals: (pair[1].animals as string[]).join(", "),
      },
      children: [
        ...buildChildren(pair[0].feature_name),
        ...buildChildren(pair[1].feature_name),
      ],
    };
    return [split];
  }

  // Find root: parent_label that isn't any feature_name
  const allFeatures = new Set(nodes.map((n) => n.feature_name));
  const roots = [...new Set(nodes.map((n) => n.parent_label))].filter((p) => !allFeatures.has(p));
  const tree: SplitNode[] = [];
  for (const root of roots) {
    tree.push(...buildChildren(root));
  }
  return tree;
}

/* ── Flatten tree of SplitNodes → flat DB rows ── */
function treeToDbNodes(splits: SplitNode[], questionId: number): Omit<AnswerNodeRow, "id">[] {
  const rows: Omit<AnswerNodeRow, "id">[] = [];

  function walk(node: SplitNode, depth: number) {
    const parseAnimals = (s: string) => s.split(",").map((a) => a.trim()).filter(Boolean);
    rows.push({
      question_id: questionId,
      parent_label: node.parentLabel,
      feature_name: node.left.featureName,
      animals: parseAnimals(node.left.animals),
      depth,
      position: 1,
    });
    rows.push({
      question_id: questionId,
      parent_label: node.parentLabel,
      feature_name: node.right.featureName,
      animals: parseAnimals(node.right.animals),
      depth,
      position: 2,
    });
    for (const child of node.children) {
      walk(child, depth + 1);
    }
  }

  for (const s of splits) walk(s, 1);
  return rows;
}

/* ── Editable tree split component ── */
function SplitEditor({
  split,
  onChange,
  onRemove,
  onAddChild,
  depth = 0,
}: {
  split: SplitNode;
  onChange: (updated: SplitNode) => void;
  onRemove: () => void;
  onAddChild: (parentFeatureName: string) => void;
  depth?: number;
}) {
  const leftChildSplit = split.children.find((c) => c.parentLabel === split.left.featureName);
  const rightChildSplit = split.children.find((c) => c.parentLabel === split.right.featureName);

  const updateLeft = (field: "featureName" | "animals", val: string) => {
    const updated = { ...split, left: { ...split.left, [field]: val } };
    // If feature name changed, update child's parentLabel
    if (field === "featureName" && leftChildSplit) {
      updated.children = updated.children.map((c) =>
        c.parentLabel === split.left.featureName ? { ...c, parentLabel: val } : c,
      );
    }
    onChange(updated);
  };
  const updateRight = (field: "featureName" | "animals", val: string) => {
    const updated = { ...split, right: { ...split.right, [field]: val } };
    if (field === "featureName" && rightChildSplit) {
      updated.children = updated.children.map((c) =>
        c.parentLabel === split.right.featureName ? { ...c, parentLabel: val } : c,
      );
    }
    onChange(updated);
  };

  const removeChildSplit = (parentFeature: string) => {
    // Remove child split and any descendants
    function removeRecursive(nodes: SplitNode[], target: string): SplitNode[] {
      return nodes.filter((c) => c.parentLabel !== target).map((c) => ({
        ...c,
        children: removeRecursive(c.children, target),
      }));
    }
    onChange({ ...split, children: removeRecursive(split.children, parentFeature) });
  };

  const updateChildSplit = (parentFeature: string, updated: SplitNode) => {
    onChange({
      ...split,
      children: split.children.map((c) => (c.parentLabel === parentFeature ? updated : c)),
    });
  };

  const bgColors = ["bg-blue-50 dark:bg-blue-950/30", "bg-green-50 dark:bg-green-950/30", "bg-purple-50 dark:bg-purple-950/30", "bg-orange-50 dark:bg-orange-950/30"];
  const borderColors = ["border-blue-200 dark:border-blue-800", "border-green-200 dark:border-green-800", "border-purple-200 dark:border-purple-800", "border-orange-200 dark:border-orange-800"];
  const bg = bgColors[depth % bgColors.length];
  const border = borderColors[depth % borderColors.length];

  return (
    <div className={`rounded-lg border-2 ${border} ${bg} p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitBranchPlus className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Split:</span>
          <Input
            value={split.parentLabel}
            onChange={(e) => onChange({ ...split, parentLabel: e.target.value })}
            className="h-7 text-sm font-semibold w-48 bg-white dark:bg-background"
            placeholder="Parent category name"
          />
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      {/* Two columns: left & right */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left branch */}
        <div className="border rounded-lg p-3 space-y-2 bg-white/60 dark:bg-background/40">
          <label className="text-xs font-medium text-muted-foreground">← Left Category</label>
          <Input
            value={split.left.featureName}
            onChange={(e) => updateLeft("featureName", e.target.value)}
            placeholder="Feature name"
            className="text-sm font-medium"
          />
          <label className="text-xs text-muted-foreground">Animals (comma-separated)</label>
          <textarea
            value={split.left.animals}
            onChange={(e) => updateLeft("animals", e.target.value)}
            rows={2}
            className="w-full text-xs font-mono border rounded p-2 bg-muted/50"
            placeholder="நாய், பூனை"
          />
          <div className="flex flex-wrap gap-1 min-h-[20px]">
            {split.left.animals.split(",").map((a) => a.trim()).filter(Boolean).map((a) => (
              <span key={a} className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full">{a}</span>
            ))}
          </div>
          {/* Child split or add button */}
          {leftChildSplit ? (
            <SplitEditor
              split={leftChildSplit}
              onChange={(u) => updateChildSplit(split.left.featureName, u)}
              onRemove={() => removeChildSplit(split.left.featureName)}
              onAddChild={onAddChild}
              depth={depth + 1}
            />
          ) : (
            split.left.featureName.trim() && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => onAddChild(split.left.featureName)}
              >
                <Plus className="h-3 w-3 mr-1" /> Split "{split.left.featureName}" further
              </Button>
            )
          )}
        </div>

        {/* Right branch */}
        <div className="border rounded-lg p-3 space-y-2 bg-white/60 dark:bg-background/40">
          <label className="text-xs font-medium text-muted-foreground">→ Right Category</label>
          <Input
            value={split.right.featureName}
            onChange={(e) => updateRight("featureName", e.target.value)}
            placeholder="Feature name"
            className="text-sm font-medium"
          />
          <label className="text-xs text-muted-foreground">Animals (comma-separated)</label>
          <textarea
            value={split.right.animals}
            onChange={(e) => updateRight("animals", e.target.value)}
            rows={2}
            className="w-full text-xs font-mono border rounded p-2 bg-muted/50"
            placeholder="சுறா, கழுகு"
          />
          <div className="flex flex-wrap gap-1 min-h-[20px]">
            {split.right.animals.split(",").map((a) => a.trim()).filter(Boolean).map((a) => (
              <span key={a} className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full">{a}</span>
            ))}
          </div>
          {rightChildSplit ? (
            <SplitEditor
              split={rightChildSplit}
              onChange={(u) => updateChildSplit(split.right.featureName, u)}
              onRemove={() => removeChildSplit(split.right.featureName)}
              onAddChild={onAddChild}
              depth={depth + 1}
            />
          ) : (
            split.right.featureName.trim() && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => onAddChild(split.right.featureName)}
              >
                <Plus className="h-3 w-3 mr-1" /> Split "{split.right.featureName}" further
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Read-only tree view component ── */
function TreeView({ nodes }: { nodes: AnswerNodeRow[] }) {
  const tree = dbNodesToTree(nodes);
  if (tree.length === 0) return <p className="text-xs text-muted-foreground">No answer tree defined.</p>;

  function RenderSplit({ split, depth = 0 }: { split: SplitNode; depth?: number }) {
    const childL = split.children.find((c) => c.parentLabel === split.left.featureName);
    const childR = split.children.find((c) => c.parentLabel === split.right.featureName);
    const leftAnimals = split.left.animals.split(",").map((a) => a.trim()).filter(Boolean);
    const rightAnimals = split.right.animals.split(",").map((a) => a.trim()).filter(Boolean);

    return (
      <div className="space-y-2">
        <div className="text-sm font-semibold flex items-center gap-1">
          <GitBranchPlus className="h-3.5 w-3.5 text-muted-foreground" />
          {split.parentLabel}
        </div>
        <div className="grid grid-cols-2 gap-3 ml-4">
          <div className="border rounded-lg p-2 bg-muted/20">
            <div className="text-xs font-medium mb-1">{split.left.featureName}</div>
            <div className="flex flex-wrap gap-1">
              {leftAnimals.map((a) => (
                <span key={a} className="bg-green-500/10 text-green-700 text-[10px] px-1.5 py-0.5 rounded-full">{a}</span>
              ))}
            </div>
            {childL && <div className="mt-2"><RenderSplit split={childL} depth={depth + 1} /></div>}
          </div>
          <div className="border rounded-lg p-2 bg-muted/20">
            <div className="text-xs font-medium mb-1">{split.right.featureName}</div>
            <div className="flex flex-wrap gap-1">
              {rightAnimals.map((a) => (
                <span key={a} className="bg-green-500/10 text-green-700 text-[10px] px-1.5 py-0.5 rounded-full">{a}</span>
              ))}
            </div>
            {childR && <div className="mt-2"><RenderSplit split={childR} depth={depth + 1} /></div>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Answer Tree</label>
      {tree.map((s, i) => <RenderSplit key={i} split={s} />)}
    </div>
  );
}

/* ── Main Component ── */
export default function DichotomousAdminPage() {
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [nodesMap, setNodesMap] = useState<Record<number, AnswerNodeRow[]>>({});
  const [loading, setLoading] = useState(true);

  // editing question
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAnimals, setEditAnimals] = useState("");
  const [editFeatures, setEditFeatures] = useState("");
  const [editTimer, setEditTimer] = useState(180);
  const [editTree, setEditTree] = useState<SplitNode[]>([]);
  const [saving, setSaving] = useState(false);

  // adding new question
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAnimals, setNewAnimals] = useState("");
  const [newFeatures, setNewFeatures] = useState("");
  const [newTimer, setNewTimer] = useState(180);

  const db: any = supabase;

  const fetchAll = async () => {
    setLoading(true);
    const { data: qData } = await db
      .from("dichotomous_questions")
      .select("id, title, description, animals, features, timer_seconds")
      .order("id", { ascending: true });
    const qs: QuestionRow[] = qData ?? [];
    setQuestions(qs);

    const map: Record<number, AnswerNodeRow[]> = {};
    for (const q of qs) {
      const { data: nData } = await db
        .from("dichotomous_answer_nodes")
        .select("id, question_id, parent_label, feature_name, animals, depth, position")
        .eq("question_id", q.id)
        .order("depth", { ascending: true })
        .order("position", { ascending: true });
      map[q.id] = nData ?? [];
    }
    setNodesMap(map);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  /* ── Edit existing question ── */
  const startEdit = (q: QuestionRow) => {
    setEditingId(q.id);
    setEditTitle(q.title);
    setEditDescription(q.description ?? "");
    setEditAnimals((q.animals as string[]).join(", "));
    setEditFeatures((q.features as string[]).join(", "));
    setEditTimer(q.timer_seconds);
    setEditTree(dbNodesToTree(nodesMap[q.id] ?? []));
  };

  const cancelEdit = () => setEditingId(null);

  /** Add a new child split under a feature name */
  const addChildSplit = (parentFeatureName: string) => {
    const newSplit: SplitNode = {
      parentLabel: parentFeatureName,
      left: { featureName: "", animals: "" },
      right: { featureName: "", animals: "" },
      children: [],
    };

    function insertInto(nodes: SplitNode[]): SplitNode[] {
      return nodes.map((n) => {
        // Check if this split's left or right matches
        if (n.left.featureName === parentFeatureName) {
          return { ...n, children: [...n.children, newSplit] };
        }
        if (n.right.featureName === parentFeatureName) {
          return { ...n, children: [...n.children, newSplit] };
        }
        // Recurse into children
        return { ...n, children: insertInto(n.children) };
      });
    }

    setEditTree((prev) => insertInto(prev));
  };

  const addRootSplit = () => {
    setEditTree((prev) => [
      ...prev,
      {
        parentLabel: editTitle || "Root",
        left: { featureName: "", animals: "" },
        right: { featureName: "", animals: "" },
        children: [],
      },
    ]);
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    setSaving(true);

    const animalsArr = editAnimals.split(",").map((s) => s.trim()).filter(Boolean);
    const featuresArr = editFeatures.split(",").map((s) => s.trim()).filter(Boolean);

    const { error: qErr } = await db
      .from("dichotomous_questions")
      .update({
        title: editTitle,
        description: editDescription || null,
        animals: animalsArr,
        features: featuresArr,
        timer_seconds: editTimer,
      })
      .eq("id", editingId);

    if (qErr) {
      toast.error("Failed to update question: " + qErr.message);
      setSaving(false);
      return;
    }

    // Delete old nodes and re-insert from tree
    await db.from("dichotomous_answer_nodes").delete().eq("question_id", editingId);

    const flatNodes = treeToDbNodes(editTree, editingId);
    for (const n of flatNodes) {
      const { error: nErr } = await db.from("dichotomous_answer_nodes").insert(n);
      if (nErr) {
        toast.error("Failed to save answer node: " + nErr.message);
        setSaving(false);
        return;
      }
    }

    toast.success("Question updated!");
    setSaving(false);
    setEditingId(null);
    fetchAll();
  };

  /* ── Add new question ── */
  const handleAddQuestion = async () => {
    if (!newTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    const animalsArr = newAnimals.split(",").map((s) => s.trim()).filter(Boolean);
    const featuresArr = newFeatures.split(",").map((s) => s.trim()).filter(Boolean);

    const { error } = await db.from("dichotomous_questions").insert({
      title: newTitle,
      description: newDescription || null,
      animals: animalsArr,
      features: featuresArr,
      timer_seconds: newTimer,
    });

    if (error) {
      toast.error("Failed to add question: " + error.message);
      setSaving(false);
      return;
    }

    toast.success("Question added! You can now edit it to add answer nodes.");
    setSaving(false);
    setAdding(false);
    setNewTitle("");
    setNewDescription("");
    setNewAnimals("");
    setNewFeatures("");
    setNewTimer(180);
    fetchAll();
  };

  /* ── Delete question ── */
  const handleDelete = async (id: number) => {
    if (!confirm("Delete this question and all its answer nodes?")) return;
    const { error } = await db.from("dichotomous_questions").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete: " + error.message);
      return;
    }
    toast.success("Question deleted.");
    if (editingId === id) setEditingId(null);
    fetchAll();
  };

  if (loading) {
    return <p className="text-center text-muted-foreground p-8">Loading dichotomous questions...</p>;
  }

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold">Dichotomous Tree — Questions & Answers</h2>
        {!adding && (
          <Button onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Question
          </Button>
        )}
      </div>

      {/* Add new question form */}
      {adding && (
        <Card className="glass-card border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">New Question</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Question title" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="Optional description" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Animals (comma-separated)</label>
              <textarea
                value={newAnimals}
                onChange={(e) => setNewAnimals(e.target.value)}
                rows={2}
                className="w-full font-mono text-sm border rounded-lg p-3 bg-muted"
                placeholder="நாய், பூனை, சிங்கம்"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Features (comma-separated)</label>
              <textarea
                value={newFeatures}
                onChange={(e) => setNewFeatures(e.target.value)}
                rows={2}
                className="w-full font-mono text-sm border rounded-lg p-3 bg-muted"
                placeholder="கால்கள் உண்டு, கால்கள் இல்லை"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Timer (seconds)</label>
              <Input type="number" min={30} value={newTimer} onChange={(e) => setNewTimer(Math.max(30, parseInt(e.target.value || "180", 10)))} />
            </div>
            <div className="flex gap-3">
              <Button onClick={handleAddQuestion} disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> {saving ? "Saving..." : "Save"}
              </Button>
              <Button variant="outline" onClick={() => setAdding(false)} disabled={saving}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {questions.length === 0 && !adding && (
        <p className="text-center text-muted-foreground">No questions yet. Click "Add Question" to create one.</p>
      )}

      {/* Question list */}
      {questions.map((q) => {
        const isEditing = editingId === q.id;
        const qNodes = nodesMap[q.id] ?? [];

        return (
          <Card key={q.id} className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">
                #{q.id} — {isEditing ? "Editing" : q.title}
              </CardTitle>
              <div className="flex gap-2">
                {!isEditing && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => startEdit(q)}>
                      <Pencil className="h-4 w-4 mr-1" /> Edit
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(q.id)}>
                      <Trash2 className="h-4 w-4 mr-1" /> Delete
                    </Button>
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Title</label>
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description</label>
                    <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Animals (comma-separated)</label>
                    <textarea
                      value={editAnimals}
                      onChange={(e) => setEditAnimals(e.target.value)}
                      rows={2}
                      className="w-full font-mono text-sm border rounded-lg p-3 bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Features (comma-separated)</label>
                    <textarea
                      value={editFeatures}
                      onChange={(e) => setEditFeatures(e.target.value)}
                      rows={2}
                      className="w-full font-mono text-sm border rounded-lg p-3 bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Timer (seconds)</label>
                    <Input
                      type="number"
                      min={30}
                      value={editTimer}
                      onChange={(e) => setEditTimer(Math.max(30, parseInt(e.target.value || "180", 10)))}
                    />
                  </div>

                  {/* Tree-based Answer Editor */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">🌳 Answer Tree (correct splits)</label>
                      {editTree.length === 0 && (
                        <Button variant="outline" size="sm" onClick={addRootSplit}>
                          <Plus className="h-4 w-4 mr-1" /> Add Root Split
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Define the tree by splitting categories. Each split has a parent category with two child branches (left & right). 
                      Each branch has a feature name and its animals. Click "Split further" to add deeper levels.
                    </p>
                    {editTree.map((split, idx) => (
                      <SplitEditor
                        key={idx}
                        split={split}
                        onChange={(updated) => setEditTree((prev) => prev.map((s, i) => (i === idx ? updated : s)))}
                        onRemove={() => setEditTree((prev) => prev.filter((_, i) => i !== idx))}
                        onAddChild={addChildSplit}
                      />
                    ))}
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
                  {q.description && <p className="text-sm text-muted-foreground">{q.description}</p>}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Timer:</span> {q.timer_seconds}s ({Math.round(q.timer_seconds / 60)} min)
                    </div>
                    <div>
                      <span className="text-muted-foreground">Animals:</span> {(q.animals as string[]).length}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Animals</label>
                    <div className="flex flex-wrap gap-1">
                      {(q.animals as string[]).map((a) => (
                        <span key={a} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full">{a}</span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Features</label>
                    <div className="flex flex-wrap gap-1">
                      {(q.features as string[]).map((f) => (
                        <span key={f} className="bg-yellow-500/10 text-yellow-700 text-xs px-2 py-1 rounded-full">{f}</span>
                      ))}
                    </div>
                  </div>

                  <TreeView nodes={qNodes} />
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
