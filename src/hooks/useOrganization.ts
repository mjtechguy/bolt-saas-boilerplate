import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useProfile } from './useProfile';

export function useOrganization() {
  const [currentOrganizationId, setCurrentOrganizationId] = useState<string | null>(() => {
    return localStorage.getItem('organization_id');
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useProfile();

  useEffect(() => {
      loadUserOrganizations();
  }, [profile]);

  // const loadUserOrganizations = async () => {
  //   try {
  //     setLoading(true);
  //     setError(null);

  //     // Fetch user's organizations from Supabase
  //     const { data: userOrgs, error: orgsError } = await supabase
  //       .from('user_organizations')
  //       .select(`
  //         organization:organizations (
  //           id,
  //           name,
  //           slug,
  //           logo_url
  //         )
  //       `);

  //     if (orgsError) throw orgsError;

  //     // Filter out null organizations and get unique ones
  //     const orgs = userOrgs
  //       .map(uo => uo.organization)
  //       .filter((org): org is NonNullable<typeof org> => org !== null);

  //     if (orgs.length === 0) {
  //       // If user has no organizations, wait for the default org trigger to handle it
  //       return;
  //     }

  //     // Get saved org ID from localStorage
  //     const savedOrgId = localStorage.getItem('organization_id');

  //     // If user has exactly one organization, select it
  //     if (orgs.length === 1) {
  //       setCurrentOrganizationId(orgs[0].id);
  //       localStorage.setItem('organization_id', orgs[0].id);
  //     }
  //     // If user has multiple organizations and has a valid saved selection, use it
  //     else if (savedOrgId && orgs.some(org => org.id === savedOrgId)) {
  //       setCurrentOrganizationId(savedOrgId);
  //     }
  //     // Otherwise, select the first organization
  //     else {
  //       setCurrentOrganizationId(orgs[0].id);
  //       localStorage.setItem('organization_id', orgs[0].id);
  //     }
  //   } catch (error) {
  //     console.error('Error loading organizations:', error);
  //     setError('Failed to load organizations');
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const loadUserOrganizations = async () => {
    console.log(profile, 'profile from useOrganization')
    try {
      setLoading(true);
      setError(null);
  
      // Fetch user's organizations from Supabase
      const { data: userOrgs, error: orgsError } = await supabase
        .from('user_organizations')
        .select(`
          organization:organizations (
            id,
            name,
            slug,
            logo_url
          ),
          role
        `);
  
      if (orgsError) throw orgsError;
  
      // Filter out null organizations and get unique ones
      const orgs = userOrgs
        .map(uo => ({
          ...uo.organization, // Spread the organization data
          role: uo.role, // Include the role from user_organizations
        }))
        .filter((org): org is NonNullable<typeof org> => org !== null);
  
      if (orgs.length === 0) {
        // If user has no organizations, wait for the default org trigger to handle it
        return;
      }
  
      // Get saved org ID from localStorage
      const savedOrgId = localStorage.getItem('organization_id');
  
      // Check if the user is a global admin
      if (profile?.is_global_admin) {
        // If the user is a global admin, set the role to 'admin'
        console.log('true admin')
        localStorage.setItem('userOrgRole', 'admin');
      } else {
        // If user has exactly one organization, select it
        if (orgs.length === 1) {
          setCurrentOrganizationId(orgs[0].id);
          localStorage.setItem('organization_id', orgs[0].id);
          localStorage.setItem('userOrgRole', orgs[0].role); // Save the role to localStorage
        }
        // If user has multiple organizations and has a valid saved selection, use it
        else if (savedOrgId && orgs.some(org => org.id === savedOrgId)) {
          const selectedOrg = orgs.find(org => org.id === savedOrgId);
          setCurrentOrganizationId(savedOrgId);
          localStorage.setItem('userOrgRole', selectedOrg?.role || ''); // Save the role to localStorage
        }
        // Otherwise, select the first organization
        else {
          setCurrentOrganizationId(orgs[0].id);
          localStorage.setItem('organization_id', orgs[0].id);
          localStorage.setItem('userOrgRole', orgs[0].role); // Save the role to localStorage
        }
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

      // Check if user is global admin or if they have access to the organization
      if (profile?.is_global_admin) {
        const { data, error } = await supabase
          .from('organizations') // Fetch directly from 'organizations' table
          .select('id, name, slug, logo_url') // Select necessary fields
          .eq('id', organizationId)
          .single(); // Get a single result

        if (error) {
          console.error('Error fetching organization:', error);
        } else {
          // Optionally, handle organization details here
        }

        if (error) throw error;
      } else {
        // Verify the organization exists and user has access
        const { data, error } = await supabase
          .from('user_organizations')
          .select('organization_id')
          .eq('organization_id', organizationId)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Organization not found');
      }

      // Set the current organization ID and store it in localStorage
      setCurrentOrganizationId(organizationId);
      localStorage.setItem('organization_id', organizationId);

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
