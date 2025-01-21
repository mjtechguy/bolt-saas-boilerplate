import React, { useState, useEffect } from 'react';
import { X, Globe, Building2, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Organization, Team } from '../lib/types';

interface EditLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  link: {
    id: string;
    name: string;
    description: string | null;
    url: string;
    logo_url: string | null;
    scope: 'global' | 'organization' | 'team';
    organization_id: string | null;
    team_id: string | null;
  };
}

export function EditLinkModal({ isOpen, onClose, onSuccess, link }: EditLinkModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [form, setForm] = useState({
    name: '',
    description: '',
    url: '',
    logo_url: '',
    scope: 'global' as 'global' | 'organization' | 'team',
    organization_id: '',
    team_id: ''
  });

  useEffect(() => {
    if (isOpen) {
      loadOrganizationsAndTeams();
      setForm({
        name: link.name,
        description: link.description || '',
        url: link.url,
        logo_url: link.logo_url || '',
        scope: link.scope,
        organization_id: link.organization_id || '',
        team_id: link.team_id || ''
      });
    }
  }, [isOpen, link]);

  const loadOrganizationsAndTeams = async () => {
    try {
      const [{ data: orgs }, { data: teamData }] = await Promise.all([
        supabase.from('organizations').select('*').order('name'),
        supabase.from('teams').select('*').order('name')
      ]);

      setOrganizations(orgs || []);
      setTeams(teamData || []);
    } catch (error) {
      console.error('Error loading organizations and teams:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const linkData = {
        name: form.name,
        description: form.description || null,
        url: form.url,
        logo_url: form.logo_url || null,
        scope: form.scope,
        organization_id: form.scope === 'organization' ? form.organization_id : null,
        team_id: form.scope === 'team' ? form.team_id : null
      };

      const { error: updateError } = await supabase
        .from('links')
        .update(linkData)
        .eq('id', link.id);

      if (updateError) throw updateError;

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error updating link:', error);
      setError(error instanceof Error ? error.message : 'Failed to update link');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />

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
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Edit Link
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
            </div>

            {/* URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                URL
              </label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            {/* Logo URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Logo URL
              </label>
              <input
                type="url"
                value={form.logo_url}
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="https://example.com/logo.png"
              />
            </div>

            {/* Scope */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Scope
              </label>
              <div className="mt-2 grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, scope: 'global' })}
                  className={`flex items-center justify-center px-3 py-2 border rounded-md text-sm font-medium ${
                    form.scope === 'global'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'
                  }`}
                >
                  <Globe className="h-5 w-5 mr-2" />
                  Global
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, scope: 'organization' })}
                  className={`flex items-center justify-center px-3 py-2 border rounded-md text-sm font-medium ${
                    form.scope === 'organization'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'
                  }`}
                >
                  <Building2 className="h-5 w-5 mr-2" />
                  Org
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, scope: 'team' })}
                  className={`flex items-center justify-center px-3 py-2 border rounded-md text-sm font-medium ${
                    form.scope === 'team'
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300'
                  }`}
                >
                  <Users className="h-5 w-5 mr-2" />
                  Team
                </button>
              </div>
            </div>

            {/* Organization Selection */}
            {form.scope === 'organization' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Organization
                </label>
                <select
                  value={form.organization_id}
                  onChange={(e) => setForm({ ...form, organization_id: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                >
                  <option value="">Select an organization</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Team Selection */}
            {form.scope === 'team' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Team
                </label>
                <select
                  value={form.team_id}
                  onChange={(e) => setForm({ ...form, team_id: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                >
                  <option value="">Select a team</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4">
                <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
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
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}