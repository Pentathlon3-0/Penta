import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DangerZoneAdmin() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState("");
  const [notifSuccess, setNotifSuccess] = useState("");

  const handleDeleteAll = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      // Delete all relevant data (add more tables as needed)
      // Reset all columns except school_id in final_round
      await (supabase as any)
        .from("final_round")
        .update({
          clever_mind_score: 0,
          brain_maze_score: 0,
          buzar_performance: {},
          buzar_score: 0
        })
        .not("school_id", "is", null);
      await (supabase as any).from("school_quiz_progress").delete().neq("school_name", "");
      await (supabase as any).from("quiz_scores").delete().neq("school_name", "");
      // Add more delete statements for other tables if needed
      setSuccess("All competition data deleted successfully.");
    } catch (err) {
      setError("Failed to delete data. Check Supabase policies and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handler for deleting all live_notifications
  const handleDeleteNotifications = async () => {
    setNotifLoading(true);
    setNotifError("");
    setNotifSuccess("");
    try {
      await (supabase as any).from("live_notifications").delete().not("id", "is", null);
      setNotifSuccess("All live notifications deleted successfully.");
    } catch (err) {
      setNotifError("Failed to delete notifications. Check Supabase policies and try again.");
    } finally {
      setNotifLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-8 mt-12">
      {/* Danger Zone Card for Round 3 Data */}
      <Card className="w-full max-w-lg bg-[#1a1a1a] text-white border border-red-700/40 shadow-2xl rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl font-bold text-red-500">Danger Zone</CardTitle>
          <div className="text-lg font-semibold text-red-400 mt-1">Round 3 Data</div>
          <p className="text-sm text-white/70 mt-2">This action will permanently delete all competition data. This cannot be undone.</p>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          <Button
            onClick={handleDeleteAll}
            className="bg-red-600 hover:bg-red-700 text-white w-full py-3 text-lg font-semibold"
            disabled={loading}
          >
            {loading ? "Deleting..." : "Delete Round 3 Data"}
          </Button>
          {error && <div className="text-red-400 text-sm">{error}</div>}
          {success && <div className="text-green-400 text-sm">{success}</div>}
        </CardContent>
      </Card>

      {/* New Card for Live Notifications */}
      <Card className="w-full max-w-lg bg-[#1a1a1a] text-white border border-yellow-700/40 shadow-2xl rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-2xl font-bold text-yellow-500">Live Notifications</CardTitle>
          <div className="text-lg font-semibold text-yellow-400 mt-1">Delete All Notifications</div>
          <p className="text-sm text-white/70 mt-2">This will permanently delete all live notifications from the system.</p>
        </CardHeader>
        <CardContent className="space-y-6 pt-2">
          <Button
            onClick={handleDeleteNotifications}
            className="bg-yellow-600 hover:bg-yellow-700 text-white w-full py-3 text-lg font-semibold"
            disabled={notifLoading}
          >
            {notifLoading ? "Deleting..." : "Delete All Notifications"}
          </Button>
          {notifError && <div className="text-yellow-400 text-sm">{notifError}</div>}
          {notifSuccess && <div className="text-green-400 text-sm">{notifSuccess}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
