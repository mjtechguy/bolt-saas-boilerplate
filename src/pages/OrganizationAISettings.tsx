import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Bot, AlertCircle, Check, X } from 'lucide-react';

interface AISettings {
  id: string;
  endpoint_url: string;
  api_key: string;
  model: string;
  max_output_tokens: number;
  max_total_tokens: number | null;
  enabled: boolean;
  disclaimer_message: string;
  created_at: string;
  updated_at: string;
}

interface Model {
  id: string;
  created: number;
  owned_by: string;
}

interface OrganizationAISettingsProps {
  orgId: string;
}

export function OrganizationAISettings({ orgId }: OrganizationAISettingsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [models, setModels] = useState<Model[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<AISettings, 'id' | 'created_at' | 'updated_at'>>({
    endpoint_url: 'https://api.openai.com/v1/chat/completions',
    api_key: '',
    model: '',
    max_output_tokens: 4096,
    max_total_tokens: null,
    enabled: true,
    disclaimer_message: 'AI can make mistakes. Consider checking important information.'
  });

  useEffect(() => {
    loadSettings();
  }, [orgId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('organization_ai_settings')
        .select('*')
        .eq('organization_id', orgId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No settings found, use defaults
          return;
        }
        throw error;
      }
      
      if (data) {
        setSettingsId(data.id);
        setForm({
          endpoint_url: data.endpoint_url,
          api_key: data.api_key,
          model: data.model,
          max_output_tokens: data.max_output_tokens,
          max_total_tokens: data.max_total_tokens,
          enabled: data.enabled,
          disclaimer_message: data.disclaimer_message || 'AI can make mistakes. Consider checking important information.'
        });

        // Load models if we have an API key
        if (data.api_key) {
          loadModels(data.api_key);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setError('Failed to load AI settings');
    } finally {
      setLoading(false);
    }
  };

  const loadModels = async (apiKey: string) => {
    try {
      setLoadingModels(true);
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      // Filter for chat models only
      const chatModels = data.data.filter((model: Model) => 
        model.id.includes('gpt') && !model.id.includes('instruct')
      ).sort((a: Model, b: Model) => b.created - a.created);
      setModels(chatModels);
    } catch (error) {
      console.error('Error loading models:', error);
      setError('Failed to load available models. Please check your API key.');
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { error: upsertError } = await supabase
        .from('organization_ai_settings')
        .upsert({
          id: settingsId,
          organization_id: orgId,
          ...form,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'organization_id'
        });

      if (upsertError) throw upsertError;
      
      setSuccess('AI settings updated successfully');
      
      // Reload settings to get the new ID if it was an insert
      await loadSettings();
      
      // Reload models if API key changed
      if (form.api_key) {
        await loadModels(form.api_key);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setError(error instanceof Error ? error.message : 'Failed to save AI settings');
    } finally {
      setLoading(false);
    }
  };

  const handleApiKeyChange = async (value: string) => {
    setForm(prev => ({ ...prev, api_key: value }));
    if (value) {
      await loadModels(value);
    } else {
      setModels([]);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Bot className="mx-auto h-12 w-12 text-gray-400 animate-pulse" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Loading...</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center">
          <Bot className="h-6 w-6 mr-2" />
          AI Settings
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure AI integration settings for your organization
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            API Endpoint URL
          </label>
          <input
            type="url"
            value={form.endpoint_url}
            onChange={(e) => setForm({ ...form, endpoint_url: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            required
            placeholder="https://api.openai.com/v1/chat/completions"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            API Key
          </label>
          <input
            type="password"
            value={form.api_key}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono"
            required
          />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Enter your OpenAI API key to fetch available models
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Model
          </label>
          <select
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            required
          >
            <option value="">Select a model</option>
            {loadingModels ? (
              <option value="" disabled>Loading models...</option>
            ) : (
              models.map(model => (
                <option key={model.id} value={model.id}>
                  {model.id}
                </option>
              ))
            )}
          </select>
          {models.length === 0 && form.api_key && !loadingModels && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              No models found. Please check your API key.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Max Output Tokens
            </label>
            <input
              type="number"
              value={form.max_output_tokens}
              onChange={(e) => setForm({ ...form, max_output_tokens: parseInt(e.target.value) })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              required
              min="1"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Maximum number of tokens in the AI's response
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Max Total Tokens
            </label>
            <input
              type="number"
              value={form.max_total_tokens || ''}
              onChange={(e) => setForm({ ...form, max_total_tokens: e.target.value ? parseInt(e.target.value) : null })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              min="1"
              placeholder="Leave empty for unlimited"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Maximum total tokens per conversation (optional)
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Disclaimer Message
          </label>
          <textarea
            value={form.disclaimer_message}
            onChange={(e) => setForm({ ...form, disclaimer_message: e.target.value })}
            rows={2}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            placeholder="AI can make mistakes. Consider checking important information."
          />
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            This message will be shown to users in the chat interface
          </p>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            id="enabled"
          />
          <label htmlFor="enabled" className="ml-2 block text-sm text-gray-900 dark:text-white">
            Enable AI features for this organization
          </label>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 dark:bg-red-900/30 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error</h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">{error}</div>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 dark:bg-green-900/30 p-4">
            <div className="flex">
              <Check className="h-5 w-5 text-green-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800 dark:text-green-200">Success</h3>
                <div className="mt-2 text-sm text-green-700 dark:text-green-300">{success}</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || loadingModels}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}