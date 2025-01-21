import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface SiteSettings {
  id: string;
  site_name: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  created_at: string;
  updated_at: string;
}

export function useSiteSettings() {
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function loadSiteSettings() {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('*')
          .single();

        if (error) throw error;
        setSiteSettings(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load site settings'));
      } finally {
        setLoading(false);
      }
    }

    loadSiteSettings();
  }, []);

  return { siteSettings, loading, error };
}