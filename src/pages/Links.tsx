import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Link as LinkIcon, Plus, Pencil, Trash2, Globe, Building2, Users } from 'lucide-react';
import { CreateLinkModal } from '../components/CreateLinkModal';
import { EditLinkModal } from '../components/EditLinkModal';
import { useProfile } from '../hooks/useProfile';

interface Link {
  id: string;
  name: string;
  description: string | null;
  url: string;
  logo_url: string | null;
  scope: 'global' | 'organization' | 'team';
  organization_id: string | null;
  team_id: string | null;
  organization: {
    id: string;
    name: string;
    logo_url: string | null;
  } | null;
  team: {
    id: string;
    name: string;
  } | null;
  created_at: string;
}

type ScopeFilter = 'all' | 'global' | 'organization' | 'team';

interface LinksProps {
  isAdminView?: boolean;
}

export function Links({ isAdminView = false }: LinksProps) {
  const { profile } = useProfile();
  const [links, setLinks] = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLink, setEditingLink] = useState<Link | null>(null);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');

  useEffect(() => {
    loadLinks();
  }, []);

  async function loadLinks() {
    try {
      const { data, error } = await supabase
        .from('links')
        .select(`
          *,
          organization:organizations(*),
          team:teams(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLinks(data || []);
    } catch (error) {
      console.error('Error loading links:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this link?')) return;
    
    try {
      const { error } = await supabase
        .from('links')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadLinks();
    } catch (error) {
      console.error('Error deleting link:', error);
    }
  };

  const getScopeIcon = (scope: Link['scope']) => {
    switch (scope) {
      case 'global':
        return <Globe className="h-5 w-5 text-blue-500" />;
      case 'organization':
        return <Building2 className="h-5 w-5 text-purple-500" />;
      case 'team':
        return <Users className="h-5 w-5 text-green-500" />;
    }
  };

  const getScopeBadgeColor = (scope: Link['scope']) => {
    switch (scope) {
      case 'global':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'organization':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'team':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    }
  };

  const getScopeName = (link: Link) => {
    switch (link.scope) {
      case 'global':
        return 'Global';
      case 'organization':
        return link.organization?.name || 'Unknown Organization';
      case 'team':
        return link.team?.name || 'Unknown Team';
    }
  };

  const canManageLink = (link: Link) => {
    if (profile?.is_global_admin) return true;
    
    // Organization admins can manage their org's links
    if (link.scope === 'organization' && link.organization_id) {
      return profile?.organizations?.some(
        org => org.id === link.organization_id && org.role === 'organization_admin'
      );
    }
    
    // Team admins can manage their team's links
    if (link.scope === 'team' && link.team_id) {
      return profile?.teams?.some(
        team => team.id === link.team_id && team.role === 'team_admin'
      );
    }

    return false;
  };

  const filteredLinks = links.filter(link => {
    if (!isAdminView) {
      // For user view, only show links they have access to
      if (link.scope === 'global') return true;
      if (link.scope === 'organization' && link.organization_id) {
        return profile?.organizations?.some(org => org.id === link.organization_id);
      }
      if (link.scope === 'team' && link.team_id) {
        return profile?.teams?.some(team => team.id === link.team_id);
      }
      return false;
    }

    // For admin view, show all links based on scope filter
    if (scopeFilter === 'all') return true;
    return link.scope === scopeFilter;
  });

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <LinkIcon className="h-6 w-6 mr-2" />
          {isAdminView ? 'Manage Links' : 'Links'}
        </h2>
        {(profile?.is_global_admin || profile?.organizations?.some(org => org.role === 'organization_admin') || profile?.teams?.some(team => team.role === 'team_admin')) && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Link
          </button>
        )}
      </div>

      {/* Scope Filter - Only show in admin view */}
      {isAdminView && (
        <div className="mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setScopeFilter('all')}
              className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${
                scopeFilter === 'all'
                  ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
                  : 'text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setScopeFilter('global')}
              className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${
                scopeFilter === 'global'
                  ? 'bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100'
                  : 'text-blue-600 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/50'
              }`}
            >
              <Globe className="h-4 w-4 mr-1" />
              Global
            </button>
            <button
              onClick={() => setScopeFilter('organization')}
              className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${
                scopeFilter === 'organization'
                  ? 'bg-purple-100 text-purple-900 dark:bg-purple-900 dark:text-purple-100'
                  : 'text-purple-600 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-900/50'
              }`}
            >
              <Building2 className="h-4 w-4 mr-1" />
              Organizations
            </button>
            <button
              onClick={() => setScopeFilter('team')}
              className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${
                scopeFilter === 'team'
                  ? 'bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100'
                  : 'text-green-600 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-900/50'
              }`}
            >
              <Users className="h-4 w-4 mr-1" />
              Teams
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredLinks.map((link) => (
          <div
            key={link.id}
            className="relative bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                {link.logo_url ? (
                  <img
                    src={link.logo_url}
                    alt={link.name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center">
                    <LinkIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                    {link.name}
                  </h3>
                  <div className="flex items-center mt-1">
                    {getScopeIcon(link.scope)}
                    <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getScopeBadgeColor(link.scope)}`}>
                      {getScopeName(link)}
                    </span>
                  </div>
                </div>
              </div>
              {canManageLink(link) && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setEditingLink(link)}
                    className="p-1 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                  >
                    <Pencil className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(link.id)}
                    className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>

            {link.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {link.description}
              </p>
            )}

            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
            >
              Visit Link
              <LinkIcon className="ml-1 h-4 w-4" />
            </a>
          </div>
        ))}
      </div>

      {filteredLinks.length === 0 && (
        <div className="text-center py-12">
          <LinkIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No links</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isAdminView
              ? scopeFilter === 'all'
                ? 'Get started by creating a new link.'
                : `No ${scopeFilter} links found.`
              : 'No links available.'}
          </p>
        </div>
      )}

      <CreateLinkModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadLinks}
      />

      {editingLink && (
        <EditLinkModal
          isOpen={true}
          onClose={() => setEditingLink(null)}
          onSuccess={loadLinks}
          link={editingLink}
        />
      )}
    </div>
  );
}