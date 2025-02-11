import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Bot, AlertCircle, Check, X, Loader2, Send, User, Copy, MessageSquare } from 'lucide-react';
import { useProfile } from '../hooks/useProfile';
import { useOrganization } from '../hooks/useOrganization';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  tokens?: number;
}

interface AISettings {
  endpoint_url: string;
  api_key: string;
  model: string;
  max_output_tokens: number;
  max_total_tokens: number | null;
  disclaimer_message: string;
}

interface AppSettings {
  id: string;
  organization_id: string;
  app_type: 'ai_chat';
  enabled: boolean;
  settings: AISettings;
}

// Simple token estimation (can be replaced with a more accurate model)
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export function AIChat() {
  const { profile } = useProfile();
  const { currentOrganizationId } = useOrganization();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentOrganizationId) {
      loadMessages();
      loadSettings();
    }
  }, [currentOrganizationId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      const { scrollHeight, clientHeight } = chatContainerRef.current;
      const maxScroll = scrollHeight - clientHeight;
      chatContainerRef.current.scrollTop = maxScroll;
    }
  };

  const loadMessages = async () => {
    if (!currentOrganizationId) return;
    
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('organization_id', currentOrganizationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      setError('Failed to load chat history');
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    if (!currentOrganizationId) return;
    
    try {
      // First check if organization exists
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', currentOrganizationId)
        .single();

      if (orgError) throw orgError;

      // Get AI chat app settings
      const { data: settings, error: settingsError } = await supabase
        .from('organization_apps')
        .select('*')
        .eq('organization_id', currentOrganizationId)
        .eq('app_type', 'ai_chat')
        .single();

      if (settingsError) throw settingsError;
      setAppSettings(settings);
    } catch (error) {
      console.error('Error loading AI settings:', error);
      setError('Failed to load AI settings');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !currentOrganizationId || !appSettings?.enabled) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);

    try {
      // Save user message
      const { data: savedMessage, error: saveError } = await supabase
        .from('chat_messages')
        .insert([{
          organization_id: currentOrganizationId,
          role: 'user',
          content: userMessage,
          user_id: profile?.id
        }])
        .select()
        .single();

      if (saveError) throw saveError;
      setMessages(prev => [...prev, savedMessage]);

      // Start streaming
      setIsStreaming(true);
      setStreamingMessage('');

      const response = await fetch(appSettings.settings.endpoint_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${appSettings.settings.api_key}`
        },
        body: JSON.stringify({
          model: appSettings.settings.model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content
          })).concat([{
            role: 'user',
            content: userMessage
          }]),
          max_tokens: appSettings.settings.max_output_tokens,
          stream: true
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response body is not readable');

      let accumulatedMessage = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // Convert the chunk to text and handle SSE format
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(5);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || '';
              accumulatedMessage += content;
              setStreamingMessage(accumulatedMessage);
            } catch (e) {
              console.error('Error parsing SSE message:', e);
            }
          }
        }
      }

      // Save the assistant's message
      const { error: assistantError } = await supabase
        .from('chat_messages')
        .insert([{
          organization_id: currentOrganizationId,
          role: 'assistant',
          content: accumulatedMessage,
          user_id: profile?.id
        }]);

      if (assistantError) throw assistantError;

      // Reload messages to get the new message with its ID
      await loadMessages();
    } catch (error) {
      console.error('Error in chat:', error);
      setError(error instanceof Error ? error.message : 'An error occurred during the conversation');
    } finally {
      setIsStreaming(false);
      setStreamingMessage('');
    }
  };

  const copyToClipboard = async (text: string, id: string, type: 'block' | 'message') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'block') {
        setCopiedBlock(id);
        setTimeout(() => setCopiedBlock(null), 2000);
      } else {
        setCopiedMessage(id);
        setTimeout(() => setCopiedMessage(null), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const renderMessage = (content: string) => (
    <ReactMarkdown
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const codeId = Math.random().toString(36).substring(7);
          return !inline && match ? (
            <div className="relative group">
              <button
                onClick={() => copyToClipboard(String(children), codeId, 'block')}
                className="absolute right-2 top-2 p-1 rounded bg-gray-800 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy code"
              >
                {copiedBlock === codeId ? (
                  <Check className="h-4 w-4 text-green-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
              <SyntaxHighlighter
                {...props}
                style={oneDark}
                language={match[1]}
                PreTag="div"
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          ) : (
            <code {...props} className={className}>
              {children}
            </code>
          );
        }
      }}
      className="prose dark:prose-invert max-w-none"
    >
      {content}
    </ReactMarkdown>
  );

  if (!appSettings?.enabled) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <AlertCircle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            AI Chat Not Available
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            AI features are not enabled for your organization. Please contact your administrator to enable AI chat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}
  
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        {messages.length === 0 && !isStreaming ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
            <Bot className="h-12 w-12 mb-4" />
            <p className="text-lg mb-2">Start a conversation with the AI assistant</p>
            <p className="text-sm max-w-md">{appSettings.settings.disclaimer_message}</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start space-x-3 ${
                  message.role === 'assistant' ? 'justify-start' : 'justify-end'
                }`}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                  </div>
                )}
                <div
                  className={`flex-1 max-w-2xl ${
                    message.role === 'assistant'
                      ? 'text-gray-900 dark:text-white'
                      : 'text-white ml-auto'
                  }`}
                >
                  <div className="relative group">
                    <button
                      onClick={() => copyToClipboard(message.content, message.id, 'message')}
                      className={`absolute right-2 top-2 p-1 rounded ${
                        message.role === 'assistant'
                          ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                          : 'bg-indigo-500 text-white'
                      } opacity-0 group-hover:opacity-100 transition-opacity`}
                      title="Copy message"
                    >
                      {copiedMessage === message.id ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <MessageSquare className="h-4 w-4" />
                      )}
                    </button>
                    <div className={`rounded-2xl px-4 py-2 ${
                      message.role === 'assistant'
                        ? 'bg-white dark:bg-gray-800'
                        : 'bg-indigo-600'
                    }`}>
                      <div className="text-sm">
                        {renderMessage(message.content)}
                      </div>
                    </div>
                    <div className="flex items-center justify-end mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>{new Date(message.created_at).toLocaleTimeString()}</span>
                      <span className="mx-2">•</span>
                      <span>{message.tokens || estimateTokens(message.content)} tokens</span>
                    </div>
                  </div>
                </div>
                {message.role === 'user' && (
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
                      <User className="h-5 w-5 text-white" />
                    </div>
                  </div>
                )}
              </div>
            ))}
            {isStreaming && (
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                    <Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </div>
                <div className="flex-1 max-w-2xl">
                  <div className="rounded-2xl px-4 py-2 bg-white dark:bg-gray-800">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {renderMessage(streamingMessage)}
                    </div>
                  </div>
                  <div className="flex items-center justify-end mt-1 text-xs text-gray-500 dark:text-gray-400">
                    <span>{new Date().toLocaleTimeString()}</span>
                    <span className="mx-2">•</span>
                    <span className="animate-pulse">Streaming...</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>
  
      <div className="p-4 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        {appSettings?.settings.disclaimer_message && messages.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-center">
            {appSettings.settings.disclaimer_message}
          </p>
        )}
        <form onSubmit={handleSubmit} className="flex space-x-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 min-w-0 rounded-full px-4 border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={loading || isStreaming}
          />
          <button
            type="submit"
            disabled={loading || isStreaming || !input.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading || isStreaming ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </form>
      </div>
    </div>
  )};