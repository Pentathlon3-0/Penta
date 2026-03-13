import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { RefreshCw, Trash2, Unlock } from "lucide-react";

interface BazarPress {
  id: string;
  school_name: string;
  pressed_at: string;
  press_count: number;
  enabled: boolean;
}

export default function DashboardBazar() {
  const [presses, setPresses] = useState<BazarPress[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();

  const fetchPresses = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bazar_presses")
      .select("*")
      .order("pressed_at", { ascending: false });
    setPresses((data as BazarPress[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPresses();
    const channel = supabase
      .channel("bazar-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "bazar_presses" }, () => {
        fetchPresses();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const enableSchool = async (id: string) => {
    await supabase.from("bazar_presses").update({ enabled: true }).eq("id", id);
    toast.success("School re-enabled!");
  };

  const clearAll = async () => {
    await supabase.from("bazar_presses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    toast.success("All bazar presses cleared!");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">🔔 Bazar Presses</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={fetchPresses}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <Button variant="destructive" size="sm" onClick={clearAll}>
              <Trash2 className="mr-1 h-4 w-4" /> Clear All
            </Button>
          )}
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School Name</TableHead>
                <TableHead>Pressed At</TableHead>
                <TableHead>Count</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {presses.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.school_name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(p.pressed_at).toLocaleString()}
                  </TableCell>
                  <TableCell>{p.press_count}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-1 rounded-full ${p.enabled ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                      {p.enabled ? "Enabled" : "Pressed"}
                    </span>
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => enableSchool(p.id)}
                        disabled={p.enabled}
                      >
                        <Unlock className="h-4 w-4 mr-1" /> Re-enable
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {presses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground py-8">
                    No bazar presses yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
