-- Fix dichotomous tables RLS policies to use is_admin() function
-- which is SECURITY DEFINER and bypasses user_roles RLS

-- ── dichotomous_questions ──
DROP POLICY IF EXISTS "dq_admin_insert" ON dichotomous_questions;
DROP POLICY IF EXISTS "dq_admin_update" ON dichotomous_questions;
DROP POLICY IF EXISTS "dq_admin_delete" ON dichotomous_questions;

CREATE POLICY "dq_admin_insert" ON dichotomous_questions FOR INSERT WITH CHECK (
  public.is_admin(auth.uid())
);
CREATE POLICY "dq_admin_update" ON dichotomous_questions FOR UPDATE USING (
  public.is_admin(auth.uid())
);
CREATE POLICY "dq_admin_delete" ON dichotomous_questions FOR DELETE USING (
  public.is_admin(auth.uid())
);

-- ── dichotomous_answer_nodes ──
DROP POLICY IF EXISTS "dan_admin_insert" ON dichotomous_answer_nodes;
DROP POLICY IF EXISTS "dan_admin_update" ON dichotomous_answer_nodes;
DROP POLICY IF EXISTS "dan_admin_delete" ON dichotomous_answer_nodes;

CREATE POLICY "dan_admin_insert" ON dichotomous_answer_nodes FOR INSERT WITH CHECK (
  public.is_admin(auth.uid())
);
CREATE POLICY "dan_admin_update" ON dichotomous_answer_nodes FOR UPDATE USING (
  public.is_admin(auth.uid())
);
CREATE POLICY "dan_admin_delete" ON dichotomous_answer_nodes FOR DELETE USING (
  public.is_admin(auth.uid())
);

-- ── quiz_scores (also had the same pattern) ──
DROP POLICY IF EXISTS "quiz_scores_update" ON quiz_scores;
DROP POLICY IF EXISTS "quiz_scores_delete" ON quiz_scores;

CREATE POLICY "quiz_scores_update" ON quiz_scores FOR UPDATE USING (
  public.is_admin(auth.uid())
);
CREATE POLICY "quiz_scores_delete" ON quiz_scores FOR DELETE USING (
  public.is_admin(auth.uid())
);
