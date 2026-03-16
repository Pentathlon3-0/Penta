import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bell, Code, LogIn, TreePine, Lock } from "lucide-react";

export default function Index() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <div className="text-center space-y-8 animate-fade-in max-w-2xl">
        <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight">
        Pentathlon
        </h1>
        <p className="text-xl text-muted-foreground max-w-md mx-auto">
          The school competition platform. Access Clever Minds, take coding challenges, take dichotomous tree challenges, and compete!
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Button size="lg" asChild>
            <Link to="/password"><Lock className="mr-2 h-5 w-5" /> Clever Minds</Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/coding"><Code className="mr-2 h-5 w-5" /> Coding Challenge</Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/dichotomous"><TreePine className="mr-2 h-5 w-5" /> Dichotomous Tree</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
