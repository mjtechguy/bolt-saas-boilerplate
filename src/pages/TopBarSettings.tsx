import React, { useState, useEffect } from 'react';
import { X as XIcon, Search, Plus, Pencil, Trash2, GripVertical } from 'lucide-react';
import * as Icons from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TopBarLink {
  id: string;
  name: string;
  url: string;
  icon_name: string;
  order: number;
  is_social: boolean;
}

// Curated list of social media icons
const SOCIAL_ICONS = [
  { name: 'Twitter', icon: 'Twitter' },
  { name: 'Facebook', icon: 'Facebook' },
  { name: 'Instagram', icon: 'Instagram' },
  { name: 'LinkedIn', icon: 'Linkedin' },
  { name: 'GitHub', icon: 'Github' },
  { name: 'YouTube', icon: 'Youtube' },
  { name: 'Discord', icon: 'MessageSquare' },
  { name: 'Twitch', icon: 'Twitch' },
  { name: 'RSS', icon: 'Rss' },
  { name: 'Email', icon: 'Mail' }
];

// Get all available icons from lucide-react
const AVAILABLE_ICONS = Object.keys(Icons)
  .filter(key => typeof (Icons as any)[key] === 'function' && key !== 'createLucideIcon')
  .sort();

export function TopBarSettings() {
  const [links, setLinks] = useState<TopBarLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [iconSearch, setIconSearch] = useState('');
  const [form, setForm] = useState({
    name: '',
    url: '',
    icon_name: '',
    is_social: false
  });

  useEffect(() => {
    loadLinks();
  }, []);

  async function loadLinks() {
    try {
      const { data, error } = await supabase
        .from('topbar_links')
        .select('*')
        .order('order', { ascending: true });

      if (error) throw error;
      setLinks(data || []);
    } catch (error) {
      console.error('Error loading links:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingId) {
        const { error } = await supabase
          .from('topbar_links')
          .update({
            name: form.name,
            url: form.url,
            icon_name: form.icon_name,
            is_social: form.is_social,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('topbar_links')
          .insert([{
            name: form.name,
            url: form.url,
            icon_name: form.icon_name,
            is_social: form.is_social,
            order: links.length
          }]);

        if (error) throw error;
      }

      await loadLinks();
      resetForm();
    } catch (error) {
      console.error('Error saving link:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this link?')) return;
    
    try {
      const { error } = await supabase
        .from('topbar_links')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadLinks();
    } catch (error) {
      console.error('Error deleting link:', error);
    }
  };

  const startEditing = (link: TopBarLink) => {
    setEditingId(link.id);
    setForm({
      name: link.name,
      url: link.url,
      icon_name: link.icon_name,
      is_social: link.is_social
    });
    setShowAddForm(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm({
      name: '',
      url: '',
      icon_name: '',
      is_social: false
    });
    setShowAddForm(false);
    setIconSearch('');
  };

  const filteredIcons = iconSearch
    ? AVAILABLE_ICONS.filter(icon => 
        icon.toLowerCase().includes(iconSearch.toLowerCase())
      )
    : AVAILABLE_ICONS;

  const renderIcon = (iconName: string) => {
    const Icon = (Icons as any)[iconName];
    return Icon ? <Icon className="h-5 w-5" /> : null;
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Top Bar Links
        </h2>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-3 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Link
          </button>
        )}
      </div>

      {showAddForm && (
        <div className="mb-8 bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Type
              </label>
              <div className="mt-2">
                <div className="flex items-center space-x-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      checked={!form.is_social}
                      onChange={() => setForm({ ...form, is_social: false })}
                      className="form-radio text-indigo-600"
                    />
                    <span className="ml-2 text-gray-700 dark:text-gray-300">Navigation Link</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      checked={form.is_social}
                      onChange={() => setForm({ ...form, is_social: true })}
                      className="form-radio text-indigo-600"
                    />
                    <span className="ml-2 text-gray-700 dark:text-gray-300">Social Media</span>
                  </label>
                </div>
              </div>
            </div>

            {form.is_social ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Social Media Icon
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1">
                  {SOCIAL_ICONS.map(({ name, icon }) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setForm({ ...form, icon_name: icon })}
                      className={`flex items-center p-1.5 rounded-md ${
                        form.icon_name === icon
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                          : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                    >
                      {renderIcon(icon)}
                      <span className="ml-1.5 text-sm">{name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Icon
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={iconSearch}
                    onChange={(e) => setIconSearch(e.target.value)}
                    placeholder="Search icons..."
                    className="block w-full pl-10 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div className="mt-2 grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-14 gap-1 max-h-48 overflow-y-auto">
                  {filteredIcons.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setForm({ ...form, icon_name: icon })}
                      className={`p-1.5 rounded-md flex items-center justify-center ${
                        form.icon_name === icon
                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'
                          : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
                      }`}
                      title={icon}
                    >
                      {renderIcon(icon)}
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                disabled={loading || !form.icon_name}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Saving...' : editingId ? 'Save Changes' : 'Add Link'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mt-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Navigation Links</h3>
        <div className="bg-white dark:bg-gray-700 shadow-sm rounded-md overflow-hidden">
          {links.filter(link => !link.is_social).map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600 last:border-0"
            >
              <div className="flex items-center">
                <GripVertical className="h-5 w-5 text-gray-400 mr-3" />
                <div className="flex items-center">
                  {renderIcon(link.icon_name)}
                  <span className="ml-3 text-gray-900 dark:text-white">{link.name}</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => startEditing(link)}
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
            </div>
          ))}
        </div>

        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 mt-8">Social Media Links</h3>
        <div className="bg-white dark:bg-gray-700 shadow-sm rounded-md overflow-hidden">
          {links.filter(link => link.is_social).map((link) => (
            <div
              key={link.id}
              className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600 last:border-0"
            >
              <div className="flex items-center">
                <GripVertical className="h-5 w-5 text-gray-400 mr-3" />
                <div className="flex items-center">
                  {renderIcon(link.icon_name)}
                  <span className="ml-3 text-gray-900 dark:text-white">{link.name}</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => startEditing(link)}
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}