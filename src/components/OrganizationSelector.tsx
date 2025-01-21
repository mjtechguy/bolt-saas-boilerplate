import React, { useState, useEffect, useRef } from 'react';
import { Building2, ChevronDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Organization } from '../lib/types';

interface OrganizationSelectorProps {
  currentOrganizationId: string | null;
  onOrganizationChange: (organizationId: string) => void;
}

export function OrganizationSelector({ currentOrganizationId, onOrganizationChange }: OrganizationSelectorProps) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadOrganizations();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadOrganizations = async () => {
    try {
      const { data: userOrgs, error } = await supabase
        .from('user_organizations')
        .select(`
          organization:organizations (
            id,
            name,
            slug,
            logo_url
          )
        `);

      if (error) throw error;

      const orgs = userOrgs
        .map(uo => uo.organization)
        .filter((org): org is Organization => org !== null)
        .sort((a, b) => a.name.localeCompare(b.name));

      setOrganizations(orgs);

      // If no current organization is selected and we have multiple orgs, show selector
      if (!currentOrganizationId && orgs.length > 1) {
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const currentOrg = organizations.find(org => org.id === currentOrganizationId);

  if (loading) {
    return (
      <div className="h-10 w-48 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-md"></div>
    );
  }

  if (organizations.length === 0) {
    return null;
  }

  // If there's only one organization, just show it without dropdown functionality
  if (organizations.length === 1) {
    const org = organizations[0];
    return (
      <div className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200">
        {org.logo_url ? (
          <img
            src={org.logo_url}
            alt={org.name}
            className="h-6 w-6 rounded-md object-cover"
          />
        ) : (
          <Building2 className="h-5 w-5 text-gray-400" />
        )}
        <span className="truncate max-w-[150px]">{org.name}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        {currentOrg?.logo_url ? (
          <img
            src={currentOrg.logo_url}
            alt={currentOrg.name}
            className="h-6 w-6 rounded-md object-cover"
          />
        ) : (
          <Building2 className="h-5 w-5 text-gray-400" />
        )}
        <span className="truncate max-w-[150px]">
          {currentOrg?.name || 'Select Organization'}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-500" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-64 rounded-md bg-white dark:bg-gray-800 shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            {organizations.map((org) => (
              <button
                key={org.id}
                onClick={() => {
                  onOrganizationChange(org.id);
                  setIsOpen(false);
                }}
                className={`flex items-center w-full px-4 py-2 text-sm ${
                  org.id === currentOrganizationId
                    ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {org.logo_url ? (
                  <img
                    src={org.logo_url}
                    alt={org.name}
                    className="h-6 w-6 rounded-md object-cover mr-3"
                  />
                ) : (
                  <Building2 className="h-5 w-5 text-gray-400 mr-3" />
                )}
                <span className="truncate">{org.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}