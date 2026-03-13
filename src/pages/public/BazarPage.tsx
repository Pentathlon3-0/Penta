import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Bell } from "lucide-react";

export default function BazarPage() {
  const [schoolName, setSchoolName] = useState("");
  const [step, setStep] = useState<"enter" | "press" | "done">("enter");
  const [pressing, setPressing] = useState(false);
  const [showRing, setShowRing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleContinue = () => {
    if (!schoolName.trim()) {
      toast.error("Please enter a school name");
      return;
    }
    setStep("press");
  };

  const handlePress = useCallback(async () => {
    if (pressing) return;
    setPressing(true);
    setShowRing(true);

    // Play bell sound
    try {
      const audio = new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg");
      audio.volume = 0.5;
      audio.play();
      audioRef.current = audio;
    } catch {}

    // Check if already pressed
    const { data: existing } = await supabase
      .from("bazar_presses")
      .select("*")
      .eq("school_name", schoolName.trim())
      .maybeSingle();

    if (existing && !existing.enabled) {
      toast.error("Your school has already pressed! Wait for admin to re-enable.");
      setPressing(false);
      setShowRing(false);
      return;
    }

    if (existing && existing.enabled) {
      // Re-press allowed
      await supabase
        .from("bazar_presses")
        .update({
          press_count: (existing.press_count || 0) + 1,
          pressed_at: new Date().toISOString(),
          enabled: false,
        })
        .eq("id", existing.id);
    } else {
      // First press
      await supabase.from("bazar_presses").insert({
        school_name: schoolName.trim(),
        press_count: 1,
        enabled: false,
      });
    }

    setTimeout(() => {
      setShowRing(false);
      setStep("done");
      toast.success("Bazar pressed successfully! 🔔");
    }, 800);
  }, [schoolName, pressing]);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      {step === "enter" && (
        <Card className="w-full max-w-md animate-scale-in glass-card">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-display">🔔 Bazar</CardTitle>
            <p className="text-muted-foreground text-sm mt-1">Enter your school name to continue</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Enter School Name"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              className="text-center text-lg"
            />
            <Button onClick={handleContinue} className="w-full" size="lg">
              Continue
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "press" && (
        <div className="flex flex-col items-center gap-8 animate-fade-in">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            {schoolName}
          </h2>
          <div className="relative">
            {showRing && (
              <div className="absolute inset-0 rounded-full bg-accent/30 bazar-ring" />
            )}
            <button
              onClick={handlePress}
              disabled={pressing}
              className="bazar-button bazar-button-pulse w-48 h-48 flex flex-col items-center justify-center text-xl font-display font-bold cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
            >
              <Bell className="h-12 w-12 mb-2" />
              Press Bazar
            </button>
          </div>
          <p className="text-muted-foreground text-sm">Tap the button to ring the bazar!</p>
        </div>
      )}

      {step === "done" && (
        <Card className="w-full max-w-md animate-scale-in glass-card text-center">
          <CardContent className="pt-8 pb-8">
            <div className="text-6xl mb-4">🔔</div>
            <h2 className="font-display text-2xl font-bold mb-2">Bazar Pressed!</h2>
            <p className="text-muted-foreground">
              <strong>{schoolName}</strong> has pressed the bazar bell.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
