import React, {useState, useEffect} from "react";
import {X, Upload, Users} from "lucide-react";
import {supabase} from "../lib/supabase";
import type {Organization, Profile} from "../lib/types";

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateTeamModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateTeamModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [form, setForm] = useState({
    name: "",
    organizationId: "",
    adminEmail: "",
    logo: null as File | null,
  });
  const [userRole] = useState(localStorage.getItem("userOrgRole"));
  // const [orgId] = useState(localStorage.getItem("organization_id"));

  // Load organizations and users when modal opens
  useEffect(() => {
    if (isOpen) {
      loadOrganizations();
      loadUsers();
    }
  }, [isOpen]);

  const loadOrganizations = async () => {
    try {
      const orgId= localStorage.getItem("organization_id");
      console.log(orgId,'id')
      if (userRole == "organization_admin") {
        // const {data, error} = await supabase
        //   .from("organizations")
        //   .select(
        //     `
        //           *

        //         `
        //   )
        const {data, error} = await supabase
          .from("organizations")
          .select("*")
          .order("name")

          .eq("id", orgId);

        if (error) throw error;

        setOrganizations(data || []);
      } else {
        const {data, error} = await supabase
          .from("organizations")
          .select("*")
          .order("name");

        if (error) throw error;
        setOrganizations(data || []);
      }
    } catch (error) {
      console.error("Error loading organizations:", error);
    }
  };

  const loadUsers = async () => {
    try {
      const {data, error} = await supabase
        .from("profiles")
        .select("*")
        .order("email");

      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!form.name.trim()) {
        throw new Error("Team name is required");
      }

      if (!form.organizationId) {
        throw new Error("Organization is required");
      }

      if (!form.adminEmail) {
        throw new Error("Team admin is required");
      }

      // Create team
      const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const {data: team, error: teamError} = await supabase
        .from("teams")
        .insert([
          {
            name: form.name,
            slug,
            organization_id: form.organizationId,
          },
        ])
        .select()
        .single();

      if (teamError) throw teamError;

      // Get the admin user's ID
      const adminUser = availableUsers.find(
        (user) => user.email === form.adminEmail
      );
      if (!adminUser) throw new Error("Selected admin user not found");

      // Add admin to team with team_admin role
      const {error: memberError} = await supabase.from("user_teams").insert([
        {
          user_id: adminUser.id,
          team_id: team.id,
          role: "team_admin",
        },
      ]);

      if (memberError) throw memberError;

      onSuccess();
      onClose();
      setForm({name: "", organizationId: "", adminEmail: "", logo: null});
    } catch (error) {
      console.error("Error creating team:", error);
      setError(
        error instanceof Error ? error.message : "Failed to create team"
      );
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative w-full max-w-md transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 p-6 text-left shadow-xl transition-all">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Create New Team
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Organization Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Organization
              </label>
              <select
                value={form.organizationId}
                onChange={(e) =>
                  setForm({...form, organizationId: e.target.value})
                }
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">Select an organization</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Team Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Team Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({...form, name: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Enter team name"
              />
            </div>

            {/* Team Admin */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Team Admin
              </label>
              <select
                value={form.adminEmail}
                onChange={(e) => setForm({...form, adminEmail: e.target.value})}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">Select an admin</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.email}>
                    {user.display_name || user.email}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4">
                <p className="text-sm text-red-700 dark:text-red-200">
                  {error}
                </p>
              </div>
            )}

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-500 dark:hover:text-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Team"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
