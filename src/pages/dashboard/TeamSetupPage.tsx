import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import "../../Styles/TeamSetupPage.css";
import { supabase } from "../../integrations/supabase/client";

type Team = {
  id?: string;
  name: string;
  members: string[];
  logo_path?: string | null; // storage path for logo
};

const TOTAL_TEAMS = 7;
const MEMBERS_PER_TEAM = 5;

import { useAuth } from "../../hooks/useAuth";

const TeamSetupPage = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();

  // redirect non-admins away (inside effect to avoid setState during render)
  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [loading, isAdmin, navigate]);

  const [step, setStep] = useState<"teams" | "members">("teams");
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const [teamNames, setTeamNames] = useState<string[]>(
    Array(TOTAL_TEAMS).fill("")
  );
  // file objects for new logos while setting up
  const [teamLogos, setTeamLogos] = useState<Array<File | null>>(Array(TOTAL_TEAMS).fill(null));

  const [members, setMembers] = useState<string[]>(
    Array(MEMBERS_PER_TEAM).fill("")
  );

  const [teams, setTeams] = useState<Team[]>([]);
  const [existingComplete, setExistingComplete] = useState(false); // have 7 teams with 5 members each

  // edit mode state
  const [editingTeamNames, setEditingTeamNames] = useState(false);
  const [editTeamNamesValues, setEditTeamNamesValues] = useState<string[]>([]);
  const [editingPlayersIndex, setEditingPlayersIndex] = useState<number | null>(null);
  const [editPlayerValues, setEditPlayerValues] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);

  // for existing logo change process
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [logoTargetIdx, setLogoTargetIdx] = useState<number | null>(null);
  // files chosen when editing existing team logos
  const [editLogos, setEditLogos] = useState<Array<File | null>>([]);

  // load existing team names from database on mount
  useEffect(() => {
    const fetchTeams = async () => {
      // include id so we can match players
      const { data, error } = await supabase.from("teams").select("id, name, logo_path");
      if (error) {
        console.error("Failed to fetch existing teams", error);
        return;
      }
      if (data && data.length >= TOTAL_TEAMS) {
        const teamRows: any[] = data.slice(0, TOTAL_TEAMS);
        console.log("fetched teams (first slice):", teamRows);
        const names = teamRows.map((t) => t.name);
        setTeamNames(names);

        // build teams array (include id and existing logo)
        const initialized: Team[] = teamRows.map((t, index) => ({
          id: t.id,
          name: t.name || `Team ${index + 1}`,
          members: [],
          logo_path: (t as any).logo_path || null,
        }));
        // populate logo preview state with existing urls
        setTeamLogos(initialized.map((t) => null)); // files not loaded from db

        // try load existing players for each team
        const { data: players, error: playersError } = await supabase
          .from("players")
          .select("team_id, name");
        if (playersError) {
          console.error("players fetch error", playersError);
        }
        if (players) {
          console.log("players loaded for initial teams:", players);
          initialized.forEach((team) => {
            team.members =
              players
                .filter((p) => p.team_id === team.id)
                .map((p) => p.name) || [];
          });

          // determine if every team has full member list
          // mark complete if we have correct number of teams and total players
          const totalPlayers = players.length;
          const complete =
            initialized.length === TOTAL_TEAMS &&
            totalPlayers >= TOTAL_TEAMS * MEMBERS_PER_TEAM;
          setExistingComplete(complete);

          // prepare flat member inputs for editing if not complete
          setMembers(
            initialized
              .map((t) =>
                Array(MEMBERS_PER_TEAM)
                  .fill("")
                  .map((_, i) => t.members[i] ?? "")
              )
              .flat()
              .slice(0, TOTAL_TEAMS * MEMBERS_PER_TEAM) // include all slots
          );
        }

        setTeams(initialized);
        setStep("members");
      }
    };
    fetchTeams();
  }, []);


  /* ---------- TEAM NAME STEP ---------- */

  const handleTeamNameChange = (index: number, value: string) => {
    const updated = [...teamNames];
    updated[index] = value;
    setTeamNames(updated);
  };

  const handleLogoChange = (index: number, file: File | null) => {
    const updated = [...teamLogos];
    updated[index] = file;
    setTeamLogos(updated);
  };

  const handleEditLogoChange = (index: number, file: File | null) => {
    const updated = [...editLogos];
    updated[index] = file;
    setEditLogos(updated);
  };

  const handleChangeExistingLogo = (index: number) => {
    setLogoTargetIdx(index);
    fileInputRef.current?.click();
  };

  const handleDeleteExistingLogo = async (index: number) => {
    const team = teams[index];
    if (!team.logo_path || !team.id) return;
    try {
      const db: any = supabase;
      console.log("attempting to remove", team.logo_path);
      const { data: remData, error: remErr } = await db.storage
        .from("School_logo")
        .remove([team.logo_path]);
      if (remErr) {
        console.warn("initial remove error", remErr);
        // try stripping public prefix if exists
        const altPath = team.logo_path.replace(/^public\//, "");
        if (altPath !== team.logo_path) {
          console.log("retrying remove with", altPath);
          const { error: remErr2 } = await db.storage
            .from("School_logo")
            .remove([altPath]);
          if (remErr2) throw remErr2;
        } else {
          throw remErr;
        }
      }
      console.log("remove result", remData);
      // clear path in database
      const { error: updErr } = await db
        .from("teams")
        .update({ logo_path: null })
        .eq("id", team.id);
      if (updErr) throw updErr;
      setTeams((prev) =>
        prev.map((t, i) => (i === index ? { ...t, logo_path: null } : t))
      );
    } catch (err) {
      console.error("Failed to delete existing logo", err);
      alert("Could not delete logo");
    }
  };

  const onFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (logoTargetIdx === null || file === null) return;
    try {
      const db: any = supabase;
      const team = teams[logoTargetIdx];
      if (!team.id) return;
      // remove old logo if present
      if (team.logo_path) {
        await db.storage.from("School_logo").remove([team.logo_path]);
      }
      // upload new file
      const { data, error } = await db.storage
        .from("School_logo")
        .upload(`team-${logoTargetIdx + 1}-${Date.now()}`, file);
      if (error) throw error;
      const newPath = data?.path || null;
      // update database
      const { error: updErr } = await db
        .from("teams")
        .update({ logo_path: newPath })
        .eq("id", team.id);
      if (updErr) throw updErr;
      setTeams((prev) =>
        prev.map((t, i) => (i === logoTargetIdx ? { ...t, logo_path: newPath } : t))
      );
    } catch (err) {
      console.error("Error uploading new logo", err);
      alert("Failed to change logo");
    } finally {
      setLogoTargetIdx(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const goToMembersStep = () => {
    const initializedTeams: Team[] = teamNames.map((name, index) => ({
      name: name || `Team ${index + 1}`,
      members: [],      logo_path: null,    }));

    setTeams(initializedTeams);
    setStep("members");
  };

  /* ---------- MEMBERS STEP ---------- */

  const handleMemberChange = (index: number, value: string) => {
    const updated = [...members];
    updated[index] = value;
    setMembers(updated);
  };

  const saveMembersAndNext = async () => {
    const updatedTeams = [...teams];

    updatedTeams[currentTeamIndex].members = members.map(
      (m, i) => m || `Member ${i + 1}`
    );

    setTeams(updatedTeams);
    setMembers(Array(MEMBERS_PER_TEAM).fill(""));

    if (currentTeamIndex < TOTAL_TEAMS - 1) {
      setCurrentTeamIndex(currentTeamIndex + 1);
    } else {
      // ✅ FINAL SAVE TO SUPABASE
      await saveTeamsToSupabase(updatedTeams);
    }
  };

  /* ---------- SUPABASE SAVE ---------- */

  const saveTeamsToSupabase = async (finalTeams: Team[]) => {
    try {
      setSaving(true);
      const db: any = supabase; // cast to any so that new tables bypass type checks

      // Try to clear old data (ignore errors if tables don't exist)
      try {
        await db.from("players").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      } catch { /* ignore */ }
      try {
        await db.from("teams").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      } catch { /* ignore */ }

      for (let idx = 0; idx < finalTeams.length; idx++) {
        const team = finalTeams[idx];

        // if a logo file was provided in setup, upload it
        let logoPath: string | null = null;
        if (teamLogos[idx]) {
          const { data: uploadData, error: uploadError } =
            await db.storage
              .from("School_logo")
              .upload(`team-${idx + 1}-${Date.now()}`, teamLogos[idx]!);
          if (uploadError) {
            console.error("Logo upload error", uploadError);
            throw uploadError;
          }
          logoPath = uploadData?.path || null;
        }

        // 1️⃣ Insert team row (include any uploaded logo path)
        const { data: teamData, error: teamError } = await db
          .from("teams")
          .insert([{ name: team.name, logo_path: logoPath }])
          .select()
          .single();

        if (teamError) {
          console.error("Team insert error:", JSON.stringify(teamError, null, 2));
          throw teamError;
        }

        // 2️⃣ Insert members
        const membersPayload = team.members.map((memberName) => ({
          team_id: teamData.id,
          name: memberName
        }));

        const { error: membersError } = await db
          .from("players")
          .insert(membersPayload);

        if (membersError) {
          console.error("Members insert error:", JSON.stringify(membersError, null, 2));
          throw membersError;
        }
      }

      alert("✅ Teams saved to database successfully!");
      navigate("/scoreboard");

    } catch (err) {
      console.error("❌ Supabase save error:", err);
      alert("Failed to save teams. Check console for details.");
    } finally {
      setSaving(false);
    }
  };

  /* ---------- EDIT HANDLERS ---------- */

  const startEditTeamNames = () => {
    setEditTeamNamesValues(teams.map((t) => t.name));
    setEditingTeamNames(true);
    setEditingPlayersIndex(null);
  };

  const cancelEditTeamNames = () => {
    setEditingTeamNames(false);
    setEditTeamNamesValues([]);
  };

  const updateTeamNames = async () => {
    try {
      setUpdating(true);
      const db: any = supabase;
      for (let i = 0; i < teams.length; i++) {
        if (teams[i].id && editTeamNamesValues[i] !== teams[i].name) {
          const { error } = await db
            .from("teams")
            .update({ name: editTeamNamesValues[i] })
            .eq("id", teams[i].id);
          if (error) throw error;
        }
      }
      // update local state
      setTeams((prev) =>
        prev.map((t, i) => ({ ...t, name: editTeamNamesValues[i] }))
      );
      setTeamNames(editTeamNamesValues);
      setEditingTeamNames(false);
    } catch (err) {
      console.error("Failed to update team names", err);
      alert("Failed to update team names.");
    } finally {
      setUpdating(false);
    }
  };

  const startEditPlayers = (teamIdx: number) => {
    const t = teams[teamIdx];
    const vals = Array(MEMBERS_PER_TEAM)
      .fill("")
      .map((_, i) => t.members[i] ?? "");
    setEditPlayerValues(vals);
    setEditingPlayersIndex(teamIdx);
    setEditingTeamNames(false);
  };

  const cancelEditPlayers = () => {
    setEditingPlayersIndex(null);
    setEditPlayerValues([]);
  };

  const updatePlayers = async () => {
    if (editingPlayersIndex === null) return;
    try {
      setUpdating(true);
      const db: any = supabase;
      const team = teams[editingPlayersIndex];

      // delete old players for this team
      await db.from("players").delete().eq("team_id", team.id);

      // insert new players
      const payload = editPlayerValues.map((name, i) => ({
        team_id: team.id,
        name: name || `Member ${i + 1}`,
      }));
      const { error } = await db.from("players").insert(payload);
      if (error) throw error;

      // update local state
      setTeams((prev) =>
        prev.map((t, i) =>
          i === editingPlayersIndex
            ? { ...t, members: editPlayerValues.map((n, j) => n || `Member ${j + 1}`) }
            : t
        )
      );
      setEditingPlayersIndex(null);
    } catch (err) {
      console.error("Failed to update players", err);
      alert("Failed to update players.");
    } finally {
      setUpdating(false);
    }
  };

  /* ---------- UI ---------- */

  {/* hidden file input used when changing existing logo */}
  <input
    type="file"
    accept="image/*"
    style={{ display: "none" }}
    ref={fileInputRef}
    onChange={onFileInputChange}
  />

  if (existingComplete) {
    // Show edit card for team names
    if (editingTeamNames) {
      return (
        <div className="team-bg">
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            ref={fileInputRef}
            onChange={onFileInputChange}
          />
          <div className="team-card">
            <h1 className="team-title">Edit Team Names</h1>
            <div className="team-inputs">
              {editTeamNamesValues.map((name, i) => (
                <input
                  key={i}
                  className="team-input"
                  placeholder={`Team ${i + 1}`}
                  value={name}
                  onChange={(e) => {
                    const updated = [...editTeamNamesValues];
                    updated[i] = e.target.value;
                    setEditTeamNamesValues(updated);
                  }}
                />
              ))}
            </div>
            <div className="edit-btn-group">
              <button className="cancel-btn" onClick={cancelEditTeamNames} disabled={updating}>Cancel</button>
              <button className="update-btn" onClick={updateTeamNames} disabled={updating}>
                {updating ? "Updating..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Show edit card for a specific team's players
    if (editingPlayersIndex !== null) {
      const team = teams[editingPlayersIndex];
      return (
        <div className="team-bg">
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            ref={fileInputRef}
            onChange={onFileInputChange}
          />
          <div className="team-card">
            <h1 className="team-title">Edit Players — {team.name}</h1>
            <div className="team-inputs">
              {editPlayerValues.map((name, i) => (
                <input
                  key={i}
                  className="team-input"
                  placeholder={`Player ${i + 1}`}
                  value={name}
                  onChange={(e) => {
                    const updated = [...editPlayerValues];
                    updated[i] = e.target.value;
                    setEditPlayerValues(updated);
                  }}
                />
              ))}
            </div>
            <div className="edit-btn-group">
              <button className="cancel-btn" onClick={cancelEditPlayers} disabled={updating}>Cancel</button>
              <button className="update-btn" onClick={updatePlayers} disabled={updating}>
                {updating ? "Updating..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Normal table view with edit buttons
    return (
      <div className="team-bg">
        <input
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          ref={fileInputRef}
          onChange={onFileInputChange}
        />
        <div className="team-card">
          <h1 className="team-title">Teams & Players</h1>
          <table className="existing-table">
            <thead>
              <tr>
                <th>
                  <div className="th-with-edit">
                    Team (logo)
                    <button className="edit-icon-btn" onClick={startEditTeamNames} title="Edit team names">✏️</button>
                  </div>
                </th>
                <th>Players</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t, idx) => (
                <tr key={t.id ?? idx}>
                  <td>
                    {t.logo_path ? (
                      <img src={supabase.storage.from('School_logo').getPublicUrl(t.logo_path).data.publicUrl} alt="logo" className="logo-thumb" />
                    ) : (
                      <span className="crest-initial">{t.name.charAt(0).toUpperCase()}</span>
                    )}
                    <span>{t.name}</span>
                  </td>
                  <td>
                    <div className="td-with-edit">
                      <span>{t.members.join(", ")}</span>
                      <button className="edit-icon-btn" onClick={() => startEditPlayers(idx)} title={`Edit ${t.name} players`}>✏️</button>
                    </div>
                  </td>
                  <td>
                    <button onClick={() => handleChangeExistingLogo(idx)} title="Change logo">🖼️</button>
                    {t.logo_path && (
                      <button onClick={() => handleDeleteExistingLogo(idx)} title="Delete logo">❌</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="team-bg">
      <div className="team-card">

        {/* STEP 1 – TEAM NAMES */}
        {step === "teams" && (
          <>
            <h1 className="team-title">ENTER TEAM NAMES & LOGOS</h1>

            <div className="team-inputs">
              {teamNames.map((team, index) => (
                <div key={index} className="team-input-group">
                  <input
                    className="team-input"
                    placeholder={`Team ${index + 1}`}
                    value={team}
                    onChange={(e) =>
                      handleTeamNameChange(index, e.target.value)
                    }
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      handleLogoChange(index, e.target.files?.[0] ?? null)
                    }
                  />
                  {teamLogos[index] && (
                    <img
                      src={URL.createObjectURL(teamLogos[index]!)}
                      alt="preview"
                      className="logo-preview"
                    />
                  )}
                </div>
              ))}
            </div>

            <button className="action-btn" onClick={goToMembersStep}>
              NEXT
            </button>
          </>
        )}

        {/* STEP 2 – TEAM MEMBERS */}
        {step === "members" && (
          <>
            <h1 className="team-title">
              {teams[currentTeamIndex]?.name}
            </h1>

            <p className="subtitle">Enter Team Members</p>

            <div className="team-inputs">
              {members.map((member, index) => (
                <input
                  key={index}
                  className="team-input"
                  placeholder={`Member ${index + 1}`}
                  value={member}
                  onChange={(e) =>
                    handleMemberChange(index, e.target.value)
                  }
                />
              ))}
            </div>

            <button className="action-btn" onClick={saveMembersAndNext} disabled={saving}>
              {saving
                ? "SAVING..."
                : currentTeamIndex < TOTAL_TEAMS - 1
                ? "NEXT TEAM"
                : "FINISH"}
            </button>
          </>
        )}

      </div>
    </div>
  );
};

export default TeamSetupPage;