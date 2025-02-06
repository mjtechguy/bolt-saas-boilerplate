import React, {useState, useEffect} from "react";
import {TopBar} from "./TopBar";
import {Sidebar} from "./Sidebar";
import {useProfile} from "../hooks/useProfile";
import {supabase} from "../lib/supabase";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({children}: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {profile, loading} = useProfile();
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

      setOrgs(data.length > 0);
    };

    getUserOrganization();
  }, [profile]);

  if (loading  || orgs === null) {
    return <div>Loading...</div>;
  }

  if (!orgs && profile?.is_global_admin === false && loading==false) {
    const isAccess = () => (
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-black">
        <TopBar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <div className="flex  items-center justify-center border-t border-gray-200 dark:border-gray-700">
          <div className="bg-red-100 dark:bg-red-900 shadow-2xl rounded-2xl p-10 max-w-md text-center mt-36">
            <h1 className="text-red-700 dark:text-red-300 font-extrabold text-2xl">
              Access Denied
            </h1>
            <h1 className="text-red-700 dark:text-red-300 font-bold text-xl mt-5">
              You are not part of this organization.
            </h1>
            <p className="text-gray-700 dark:text-gray-300 mt-4">
              Please contact the administrator for access.
            </p>
          </div>
        </div>
      </div>
    );
    return isAccess();
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black">
      <TopBar toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex h-[calc(100vh-4rem)] border-t border-gray-200 dark:border-gray-700">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 overflow-y-auto border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black">
          <div className="max-w-7xl mx-auto p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
