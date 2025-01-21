import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Upload, Sun, Moon } from 'lucide-react';

export function Settings() {
  const [loading, setLoading] = useState(false);
  const [siteName, setSiteName] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#4F46E5');
  const [secondaryColor, setSecondaryColor] = useState('#6366F1');
  const [lightLogo, setLightLogo] = useState<File | null>(null);
  const [darkLogo, setDarkLogo] = useState<File | null>(null);
  const [currentLightLogo, setCurrentLightLogo] = useState<string | null>(null);
  const [currentDarkLogo, setCurrentDarkLogo] = useState<string | null>(null);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('*')
        .limit(1)
        .single();

      if (error) throw error;
      if (data) {
        setSiteName(data.site_name);
        setPrimaryColor(data.primary_color);
        setSecondaryColor(data.secondary_color);
        setCurrentLightLogo(data.logo_url);
        setCurrentDarkLogo(data.dark_logo_url);
        setSettingsId(data.id);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings' });
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      let lightLogoUrl = currentLightLogo;
      let darkLogoUrl = currentDarkLogo;

      // Handle light mode logo upload
      if (lightLogo) {
        const fileExt = lightLogo.name.split('.').pop();
        const fileName = `light_${Math.random()}.${fileExt}`;
        const { error: uploadError, data } = await supabase.storage
          .from('logos')
          .upload(fileName, lightLogo);

        if (uploadError) throw uploadError;
        if (data) {
          const { data: { publicUrl } } = supabase.storage
            .from('logos')
            .getPublicUrl(data.path);
          lightLogoUrl = publicUrl;
        }
      }

      // Handle dark mode logo upload
      if (darkLogo) {
        const fileExt = darkLogo.name.split('.').pop();
        const fileName = `dark_${Math.random()}.${fileExt}`;
        const { error: uploadError, data } = await supabase.storage
          .from('logos')
          .upload(fileName, darkLogo);

        if (uploadError) throw uploadError;
        if (data) {
          const { data: { publicUrl } } = supabase.storage
            .from('logos')
            .getPublicUrl(data.path);
          darkLogoUrl = publicUrl;
        }
      }

      const updateData = {
        site_name: siteName,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        logo_url: lightLogoUrl,
        dark_logo_url: darkLogoUrl,
        updated_at: new Date().toISOString(),
      };

      let error;
      if (settingsId) {
        // Update existing settings
        ({ error } = await supabase
          .from('site_settings')
          .update(updateData)
          .eq('id', settingsId));
      } else {
        // Insert new settings if none exist
        ({ error } = await supabase
          .from('site_settings')
          .insert([updateData]));
      }

      if (error) throw error;
      setMessage({ type: 'success', text: 'Settings updated successfully' });

      // Update CSS variables for immediate color changes
      document.documentElement.style.setProperty('--primary-color', primaryColor);
      document.documentElement.style.setProperty('--secondary-color', secondaryColor);
    } catch (error) {
      console.error('Error updating settings:', error);
      setMessage({ type: 'error', text: 'Failed to update settings' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Site Settings
      </h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Site Name
          </label>
          <input
            type="text"
            value={siteName}
            onChange={(e) => setSiteName(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Logos</h3>
          
          {/* Light Mode Logo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <div className="flex items-center">
                <Sun className="h-5 w-5 mr-2" />
                Light Mode Logo
              </div>
            </label>
            <div className="flex items-center space-x-4">
              {(currentLightLogo || lightLogo) && (
                <div className="bg-gray-100 p-2 rounded-md">
                  <img
                    src={lightLogo ? URL.createObjectURL(lightLogo) : currentLightLogo!}
                    alt="Light Logo Preview"
                    className="h-12 object-contain"
                  />
                </div>
              )}
              <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                <Upload className="h-5 w-5 mr-2" />
                Upload Light Logo
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => setLightLogo(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>

          {/* Dark Mode Logo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <div className="flex items-center">
                <Moon className="h-5 w-5 mr-2" />
                Dark Mode Logo
              </div>
            </label>
            <div className="flex items-center space-x-4">
              {(currentDarkLogo || darkLogo) && (
                <div className="bg-gray-800 p-2 rounded-md">
                  <img
                    src={darkLogo ? URL.createObjectURL(darkLogo) : currentDarkLogo!}
                    alt="Dark Logo Preview"
                    className="h-12 object-contain"
                  />
                </div>
              )}
              <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600">
                <Upload className="h-5 w-5 mr-2" />
                Upload Dark Logo
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => setDarkLogo(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Primary Color
            </label>
            <div className="mt-1 flex items-center space-x-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Secondary Color
            </label>
            <div className="mt-1 flex items-center space-x-3">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="h-10 w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>
        </div>

        {message && (
          <div className={`rounded-md p-4 ${
            message.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900 text-green-700 dark:text-green-200' 
              : 'bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-200'
          }`}>
            {message.text}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}