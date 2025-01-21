import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Menu,
  Sun, 
  Moon, 
  LogOut, 
  UserCircle, 
  ChevronDown,
  X
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useSiteSettings } from '../hooks/useSiteSettings';
import { useProfile } from '../hooks/useProfile';
import { useOrganization } from '../hooks/useOrganization';
import { OrganizationSelector } from './OrganizationSelector';
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

export function TopBar({ toggleSidebar }: { toggleSidebar: () => void }) {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { siteSettings } = useSiteSettings();
  const { profile } = useProfile();
  const { currentOrganizationId, changeOrganization } = useOrganization();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const navMenuRef = useRef<HTMLDivElement>(null);
  const [navigationLinks, setNavigationLinks] = useState<TopBarLink[]>([]);
  const [socialLinks, setSocialLinks] = useState<TopBarLink[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLinks();
  }, []);

  const loadLinks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('topbar_links')
        .select('*')
        .order('order', { ascending: true });

      if (error) {
        console.error('Error loading top bar links:', error);
        setNavigationLinks([]);
        setSocialLinks([]);
        return;
      }

      // Split links into navigation and social
      const navLinks = data?.filter(link => !link.is_social) || [];
      const socLinks = data?.filter(link => link.is_social) || [];

      setNavigationLinks(navLinks);
      setSocialLinks(socLinks);
    } catch (error) {
      console.error('Error loading top bar links:', error);
      setNavigationLinks([]);
      setSocialLinks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (navMenuRef.current && !navMenuRef.current.contains(event.target as Node)) {
        setIsNavMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Get the appropriate logo based on theme
  const logoUrl = theme === 'dark' ? siteSettings?.dark_logo_url : siteSettings?.logo_url;

  return (
    <header className="bg-white dark:bg-gray-800 h-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
        <div className="flex justify-between h-full">
          {/* Left section: Logo */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
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
            </div>
          </div>

          {/* Right section: Navigation Menu, Social Links, User Menu, and Theme Toggle */}
          <div className="flex items-center space-x-4">
            {/* Navigation Menu Button */}
            {!loading && navigationLinks.length > 0 && (
              <div className="relative" ref={navMenuRef}>
                <button
                  onClick={() => setIsNavMenuOpen(!isNavMenuOpen)}
                  className="flex items-center px-3 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  {isNavMenuOpen ? (
                    <X className="h-6 w-6" />
                  ) : (
                    <Menu className="h-6 w-6" />
                  )}
                </button>

                {/* Navigation Menu Dropdown */}
                {isNavMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                      {navigationLinks.map(link => (
                        <a
                          key={link.id}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <IconComponent name={link.icon_name} />
                          <span className="ml-2">{link.name}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Social Media Links */}
            {!loading && socialLinks.length > 0 && (
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
            )}

            {/* User Menu */}
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Profile"
                    className="h-8 w-8 rounded-full mr-2 object-cover"
                  />
                ) : (
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name || profile?.email || '')}&background=random`}
                    alt="Profile"
                    className="h-8 w-8 rounded-full mr-2"
                  />
                )}
                <span className="hidden sm:block">{profile?.display_name || profile?.email}</span>
                <ChevronDown className="h-4 w-4 ml-1" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-md bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      navigate('/profile');
                    }}
                    className="flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <UserCircle className="h-5 w-5 mr-2" />
                    View Profile
                  </button>
                  <div className="border-t border-gray-200 dark:border-gray-600" />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
                  >
                    <LogOut className="h-5 w-5 mr-2" />
                    Logout
                  </button>
                </div>
              )}
            </div>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="ml-2 p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
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