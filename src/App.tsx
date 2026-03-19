import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import PublicLayout from "@/components/PublicLayout";
import DashboardLayout from "@/components/DashboardLayout";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";

import CodingPage from "@/pages/public/CodingPage";
import DichotomousTreePage from "@/pages/public/DichotomousTreePage";
import PasswordPage from "@/pages/public/PasswordPage";
import DashboardHome from "@/pages/dashboard/DashboardHome";
// import DashboardBazar from "@/pages/dashboard/DashboardBazar";
import DashboardCoding from "@/pages/dashboard/DashboardCoding";
import TeamSetupPage from "@/pages/dashboard/TeamSetupPage";
import ScoreboardPage from "@/pages/dashboard/ScoreboardPage";
import FinalScoreboardPage from "@/pages/dashboard/FinalScoreboardPage";
import Round1Page from "@/pages/dashboard/Round1Page";
import Round2Page from "@/pages/dashboard/Round2Page";
import Round3Page from "@/pages/dashboard/Round3Page";
import LivescorePage from "@/pages/dashboard/LivescorePage";
import PlayerPerformancePage from "@/pages/dashboard/PlayerPerformancePage";
import SchoolQuizProgressPage from "@/pages/dashboard/SchoolQuizProgressPage";
import ExpectedOutputPage from "@/pages/dashboard/ExpectedOutputPage";
import EditQuestionPage from "@/pages/dashboard/EditQuestionPage";
import EditKnockoutScores from "@/pages/dashboard/EditKnockoutScores";
import DichotomousAdminPage from "@/pages/dashboard/DichotomousAdminPage";

import DichotomousScoreboardPage from "@/pages/dashboard/DichotomousScoreboardPage";
import QuizAdminPage from "@/pages/dashboard/QuizAdminPage";
import DangerZoneAdmin from "@/pages/dashboard/DangerZoneAdmin";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Router>
          <Routes>
            {/* Public routes with top navbar */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Index />} />
              {/* <Route path="/bazar" element={<BazarPage />} /> BazarPage removed */}
              <Route path="/coding" element={<CodingPage />} />
              <Route path="/coding/:schoolName" element={<CodingPage />} />
              <Route path="/dichotomous" element={<DichotomousTreePage />} />
              <Route path="/dichotomous/:schoolName" element={<DichotomousTreePage />} />
              <Route path="/dichotomous/:schoolName/:questionId" element={<DichotomousTreePage />} />
              <Route path="/dichotomous/:schoolName/:questionId/game" element={<DichotomousTreePage />} />
              <Route path="/password" element={<PasswordPage />} />
            </Route>

            {/* Auth routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Protected dashboard routes with sidebar */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardHome />} />
              {/* <Route path="bazar" element={<DashboardBazar />} /> DashboardBazar removed */}
              <Route path="coding" element={<DashboardCoding />} />
              <Route path="scoreboard" element={<ScoreboardPage />} />
              <Route path="final-scoreboard" element={<FinalScoreboardPage />} />
              <Route path="livescore" element={<LivescorePage />} />
              <Route path="player-performance" element={<PlayerPerformancePage />} />
              <Route path="school-quiz-progress" element={<SchoolQuizProgressPage />} />
              <Route path="expected-output" element={<ExpectedOutputPage />} />
              {/* admin-only pages */}
              <Route path="edit-question" element={<EditQuestionPage />} />
              <Route path="edit-knockout-scores" element={<EditKnockoutScores />} />
              <Route path="dichotomous-admin" element={<DichotomousAdminPage />} />
              <Route path="dichotomous-scoreboard" element={<DichotomousScoreboardPage />} />
              <Route path="team-setup" element={<TeamSetupPage />} />
              <Route path="round1" element={<Round1Page />} />
              <Route path="round2" element={<Round2Page />} />
              <Route path="round3" element={<Round3Page />} />
              <Route path="quiz-admin" element={<QuizAdminPage />} />
              {/* Danger Zone admin page (admin only) */}
              <Route path="danger-zone" element={<DangerZoneAdmin />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
