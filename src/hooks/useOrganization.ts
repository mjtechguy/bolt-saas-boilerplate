import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useOrganization() {
  const [currentOrganizationId, setCurrentOrganizationId] = useState<string | null>(() => {
    return localStorage.getItem('currentOrganizationId');
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadUserOrganizations();
  }, []);

  const loadUserOrganizations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get user's organizations
      const { data: userOrgs, error: orgsError } = await supabase
        .from('user_organizations')
        .select(`
          organization:organizations (
            id,
            name,
            slug,
            logo_url
          )
        `);

      if (orgsError) throw orgsError;

      // Filter out null organizations and get unique ones
      const orgs = userOrgs
        .map(uo => uo.organization)
        .filter((org): org is NonNullable<typeof org> => org !== null);

      if (orgs.length === 0) {
        // User has no organizations, wait for the default org trigger to handle it
        return;
      }

      // Get saved org ID
      const savedOrgId = localStorage.getItem('currentOrganizationId');

      // If user has exactly one organization, select it
      if (orgs.length === 1) {
        setCurrentOrganizationId(orgs[0].id);
        localStorage.setItem('currentOrganizationId', orgs[0].id);
      } 
      // If user has multiple orgs and has a valid saved selection, use it
      else if (savedOrgId && orgs.some(org => org.id === savedOrgId)) {
        setCurrentOrganizationId(savedOrgId);
      }
      // Otherwise, select the first org
      else {
        setCurrentOrganizationId(orgs[0].id);
        localStorage.setItem('currentOrganizationId', orgs[0].id);
      }
    } catch (error) {
      console.error('Error loading organizations:', error);
      setError('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const changeOrganization = async (organizationId: string) => {
    try {
      setError(null);
      
      // Verify the organization exists and user has access
      const { data, error } = await supabase
        .from('user_organizations')
        .select('organization_id')
        .eq('organization_id', organizationId)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Organization not found');

      setCurrentOrganizationId(organizationId);
      localStorage.setItem('currentOrganizationId', organizationId);
    } catch (error) {
      console.error('Error changing organization:', error);
      setError('Failed to change organization');
    }
  };

  return {
    currentOrganizationId,
    changeOrganization,
    loading,
    error
  };
}