import React, { useState } from 'react';
import { X, Upload, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/types';

interface CreateOrgModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateOrgModal({ isOpen, onClose, onSuccess }: CreateOrgModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [form, setForm] = useState({
    name: '',
    adminEmail: '',
    logo: null as File | null
  });

  // Load available users when modal opens
  React.useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('email');

      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!form.name.trim()) {
        throw new Error('Organization name is required');
      }

      if (!form.adminEmail) {
        throw new Error('Organization admin is required');
      }

      let logoUrl = null;

      // Handle logo upload if provided
      if (form.logo) {
        const fileExt = form.logo.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const { error: uploadError, data } = await supabase.storage
          .from('logos')
          .upload(fileName, form.logo);

        if (uploadError) throw uploadError;
        if (data) {
          const { data: { publicUrl } } = supabase.storage
            .from('logos')
            .getPublicUrl(data.path);
          logoUrl = publicUrl;
        }
      }

      // Create organization
      const slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert([{
          name: form.name,
          slug,
          logo_url: logoUrl
        }])
        .select()
        .single();

      if (orgError) throw orgError;

      // Get the admin user's ID
      const adminUser = availableUsers.find(user => user.email === form.adminEmail);
      if (!adminUser) throw new Error('Selected admin user not found');

      // Add admin to organization with organization_admin role
      const { error: memberError } = await supabase
        .from('user_organizations')
        .insert([{
          user_id: adminUser.id,
          organization_id: org.id,
          role: 'organization_admin'
        }]);

      if (memberError) throw memberError;

      onSuccess();
      onClose();
      setForm({ name: '', adminEmail: '', logo: null });
    } catch (error) {
      console.error('Error creating organization:', error);
      setError(error instanceof Error ? error.message : 'Failed to create organization');
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
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
              <Building2 className="h-5 w-5 mr-2" />
              Create New Organization
            </h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Organization Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Organization Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Enter organization name"
              />
            </div>

            {/* Organization Admin */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Organization Admin
              </label>
              <select
                value={form.adminEmail}
                onChange={(e) => setForm({ ...form, adminEmail: e.target.value })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">Select an admin</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.email}>
                    {user.display_name || user.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Organization Logo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Organization Logo
              </label>
              <div className="mt-1 flex items-center space-x-4">
                {form.logo && (
                  <img
                    src={URL.createObjectURL(form.logo)}
                    alt="Preview"
                    className="h-12 w-12 rounded-full object-cover"
                  />
                )}
                <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                  <Upload className="h-5 w-5 mr-2" />
                  Upload Logo
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={(e) => setForm({ ...form, logo: e.target.files?.[0] || null })}
                  />
                </label>
              </div>
            </div>

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
                {loading ? 'Creating...' : 'Create Organization'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}