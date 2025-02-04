import React, {useState} from "react";
import {NavLink} from "react-router-dom";
import {
  Building2,
  Users,
  Settings as SettingsIcon,
  UserCircle2,
  LayoutDashboard,
  Link as LinkIcon,
  MenuSquare,
  Bot,
  AppWindow,
} from "lucide-react";
import {useProfile} from "../hooks/useProfile";
import {OrganizationSelector} from "./OrganizationSelector";
import {useOrganization} from "../hooks/useOrganization";

export function Sidebar({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const {profile} = useProfile();
  const {currentOrganizationId, changeOrganization} = useOrganization();
  const userRole = (localStorage.getItem("userOrgRole"));

  console.log(userRole, "role");

  const adminNavigation = [
    {name: "Admin Dashboard", href: "/admin/dashboard", icon: LayoutDashboard},
    {name: "Organizations", href: "/organizations", icon: Building2},
    {name: "Teams", href: "/teams", icon: Users},
    {name: "Links", href: "/admin/links", icon: LinkIcon},
    {name: "Top Bar", href: "/admin/topbar", icon: MenuSquare},
    {name: "User Management", href: "/profiles", icon: UserCircle2},
    {name: "Apps", href: "/admin/apps", icon: AppWindow},
    {name: "Settings", href: "/settings", icon: SettingsIcon},
  ];

  const userNavigation = [
    {name: "Dashboard", href: "/dashboard", icon: LayoutDashboard},
    {name: "Links", href: "/links", icon: LinkIcon},
    {name: "AI Chat", href: "/chat", icon: Bot},
  ];
  const organizationNavigation = [
    {name: "Dashboard", href: "/dashboard", icon: LayoutDashboard},
    {name: "Links", href: "/links", icon: LinkIcon},
    {name: "AI Chat", href: "/chat", icon: Bot},
    {name: "Organizations", href: "/user-organization", icon: Building2},
    {name: "Teams", href: "/user-teams", icon: Users},
  ];
  const teamNavigation = [
    {name: "Dashboard", href: "/dashboard", icon: LayoutDashboard},
    {name: "Links", href: "/links", icon: LinkIcon},
    {name: "AI Chat", href: "/chat", icon: Bot},
    {name: "Teams", href: "/user-teams", icon: Users},
  ];
  const navigation =
  userRole === "organization_admin"
    ? organizationNavigation
    : userRole === "team_admin"
    ? teamNavigation
    : userNavigation;


  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
          onClick={onClose}
        />
      )}

      <div
        className={`
          fixed inset-y-0 left-0 z-40 w-64 transform bg-white dark:bg-gray-800 transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <div className="h-full flex flex-col border-r border-gray-200 dark:border-gray-700">
          {/* Organization Selector */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <OrganizationSelector
              currentOrganizationId={currentOrganizationId}
              onOrganizationChange={changeOrganization}
            />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {/* User Navigation */}
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({isActive}) => `
                  group flex items-center px-3 py-2 text-sm font-medium rounded-md
                  ${
                    isActive
                      ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }
                `}
              >
                <item.icon
                  className="mr-3 h-5 w-5 flex-shrink-0 text-gray-400 dark:text-gray-500"
                  aria-hidden="true"
                />
                {item.name}
              </NavLink>
            ))}

            {/* Admin Navigation */}
            {profile?.is_global_admin && (
              <>
                <div className="relative mb-4">
                  <div
                    className="absolute inset-0 flex items-center"
                    aria-hidden="true"
                  >
                    <div className="w-full border-t border-gray-200 dark:border-gray-700" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white dark:bg-gray-800 px-2 text-sm text-gray-500 dark:text-gray-400">
                      Admin
                    </span>
                  </div>
                </div>

                {adminNavigation.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    className={({isActive}) => `
                      group flex items-center px-3 py-2 text-sm font-medium rounded-md
                      ${
                        isActive
                          ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                          : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                      }
                    `}
                  >
                    <item.icon
                      className="mr-3 h-5 w-5 flex-shrink-0 text-gray-400 dark:text-gray-500"
                      aria-hidden="true"
                    />
                    {item.name}
                  </NavLink>
                ))}
              </>
            )}
          </nav>
        </div>
      </div>
    </>
  );
}
