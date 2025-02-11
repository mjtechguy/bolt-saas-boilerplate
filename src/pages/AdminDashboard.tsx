import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Building2,
  UserCheck,
  Clock,
  ArrowRight,
  Briefcase,
  Link as LinkIcon,
  MenuSquare,
  AppWindow,
  RotateCw as ArrowPathIcon,
  Home as HomeIcon
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useProfile } from '../hooks/useProfile';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalOrganizations: number;
  totalTeams: number;
  totalLinks: number;
  totalTopBarLinks: number;
  totalApps: number;
  recentLogins: {
    email: string;
    display_name?: string;
    last_sign_in_at: string | null;
  }[];
}

const initialStats: DashboardStats = {
  totalUsers: 0,
  activeUsers: 0,
  totalOrganizations: 0,
  totalTeams: 0,
  totalLinks: 0,
  totalTopBarLinks: 0,
  totalApps: 0,
  recentLogins: []
};

export function AdminDashboard() {
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useProfile();
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (profileLoading) {
      return;
    }

    if (!profile?.is_global_admin) {
      setError('Access denied. Admin privileges required.');
      setLoading(false);
      return;
    }

    loadStats();
  }, [retryCount, profile, profileLoading]);

  async function loadStats() {
    try {
      setLoading(true);
      setError(null);

      if (!profile?.id) {
        throw new Error('User profile not loaded');
      }

      // Get total users and active users (active in last 24 hours)
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const [
        totalUsersResult,
        activeUsersResult,
        organizationsResult,
        teamsResult,
        linksResult,
        topBarLinksResult,
        appsResult,
        recentLoginsResult
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .gte('last_sign_in_at', yesterday.toISOString()),
        supabase.from('organizations').select('*'),
        supabase.from('teams').select('*'),
        supabase.from('links').select('*'),
        supabase.from('topbar_links').select('*'),
        supabase.from('organization_apps').select('*'),
        supabase
          .from('profiles')
          .select('email, display_name, last_sign_in_at')
          .not('last_sign_in_at', 'is', null)
          .order('last_sign_in_at', { ascending: false })
          .limit(5)
      ]);

      // Check for errors in any of the results
      const errors = [
        totalUsersResult.error,
        activeUsersResult.error,
        organizationsResult.error,
        teamsResult.error,
        linksResult.error,
        topBarLinksResult.error,
        appsResult.error,
        recentLoginsResult.error
      ].filter(Boolean);

      if (errors.length > 0) {
        throw new Error(errors[0]?.message || 'Failed to load dashboard data');
      }

      setStats({
        totalUsers: totalUsersResult.count || 0,
        activeUsers: activeUsersResult.count || 0,
        totalOrganizations: organizationsResult.data?.length || 0,
        totalTeams: teamsResult.data?.length || 0,
        totalLinks: linksResult.data?.length || 0,
        totalTopBarLinks: topBarLinksResult.data?.length || 0,
        totalApps: appsResult.data?.length || 0,
        recentLogins: recentLoginsResult.data || []
      });
    } catch (err) {
      console.error('Error loading dashboard stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  }

  const StatCard = ({
    title,
    value,
    icon: Icon,
    onClick,
    href,
    color = 'text-indigo-600 dark:text-indigo-400',
    bgColor = 'bg-indigo-100 dark:bg-indigo-900/20'
  }: {
    title: string;
    value: number;
    icon: React.ElementType;
    onClick?: () => void;
    href?: string;
    color?: string;
    bgColor?: string;
  }) => (
    <div
      onClick={() => {
        if (onClick) onClick();
        if (href) navigate(href);
      }}
      className={`
        bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700
        ${(onClick || href) ? 'cursor-pointer hover:border-indigo-500 dark:hover:border-indigo-400' : ''}
      `}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
            {value}
          </p>
        </div>
        <div className={`p-3 rounded-full ${bgColor}`}>
          <Icon className={`h-6 w-6 ${color}`} />
        </div>
      </div>
    </div>
  );

  if (loading || profileLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
                <div className="h-12 w-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/30 p-4 rounded-lg">
        <h2 className="text-lg font-medium text-red-800 dark:text-red-200">Error Loading Dashboard</h2>
        <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
        <div className="mt-3 flex items-center space-x-4">
          <button
            onClick={() => setRetryCount(count => count + 1)}
            className="text-sm text-red-600 dark:text-red-400 hover:text-red-500 font-medium flex items-center"
          >
            <ArrowPathIcon className="h-4 w-4 mr-1" />
            Try Again
          </button>
          <button
            onClick={() => navigate('/')}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-500 font-medium flex items-center"
          >
            <HomeIcon className="h-4 w-4 mr-1" />
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Admin Dashboard
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Overview of system statistics and recent activity
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={Users}
          href="/profiles"
          color="text-blue-600 dark:text-blue-400"
          bgColor="bg-blue-100 dark:bg-blue-900/20"
        />
        <StatCard
          title="Active Users (24h)"
          value={stats.activeUsers}
          icon={UserCheck}
          href="/profiles"
          color="text-green-600 dark:text-green-400"
          bgColor="bg-green-100 dark:bg-green-900/20"
        />
        <StatCard
          title="Organizations"
          value={stats.totalOrganizations}
          icon={Building2}
          href="/organizations"
          color="text-purple-600 dark:text-purple-400"
          bgColor="bg-purple-100 dark:bg-purple-900/20"
        />
        <StatCard
          title="Teams"
          value={stats.totalTeams}
          icon={Briefcase}
          href="/teams"
          color="text-amber-600 dark:text-amber-400"
          bgColor="bg-amber-100 dark:bg-amber-900/20"
        />
        <StatCard
          title="Links"
          value={stats.totalLinks}
          icon={LinkIcon}
          href="/admin/links"
          color="text-rose-600 dark:text-rose-400"
          bgColor="bg-rose-100 dark:bg-rose-900/20"
        />
        <StatCard
          title="Apps"
          value={stats.totalApps}
          icon={AppWindow}
          href="/admin/apps"
          color="text-teal-600 dark:text-teal-400"
          bgColor="bg-teal-100 dark:bg-teal-900/20"
        />
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
            <Clock className="h-5 w-5 mr-2 text-gray-400" />
            Recent User Activity
          </h3>
          <div className="mt-6 flow-root">
            <ul className="-my-5 divide-y divide-gray-200 dark:divide-gray-700">
              {stats.recentLogins.map((login) => (
                <li key={login.email} className="py-4">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <img
                        className="h-8 w-8 rounded-full"
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(login.display_name || login.email)}&background=random`}
                        alt=""
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {login.display_name || login.email}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Last login: {login.last_sign_in_at
                          ? new Date(login.last_sign_in_at).toLocaleString()
                          : 'Never'}
                      </p>
                    </div>
                    <div>
                      <button
                        onClick={() => navigate('/profiles')}
                        className="inline-flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                      >
                        View
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}