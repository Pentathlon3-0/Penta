import { Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Bell, Code, Eye, FileEdit, LayoutDashboard, LogOut, TreePine, Trophy, FileText } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  // { title: "Bazar", url: "/dashboard/bazar", icon: Bell }, // removed
  { title: "Coding", url: "/dashboard/coding", icon: Code },
  { title: "Expected Output", url: "/dashboard/expected-output", icon: Eye },
];

function AppSidebar() {
  const { signOut, isAdmin, roles } = useAuth();
  const location = useLocation();
  const controlRoutes = [
    "/dashboard/quiz-admin",
    "/dashboard/team-setup",
    "/dashboard/edit-question",
    "/dashboard/dichotomous-admin",
  ];
  const isControlRoute = controlRoutes.some((route) => location.pathname.startsWith(route));
  const isScoreboardRoute =
    location.pathname.startsWith("/dashboard/scoreboard") ||
    location.pathname.startsWith("/dashboard/livescore") ||
    location.pathname.startsWith("/dashboard/player-performance");
  const [roundsOpen, setRoundsOpen] = useState(false);
  const [controlOpen, setControlOpen] = useState(isControlRoute);
  const [scoreboardOpen, setScoreboardOpen] = useState(isScoreboardRoute);

  useEffect(() => {
    if (isControlRoute) {
      setControlOpen(true);
    }
  }, [isControlRoute]);

  useEffect(() => {
    if (isScoreboardRoute) {
      setScoreboardOpen(true);
    }
  }, [isScoreboardRoute]);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="font-display text-xs uppercase tracking-wider">
             Pentathlon
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/dashboard"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {/* scoreboard collapsible group */}
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setScoreboardOpen((o) => !o)}>
                  <Trophy className="mr-2 h-4 w-4" />
                  <span>Scoreboard {scoreboardOpen ? '▲' : '▼'}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {scoreboardOpen && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/dashboard/scoreboard"
                        className="hover:bg-sidebar-accent/50 pl-6"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <Trophy className="mr-2 h-4 w-4" />
                        <span>Scoreboard</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/dashboard/school-quiz-progress"
                        className="hover:bg-sidebar-accent/50 pl-6"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <Trophy className="mr-2 h-4 w-4" />
                        <span>Clever Mind Score</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {isAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to="/dashboard/livescore"
                          className="hover:bg-sidebar-accent/50 pl-6"
                          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        >
                          <Trophy className="mr-2 h-4 w-4" />
                          <span>Live Score</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {isAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to="/dashboard/player-performance"
                          className="hover:bg-sidebar-accent/50 pl-6"
                          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                        >
                          <Trophy className="mr-2 h-4 w-4" />
                          <span>Player Performance</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </>
              )}
              {isAdmin && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/dashboard/dichotomous-scoreboard"
                        className="hover:bg-sidebar-accent/50 pl-6"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <Trophy className="mr-2 h-4 w-4" />
                        <span>Dichotomous Scores</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {/* control collapsible group */}
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setControlOpen((o) => !o)}>
                      <FileText className="mr-2 h-4 w-4" />
                      <span>Control {controlOpen ? '▲' : '▼'}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {controlOpen && (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to="/dashboard/quiz-admin"
                            className="hover:bg-sidebar-accent/50 pl-6"
                            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            <span>Clever Mind Question Control</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to="/dashboard/team-setup"
                            className="hover:bg-sidebar-accent/50 pl-6"
                            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                          >
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            <span>Team Setup</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to="/dashboard/edit-question"
                            className="hover:bg-sidebar-accent/50 pl-6"
                            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                          >
                            <FileEdit className="mr-2 h-4 w-4" />
                            <span>HTML Question Control</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to="/dashboard/dichotomous-admin"
                            className="hover:bg-sidebar-accent/50 pl-6"
                            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                          >
                            <TreePine className="mr-2 h-4 w-4" />
                            <span>Dichotomous Tree</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to="/dashboard/edit-knockout-scores"
                            className="hover:bg-sidebar-accent/50 pl-6"
                            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                          >
                            <FileEdit className="mr-2 h-4 w-4" />
                            <span>Edit Knockout Scores</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </>
                  )}
                  {/* Danger Zone link for admins */}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/dashboard/danger-zone"
                        className="hover:bg-red-900/40 text-red-400 font-semibold"
                        activeClassName="bg-red-900 text-red-200 font-bold"
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        <span>Danger Zone</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {/* rounds collapsible group */}
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setRoundsOpen(o => !o)}>
                      <Code className="mr-2 h-4 w-4" />
                      <span>Rounds {roundsOpen ? '▲' : '▼'}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {roundsOpen && (
                    <>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to="/dashboard/round1"
                            className="hover:bg-sidebar-accent/50 pl-6"
                            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                          >
                            <Code className="mr-2 h-4 w-4" />
                            <span>Knockout Round</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to="/dashboard/round2"
                            className="hover:bg-sidebar-accent/50 pl-6"
                            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                          >
                            <Code className="mr-2 h-4 w-4" />
                            <span>Qualifier Round</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to="/dashboard/round3"
                            className="hover:bg-sidebar-accent/50 pl-6"
                            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                          >
                            <Code className="mr-2 h-4 w-4" />
                            <span>Final Round</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </>
                  )}
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <div className="px-3 py-2">
              <p className="text-xs text-sidebar-foreground/60 mb-2">
                Role: {isAdmin ? "Admin" : "Member"}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sidebar-foreground/80 hover:text-sidebar-foreground"
                onClick={signOut}
              >
                <LogOut className="mr-2 h-4 w-4" /> Logout
              </Button>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

export default function DashboardLayout() {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b px-4 bg-card/50 backdrop-blur-sm">
            <SidebarTrigger />
            <h2 className="ml-3 font-display font-semibold text-lg">Dashboard</h2>
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
