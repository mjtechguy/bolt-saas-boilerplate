import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus, Pencil, Trash2, Check, X, Shield, ShieldOff, Building2 } from 'lucide-react';
import type { Profile, Organization } from '../lib/types';

interface UserOrganization {
  organization_id: string;
  role: 'organization_admin' | 'team_admin' | 'user';
}

export function Profiles() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    email: '',
    is_global_admin: false
  });
  const [showOrgModal, setShowOrgModal] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userOrgs, setUserOrgs] = useState<UserOrganization[]>([]);
  const [orgForm, setOrgForm] = useState({
    organization_id: '',
    role: 'user' as 'organization_admin' | 'team_admin' | 'user'
  });

  useEffect(() => {
    loadProfiles();
    loadOrganizations();
  }, []);

  async function loadProfiles() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadOrganizations() {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .order('name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error('Error loading organizations:', error);
    }
  }

  async function loadUserOrganizations(userId: string) {
    try {
      const { data, error } = await supabase
        .from('user_organizations')
        .select('organization_id, role')
        .eq('user_id', userId);

      if (error) throw error;
      setUserOrgs(data || []);
    } catch (error) {
      console.error('Error loading user organizations:', error);
    }
  }

  const startEditing = (profile: Profile) => {
    setEditingId(profile.id);
    setEditForm({
      email: profile.email,
      is_global_admin: profile.is_global_admin
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditForm({ email: '', is_global_admin: false });
  };

  const handleUpdate = async (id: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          email: editForm.email,
          is_global_admin: editForm.is_global_admin,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      await loadProfiles();
      cancelEditing();
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const toggleAdminStatus = async (profile: Profile) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_global_admin: !profile.is_global_admin,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (error) throw error;
      await loadProfiles();
    } catch (error) {
      console.error('Error toggling admin status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this profile?')) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadProfiles();
    } catch (error) {
      console.error('Error deleting profile:', error);
    }
  };

  const openOrgModal = async (userId: string) => {
    setSelectedUserId(userId);
    await loadUserOrganizations(userId);
    setShowOrgModal(true);
  };

  const handleAddToOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !orgForm.organization_id) return;

    try {
      const { error } = await supabase
        .from('user_organizations')
        .insert([{
          user_id: selectedUserId,
          organization_id: orgForm.organization_id,
          role: orgForm.role
        }]);

      if (error) throw error;
      await loadUserOrganizations(selectedUserId);
      setOrgForm({
        organization_id: '',
        role: 'user'
      });
    } catch (error) {
      console.error('Error adding user to organization:', error);
    }
  };

  const removeFromOrg = async (organizationId: string) => {
    if (!selectedUserId) return;
    if (!window.confirm('Are you sure you want to remove this user from the organization?')) return;

    try {
      const { error } = await supabase
        .from('user_organizations')
        .delete()
        .eq('user_id', selectedUserId)
        .eq('organization_id', organizationId);

      if (error) throw error;
      await loadUserOrganizations(selectedUserId);
    } catch (error) {
      console.error('Error removing user from organization:', error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          User Profiles
        </h2>
        <button
          onClick={() => {/* TODO: Implement invite user */}}
          className="mt-3 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <UserPlus className="h-5 w-5 mr-2" />
          Invite User
        </button>
      </div>

      <div className="mt-4 flex flex-col">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Email
                  </th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Role
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
                {profiles.map((profile) => (
                  <tr key={profile.id}>
                    {editingId === profile.id ? (
                      <>
                        <td className="whitespace-nowrap px-3 py-4">
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white sm:text-sm"
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-4">
                          <label className="inline-flex items-center">
                            <input
                              type="checkbox"
                              checked={editForm.is_global_admin}
                              onChange={(e) => setEditForm({ ...editForm, is_global_admin: e.target.checked })}
                              className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                            <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                              Global Admin
                            </span>
                          </label>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {new Date(profile.created_at).toLocaleDateString()}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <button
                            onClick={() => handleUpdate(profile.id)}
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
                          {profile.email}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          <div className="flex items-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              profile.is_global_admin 
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                            }`}>
                              {profile.is_global_admin ? 'Global Admin' : 'User'}
                            </span>
                            <button
                              onClick={() => toggleAdminStatus(profile)}
                              className={`ml-2 p-1 rounded-full ${
                                profile.is_global_admin
                                  ? 'text-purple-600 hover:text-purple-900 dark:hover:text-purple-400'
                                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                              }`}
                              title={profile.is_global_admin ? 'Remove admin rights' : 'Make admin'}
                            >
                              {profile.is_global_admin ? (
                                <ShieldOff className="h-4 w-4" />
                              ) : (
                                <Shield className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                          {new Date(profile.created_at).toLocaleDateString()}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <button
                            onClick={() => openOrgModal(profile.id)}
                            className="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 mr-2"
                            title="Manage Organizations"
                          >
                            <Building2 className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => startEditing(profile)}
                            className="text-indigo-600 hover:text-indigo-900 dark:hover:text-indigo-400 mr-2"
                          >
                            <Pencil className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(profile.id)}
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

      {/* Organization Management Modal */}
      {showOrgModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={() => setShowOrgModal(false)} />

            {/* Modal */}
            <div className="relative w-full max-w-md transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 p-6 text-left shadow-xl transition-all">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Manage Organizations
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Add or remove user from organizations
                </p>
              </div>

              {/* Current Organizations */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Organizations
                </h4>
                {userOrgs.length > 0 ? (
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {userOrgs.map((userOrg) => {
                      const org = organizations.find(o => o.id === userOrg.organization_id);
                      return (
                        <li key={userOrg.organization_id} className="py-3 flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {org?.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {userOrg.role}
                            </p>
                          </div>
                          <button
                            onClick={() => removeFromOrg(userOrg.organization_id)}
                            className="text-red-600 hover:text-red-900 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    User is not a member of any organizations
                  </p>
                )}
              </div>

              {/* Add to Organization Form */}
              <form onSubmit={handleAddToOrg} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Organization
                  </label>
                  <select
                    value={orgForm.organization_id}
                    onChange={(e) => setOrgForm({ ...orgForm, organization_id: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                  >
                    <option value="">Select an organization</option>
                    {organizations
                      .filter(org => !userOrgs.some(uo => uo.organization_id === org.id))
                      .map(org => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Role
                  </label>
                  <select
                    value={orgForm.role}
                    onChange={(e) => setOrgForm({ ...orgForm, role: e.target.value as 'organization_admin' | 'team_admin' | 'user' })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                  >
                    <option value="user">User</option>
                    <option value="team_admin">Team Admin</option>
                    <option value="organization_admin">Organization Admin</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowOrgModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-500 dark:hover:text-gray-400"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Add to Organization
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}