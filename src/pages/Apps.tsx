import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Bot, Link as LinkIcon, Users, Settings, Check, X, AlertCircle } from 'lucide-react';
import { useProfile } from '../hooks/useProfile';

interface App {
  id: string;
  type: 'ai_chat' | 'link_management' | 'team_management';
  name: string;
  description: string;
  enabled: boolean;
  requires_setup: boolean;
}

interface OrganizationApp {
  id: string;
  organization_id: string;
  app_type: App['type'];
  enabled: boolean;
  settings: Record<string, any>;
}

export function Apps() {
  const { profile } = useProfile();
  const [apps, setApps] = useState<App[]>([]);
  const [orgApps, setOrgApps] = useState<Record<string, OrganizationApp[]>>({});
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load available apps
      const { data: appsData, error: appsError } = await supabase
        .from('available_apps')
        .select('*')
        .order('name');

      if (appsError) throw appsError;
      setApps(appsData || []);

      // Load organizations
      const { data: orgsData, error: orgsError } = await supabase
        .from('organizations')
        .select('*')
        .order('name');

      if (orgsError) throw orgsError;
      setOrganizations(orgsData || []);

      // Load organization apps
      const { data: orgAppsData, error: orgAppsError } = await supabase
        .from('organization_apps')
        .select('*');

      if (orgAppsError) throw orgAppsError;

      // Group apps by organization
      const grouped = (orgAppsData || []).reduce((acc: Record<string, OrganizationApp[]>, app) => {
        acc[app.organization_id] = acc[app.organization_id] || [];
        acc[app.organization_id].push(app);
        return acc;
      }, {});

      setOrgApps(grouped);
    } catch (error) {
      console.error('Error loading apps:', error);
      setError('Failed to load apps');
    } finally {
      setLoading(false);
    }
  };

  const toggleAppAvailability = async (app: App) => {
    try {
      setError(null);
      setSuccess(null);

      const { error: updateError } = await supabase
        .from('available_apps')
        .update({ enabled: !app.enabled })
        .eq('id', app.id);

      if (updateError) throw updateError;

      setSuccess(`${app.name} has been ${!app.enabled ? 'enabled' : 'disabled'}`);
      await loadData();
    } catch (error) {
      console.error('Error toggling app:', error);
      setError('Failed to update app status');
    }
  };

  const toggleOrgApp = async (orgId: string, app: OrganizationApp) => {
    try {
      setError(null);
      setSuccess(null);

      const { error: updateError } = await supabase
        .from('organization_apps')
        .update({ enabled: !app.enabled })
        .eq('id', app.id);

      if (updateError) throw updateError;

      setSuccess(`${app.app_type} has been ${!app.enabled ? 'enabled' : 'disabled'} for the organization`);
      await loadData();
    } catch (error) {
      console.error('Error toggling org app:', error);
      setError('Failed to update app status');
    }
  };

  const getAppIcon = (type: App['type']) => {
    switch (type) {
      case 'ai_chat':
        return <Bot className="h-5 w-5" />;
      case 'link_management':
        return <LinkIcon className="h-5 w-5" />;
      case 'team_management':
        return <Users className="h-5 w-5" />;
      default:
        return <Settings className="h-5 w-5" />;
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          App Management
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage available apps and their organization-specific settings
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</div>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/30 p-4">
          <div className="flex">
            <Check className="h-5 w-5 text-green-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800 dark:text-green-200">Success</h3>
              <div className="mt-2 text-sm text-green-700 dark:text-green-300">{success}</div>
            </div>
          </div>
        </div>
      )}

      {/* Available Apps Section */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Available Apps
        </h3>
        <div className="space-y-4">
          {apps.map((app) => (
            <div
              key={app.id}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                  {getAppIcon(app.type)}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                    {app.name}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {app.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                {app.requires_setup && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                    Requires Setup
                  </span>
                )}
                <button
                  onClick={() => toggleAppAvailability(app)}
                  className={`inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md ${
                    app.enabled
                      ? 'text-red-700 bg-red-100 hover:bg-red-200 dark:text-red-200 dark:bg-red-900/50 dark:hover:bg-red-900'
                      : 'text-green-700 bg-green-100 hover:bg-green-200 dark:text-green-200 dark:bg-green-900/50 dark:hover:bg-green-900'
                  }`}
                >
                  {app.enabled ? (
                    <>
                      <X className="h-4 w-4 mr-1.5" />
                      Disable
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-1.5" />
                      Enable
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Organization Apps Section */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Organization Apps
        </h3>
        <div className="space-y-6">
          {organizations.map((org) => (
            <div key={org.id} className="space-y-4">
              <h4 className="text-md font-medium text-gray-900 dark:text-white">
                {org.name}
              </h4>
              <div className="space-y-4">
                {apps.filter(app => app.enabled).map((app) => {
                  const orgApp = orgApps[org.id]?.find(a => a.app_type === app.type);
                  return (
                    <div
                      key={`${org.id}-${app.type}`}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                          {getAppIcon(app.type)}
                        </div>
                        <div>
                          <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                            {app.name}
                          </h5>
                          {app.requires_setup && !orgApp?.settings && (
                            <p className="text-sm text-yellow-600 dark:text-yellow-400">
                              Requires setup before use
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        {orgApp && (
                          <button
                            onClick={() => toggleOrgApp(org.id, orgApp)}
                            className={`inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md ${
                              orgApp.enabled
                                ? 'text-red-700 bg-red-100 hover:bg-red-200 dark:text-red-200 dark:bg-red-900/50 dark:hover:bg-red-900'
                                : 'text-green-700 bg-green-100 hover:bg-green-200 dark:text-green-200 dark:bg-green-900/50 dark:hover:bg-green-900'
                            }`}
                          >
                            {orgApp.enabled ? (
                              <>
                                <X className="h-4 w-4 mr-1.5" />
                                Disable
                              </>
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1.5" />
                                Enable
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}