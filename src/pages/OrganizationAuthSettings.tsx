import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Pencil, Trash2, Check, X, KeyRound, Globe } from 'lucide-react';

interface AuthProvider {
  id: string;
  organization_id: string;
  provider: 'oauth' | 'oidc';
  name: string;
  client_id: string;
  client_secret: string;
  issuer?: string;
  authorization_endpoint?: string;
  token_endpoint?: string;
  userinfo_endpoint?: string;
  enabled: boolean;
}

interface OrganizationAuthSettingsProps {
  orgId: string;
}

export function OrganizationAuthSettings({ orgId }: OrganizationAuthSettingsProps) {
  const [providers, setProviders] = useState<AuthProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<AuthProvider, 'id' | 'organization_id'>>({
    provider: 'oauth',
    name: '',
    client_id: '',
    client_secret: '',
    issuer: '',
    authorization_endpoint: '',
    token_endpoint: '',
    userinfo_endpoint: '',
    enabled: false
  });

  useEffect(() => {
    if (orgId) {
      loadProviders();
    }
  }, [orgId]);

  async function loadProviders() {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('organization_auth_settings')
        .select('*')
        .eq('organization_id', orgId)
        .order('name');

      if (error) throw error;
      setProviders(data || []);
    } catch (error) {
      console.error('Error loading auth providers:', error);
      setError('Failed to load authentication providers');
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validate required fields based on provider type
      if (form.provider === 'oidc' && !form.issuer) {
        throw new Error('Issuer URL is required for OpenID Connect providers');
      }

      if (form.provider === 'oauth') {
        if (!form.authorization_endpoint) {
          throw new Error('Authorization endpoint is required for OAuth providers');
        }
        if (!form.token_endpoint) {
          throw new Error('Token endpoint is required for OAuth providers');
        }
      }

      if (editingId) {
        const { error } = await supabase
          .from('organization_auth_settings')
          .update({
            ...form,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('organization_auth_settings')
          .insert([{
            ...form,
            organization_id: orgId
          }]);

        if (error) throw error;
      }

      await loadProviders();
      resetForm();
    } catch (error) {
      console.error('Error saving auth provider:', error);
      setError(error instanceof Error ? error.message : 'Failed to save authentication provider');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this auth provider?')) return;
    
    try {
      setError(null);
      const { error } = await supabase
        .from('organization_auth_settings')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadProviders();
    } catch (error) {
      console.error('Error deleting auth provider:', error);
      setError('Failed to delete authentication provider');
    }
  };

  const startEditing = (provider: AuthProvider) => {
    setEditingId(provider.id);
    setForm({
      provider: provider.provider,
      name: provider.name,
      client_id: provider.client_id,
      client_secret: provider.client_secret,
      issuer: provider.issuer || '',
      authorization_endpoint: provider.authorization_endpoint || '',
      token_endpoint: provider.token_endpoint || '',
      userinfo_endpoint: provider.userinfo_endpoint || '',
      enabled: provider.enabled
    });
    setShowAddForm(true);
    setError(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      provider: 'oauth',
      name: '',
      client_id: '',
      client_secret: '',
      issuer: '',
      authorization_endpoint: '',
      token_endpoint: '',
      userinfo_endpoint: '',
      enabled: false
    });
    setShowAddForm(false);
    setError(null);
  };

  if (loading && providers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <KeyRound className="mx-auto h-12 w-12 text-gray-400 animate-pulse" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Loading...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Authentication Providers
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure OAuth and OpenID Connect providers for your organization
          </p>
        </div>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-3 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Provider
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-md bg-red-50 dark:bg-red-900/30">
          <div className="flex">
            <div className="flex-shrink-0">
              <X className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                Error
              </h3>
              <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="mb-8 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Provider Type
                </label>
                <select
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value as 'oauth' | 'oidc' })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="oauth">OAuth 2.0</option>
                  <option value="oidc">OpenID Connect</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Display Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                  placeholder="e.g., Google, GitHub, Okta"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Client ID
                </label>
                <input
                  type="text"
                  value={form.client_id}
                  onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Client Secret
                </label>
                <input
                  type="password"
                  value={form.client_secret}
                  onChange={(e) => setForm({ ...form, client_secret: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono"
                  required
                />
              </div>
            </div>

            {form.provider === 'oidc' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Issuer URL
                </label>
                <input
                  type="url"
                  value={form.issuer}
                  onChange={(e) => setForm({ ...form, issuer: e.target.value })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                  placeholder="https://accounts.example.com"
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  The OpenID Connect issuer URL. Other endpoints will be discovered automatically.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Authorization Endpoint
                  </label>
                  <input
                    type="url"
                    value={form.authorization_endpoint}
                    onChange={(e) => setForm({ ...form, authorization_endpoint: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                    placeholder="https://example.com/oauth/authorize"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Token Endpoint
                  </label>
                  <input
                    type="url"
                    value={form.token_endpoint}
                    onChange={(e) => setForm({ ...form, token_endpoint: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                    placeholder="https://example.com/oauth/token"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    User Info Endpoint
                  </label>
                  <input
                    type="url"
                    value={form.userinfo_endpoint}
                    onChange={(e) => setForm({ ...form, userinfo_endpoint: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="https://example.com/oauth/userinfo"
                  />
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Optional. Used to fetch additional user information.
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                id="enabled"
              />
              <label htmlFor="enabled" className="ml-2 block text-sm text-gray-900 dark:text-white">
                Enable this provider
              </label>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-500 dark:hover:text-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Saving...' : editingId ? 'Save Changes' : 'Add Provider'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white dark:bg-gray-700 shadow-sm rounded-md overflow-hidden">
        {providers.map((provider) => (
          <div
            key={provider.id}
            className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600 last:border-0"
          >
            <div className="flex items-center">
              {provider.provider === 'oidc' ? (
                <Globe className="h-5 w-5 text-blue-500" />
              ) : (
                <KeyRound className="h-5 w-5 text-purple-500" />
              )}
              <div className="ml-3">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  {provider.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {provider.provider === 'oidc' ? 'OpenID Connect' : 'OAuth 2.0'}
                  {provider.provider === 'oidc' && provider.issuer && (
                    <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">
                      {provider.issuer}
                    </span>
                  )}
                </p>
              </div>
              {provider.enabled ? (
                <span className="ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Enabled
                </span>
              ) : (
                <span className="ml-4 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                  Disabled
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => startEditing(provider)}
                className="p-1 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                title="Edit provider"
              >
                <Pencil className="h-5 w-5" />
              </button>
              <button
                onClick={() => handleDelete(provider.id)}
                className="p-1 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                title="Delete provider"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </div>
          </div>
        ))}

        {providers.length === 0 && !showAddForm && (
          <div className="text-center py-12">
            <KeyRound className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No auth providers</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by adding an authentication provider.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}