import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Code, Shield } from "lucide-react";
import { supabase } from "../../integrations/supabase/client";

export default function DashboardHome() {
  const { user, isAdmin, roles } = useAuth();

  const [membersList, setMembersList] = useState<{
    user_id: string;
    email: string;
    role: string;
  }[]>([]);

  const isSuper = roles.includes("super_admin");

  useEffect(() => {
    if (isSuper) {
      loadMembers();
    }
  }, [isSuper]);

  const loadMembers = async () => {
    // fetch user_roles then fetch matching profiles separately. We can't rely
    // on Supabase's automatic relationship inference because no foreign key
    // constraint exists between those tables, hence the earlier 400 error.
    const [{ data: rolesData, error: rolesError }, { data: profilesData, error: profilesError }] =
      await Promise.all([
        supabase
          .from("user_roles")
          .select("user_id, role")
          .neq("role", "super_admin")
          .order("role", { ascending: true }),
        supabase
          .from("profiles")
          .select("user_id, email"),
      ] as any);

    if (rolesError) {
      console.error("loadMembers error", rolesError);
      return;
    }
    if (profilesError) {
      console.error("loadMembers profiles fetch error", profilesError);
    }

    const profilesById: Record<string, string> = {};
    (profilesData || []).forEach((p: any) => {
      if (p.user_id && p.email) profilesById[p.user_id] = p.email;
    });

    setMembersList(
      (rolesData || []).map((r: any) => ({
        user_id: r.user_id,
        email: profilesById[r.user_id] || r.user_id,
        role: r.role,
      }))
    );
  };

  const promote = async (userId: string) => {
    const { error } = await supabase
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" });
    if (error) {
      console.error("promote error", error);
    } else {
      loadMembers();
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-bold">Welcome back!</h1>
        <p className="text-muted-foreground mt-1">{user?.email}</p>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Role</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-display font-bold capitalize">
              {isAdmin ? "Admin" : "Member"}
            </p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bazar</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">View bazar presses from the sidebar</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Coding</CardTitle>
            <Code className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">View coding submissions from the sidebar</p>
          </CardContent>
        </Card>
      </div>

      {isSuper && (
        <div className="mt-8">
          <h2 className="font-display text-2xl font-bold">User management</h2>
          <table className="w-full mt-4 table-auto text-white">
            <thead>
              <tr>
                <th className="border px-2 py-1">Email</th>
                <th className="border px-2 py-1">Role</th>
                <th className="border px-2 py-1">Action</th>
              </tr>
            </thead>
            <tbody>
              {membersList.map(m => (
                <tr key={m.user_id}>
                  <td className="border px-2 py-1">{m.email}</td>
                  <td className="border px-2 py-1 capitalize">{m.role}</td>
                  <td className="border px-2 py-1">
                    {m.role === "member" && (
                      <button
                        className="text-blue-400 underline"
                        onClick={() => promote(m.user_id)}
                      >
                        promote
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
