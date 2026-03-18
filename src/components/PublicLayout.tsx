import { Link, Outlet, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Bell, Code, LogIn, TreePine } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export default function PublicLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const isActive = (path: string) => location.pathname === path;
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      {!isFullscreen && (
        <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/" className="font-display text-xl font-bold text-primary">
          Pentathlon
          </Link>
          <nav className="flex items-center gap-2">
            {/* Bazar button removed */}
            <Button variant={isActive("/coding") ? "default" : "ghost"} size="sm" asChild>
              <Link to="/coding"><Code className="mr-1.5 h-4 w-4" /> Code Wizard</Link>
            </Button>
            <Button variant={isActive("/dichotomous") ? "default" : "ghost"} size="sm" asChild>
              <Link to="/dichotomous"><TreePine className="mr-1.5 h-4 w-4" /> Dichotomous</Link>
            </Button>
            <Button variant={isActive("/password") ? "default" : "ghost"} size="sm" asChild>
              <Link to="/password" className="inline-flex items-center gap-1.5">
                <span className="leading-none">💡</span>
                <span>Clever Minds</span>
              </Link>
            </Button>
            
          </nav>
        </div>
      </header>
      )}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
