import React, {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {
  UserCircle,
  Link as LinkIcon,
  Building2,
  Users,
  ArrowRight,
} from "lucide-react";
import {useProfile} from "../hooks/useProfile";
import {supabase} from "../lib/supabase";

export function Dashboard() {
  const navigate = useNavigate();
  const {profile, loading: profileLoading} = useProfile();

  // Quick access cards for regular users
  const userQuickLinks = [
    {
      name: "My Profile",
      description: "View and edit your profile settings",
      icon: UserCircle,
      href: "/profile",
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
    },
    {
      name: "Quick Links",
      description: "Access your bookmarked links",
      icon: LinkIcon,
      href: "/links",
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900/20",
    },
  ];

  // Additional cards for users with organization memberships
  const orgQuickLinks =
    profile?.organizations?.map((org) => ({
      name: org.name,
      description: `Access ${org.name} resources`,
      icon: Building2,
      href: `/organizations/${org.id}`,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900/20",
    })) || [];

  // Additional cards for users with team memberships
  const teamQuickLinks =
    profile?.teams?.map((team) => ({
      name: team.name,
      description: `Access ${team.name} resources`,
      icon: Users,
      href: `/teams/${team.id}`,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-100 dark:bg-amber-900/20",
    })) || [];

  // Combine all quick links
  const allQuickLinks = [
    ...userQuickLinks,
    ...orgQuickLinks,
    ...teamQuickLinks,
  ];
  // const getUserOrganization = async () => {
  //   const organizationId = localStorage.getItem("organization_id");
  //   const {data, error: orgError} = await supabase
  //     .from("user_organizations")
  //     .select("user_id, organization_id")
  //     .eq("user_id", profile?.id)
  //     .eq("organization_id", organizationId);

  //   if (orgError) throw orgError;

  //   // If the user is not part of the organization, throw an error
  //   if (!data || data.length === 0) {
  //     setOrgs(false);

  //     throw new Error("You are not part of this organization.");
  //   } else if (data.length > 0) {
  //     setOrgs(true);

  //     throw new Error("You are not part of this organization.");
  //   }
  // };
  const [orgs, setOrgs] = useState<boolean | null>(null);

  useEffect(() => {
    if (!profile) return;

    const getUserOrganization = async () => {
      const organizationId = localStorage.getItem("organization_id");

      if (!organizationId) {
        setOrgs(false);
        return;
      }

      const {data, error} = await supabase
        .from("user_organizations")
        .select("user_id, organization_id")
        .eq("user_id", profile?.id)
        .eq("organization_id", organizationId);

      if (error) {
        console.error("Error fetching organization:", error);
        setOrgs(false);
        return;
      }

      setOrgs(data.length > 0?true:false);
    };

    getUserOrganization();
  }, [profile]);

  if (profileLoading || orgs === null) {
    return (
      <div className="flex items-center justify-center mt-12">
        <p className="text-gray-600 dark:text-gray-300">Loading...</p>
      </div>
    );
  }

  if (!orgs && profile?.is_global_admin === false) {
    return (
      <div className="flex items-center justify-center mt-12">
        <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl p-8 max-w-lg text-center">
          <p className="text-gray-600 dark:text-gray-300">
            You are not part of this organization. Please contact the
            administrator for access.
          </p>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome back, {profile?.display_name || profile?.email}!
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Quick access to your resources and settings
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {allQuickLinks.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.name}
                onClick={() => navigate(item.href)}
                className="relative group bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex items-center">
                  <div className={`p-3 rounded-lg ${item.bgColor}`}>
                    <Icon className={`h-6 w-6 ${item.color}`} />
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                      {item.name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {item.description}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400" />
                </div>
              </div>
            );
          })}
        </div>

        {profile?.is_global_admin && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <UserCircle
                  className="h-5 w-5 text-indigo-400"
                  aria-hidden="true"
                />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
                  Admin Access
                </h3>
                <div className="mt-2 text-sm text-indigo-700 dark:text-indigo-300">
                  <p>
                    You have admin privileges. Visit the{" "}
                    <button
                      onClick={() => navigate("/admin/dashboard")}
                      className="font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                    >
                      Admin Dashboard
                    </button>{" "}
                    to manage the system.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
