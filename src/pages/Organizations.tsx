import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, Pencil, Trash2, Check, X, Plus, KeyRound, Bot } from 'lucide-react';
import type { Organization } from '../lib/types';
import { CreateOrgModal } from '../components/CreateOrgModal';
import { OrganizationAuthSettings } from './OrganizationAuthSettings';
import { OrganizationAISettings } from './OrganizationAISettings';

interface EditingState {
  id: string | null;
  mode: 'details' | 'auth' | 'ai';
}

export function Organizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<EditingState>({ id: null, mode: 'details' });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    slug: ''
  });

  useEffect(() => {
    loadOrganizations();
  }, []);

  async function loadOrganizations() {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      setLoading(false);
    }
  }

  const startEditing = (org: Organization, mode: EditingState['mode'] = 'details') => {
    setEditing({ id: org.id, mode });
    if (mode === 'details') {
      setEditForm({
        name: org.name,
        slug: org.slug
      });
    }
  };

  const cancelEditing = () => {
    setEditing({ id: null, mode: 'details' });
    setEditForm({ name: '', slug: '' });
  };

  const handleUpdate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: editForm.name,
          slug: editForm.slug,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      await loadOrganizations();
      cancelEditing();
    } catch (error) {
      console.error('Error updating organization:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this organization?')) return;
    
    try {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadOrganizations();
    } catch (error) {
      console.error('Error deleting organization:', error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  // If editing auth settings, show the auth settings component
  if (editing.mode === 'auth' && editing.id) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Organization Authentication
          </h2>
          <button
            onClick={cancelEditing}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Back to Organizations
          </button>
        </div>
        <OrganizationAuthSettings orgId={editing.id} />
      </div>
    );
  }

  // If editing AI settings, show the AI settings component
  if (editing.mode === 'ai' && editing.id) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Organization AI Settings
          </h2>
          <button
            onClick={cancelEditing}
            className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Back to Organizations
          </button>
        </div>
        <OrganizationAISettings orgId={editing.id} />
      </div>
    );
   }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 shadow p-6">
        <div className="sm:flex sm:items-center sm:justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Organizations
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Organization
          </button>
        </div>

        <div className="mt-4 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Name
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Slug
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Created At
                    </th>
                    <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {organizations.map((org) => (
                    <tr key={org.id}>
                      {editing.id === org.id && editing.mode === 'details' ? (
                        <>
                          <td className="whitespace-nowrap px-3 py-4">
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-4">
                            <input
                              type="text"
                              value={editForm.slug}
                              onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                            />
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {new Date(org.created_at).toLocaleDateString()}
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <button
                              onClick={() => handleUpdate(org.id)}
                              className="text-green-600 hover:text-green-900 dark:hover:text-green-400 mr-2"
                            >
                              <Check className="h-5 w-5" />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900 dark:text-white">
                            <div className="flex items-center">
                              {org.logo_url ? (
                                <img
                                  src={org.logo_url}
                                  alt={org.name}
                                  className="h-8 w-8 rounded-full mr-2 object-cover"
                                />
                              ) : (
                                <Building2 className="h-5 w-5 mr-2 text-gray-400" />
                              )}
                              {org.name}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {org.slug}
                          </td>
                          <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                            {new Date(org.created_at).toLocaleDateString()}
                          </td>
                          <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <button
                              onClick={() => startEditing(org, 'ai')}
                              className="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 mr-2"
                              title="AI Settings"
                            >
                              <Bot className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => startEditing(org, 'auth')}
                              className="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 mr-2"
                              title="Authentication Settings"
                            >
                              <KeyRound className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => startEditing(org, 'details')}
                              className="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 mr-2"
                            >
                              <Pencil className="h-5 w-5" />
                            </button>
                            <button
                              onClick={() => handleDelete(org.id)}
                              className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <CreateOrgModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadOrganizations}
      />
    </>
  );
}