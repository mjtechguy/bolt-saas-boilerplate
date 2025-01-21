import React from 'react';
import { Link } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { supabase } from '../lib/supabase';

interface TopBarLink {
  id: string;
  name: string;
  url: string;
  icon_name: string;
  order: number;
  is_social: boolean;
}

const IconComponent = ({ name }: { name: string }) => {
  const Icon = (Icons as any)[name];
  return Icon ? <Icon className="h-5 w-5" /> : null;
};

export function PublicTopBar() {
  const { theme, toggleTheme } = useTheme();
  const { siteSettings } = useSiteSettings();
  const [navigationLinks, setNavigationLinks] = React.useState<TopBarLink[]>([]);
  const [socialLinks, setSocialLinks] = React.useState<TopBarLink[]>([]);

  React.useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('topbar_links')
        .select('*')
        .order('order', { ascending: true });

      if (error) throw error;

      // Split links into navigation and social
      const navLinks = data?.filter(link => !link.is_social) || [];
      const socLinks = data?.filter(link => link.is_social) || [];

      setNavigationLinks(navLinks);
      setSocialLinks(socLinks);
    } catch (error) {
      console.error('Error loading top bar links:', error);
    }
  };

  // Get the appropriate logo based on theme
  const logoUrl = theme === 'dark' ? siteSettings?.dark_logo_url : siteSettings?.logo_url;

  return (
    <header className="bg-white dark:bg-gray-800 h-16 border-b border-gray-200 dark:border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex justify-between h-full">
          {/* Left section: Logo */}
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center">
              {logoUrl ? (
                <img
                  className="h-8 w-auto"
                  src={logoUrl}
                  alt={siteSettings?.site_name}
                />
              ) : (
                <span className="text-xl font-bold text-gray-900 dark:text-white">
                  {siteSettings?.site_name || 'My Application'}
                </span>
              )}
            </Link>
          </div>

          {/* Center section: Navigation Links */}
          <nav className="hidden md:flex items-center space-x-4">
            {navigationLinks.map(link => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white px-3 py-2 text-sm font-medium flex items-center"
              >
                <IconComponent name={link.icon_name} />
                <span className="ml-2">{link.name}</span>
              </a>
            ))}
          </nav>

          {/* Right section: Social Links, Auth Buttons, and Theme Toggle */}
          <div className="flex items-center space-x-4">
            {/* Social Media Links */}
            <div className="hidden md:flex items-center space-x-2">
              {socialLinks.map(link => (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <IconComponent name={link.icon_name} />
                </a>
              ))}
            </div>

            {/* Auth Buttons */}
            <div className="flex items-center space-x-3">
              <Link
                to="/login"
                className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2 text-sm font-medium"
              >
                Sign in
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
              >
                Sign up
              </Link>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
            >
              {theme === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}