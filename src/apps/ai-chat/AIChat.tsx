import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Bot, AlertCircle, Loader2, Send, User, Copy, Check } from 'lucide-react';
import { useProfile } from '../../hooks/useProfile';
import { useOrganization } from '../../hooks/useOrganization';
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

// Simple token estimation (can be replaced with a more accurate model)
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export function AIChat() {
  const { profile } = useProfile();
  const { currentOrganizationId } = useOrganization();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<any>(null);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);
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



    // try {
    //   setLoading(true);
    //   setError(null);

    //   const { data, error: loadError } = await supabase
    //     .from('chat_messages')
    //     .select('*')
    //     .eq('organization_id', currentOrganizationId)
    //     .order('created_at', { ascending: true });

    //   if (loadError) throw loadError;
    //   setMessages(data || []);
    // } catch (err) {
    //   console.error('Error loading messages:', err);
    //   setError('Failed to load chat history');
    // } finally {
    //   setLoading(false);
    // }
    try {
      setLoading(true);
      setError(null);

      // Determine the organization ID based on the user's role
      const organizationId = profile?.is_global_admin
        ? currentOrganizationId // Use currentOrganizationId for global admins
        : localStorage.getItem('organization_id'); // Use localStorage for non-admins

      console.log("organization id from ai chats:", organizationId)

      if (!organizationId) {
        throw new Error('Organization ID not found');
      }

      // Fetch messages for the determined organization ID
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('organization_id', organizationId) // Use the determined organization ID
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
      const { data: apps, error: appsError } = await supabase
        .from('organization_apps')
        .select('*')
        .eq('organization_id', currentOrganizationId)
        .eq('app_type', 'ai_chat')
        .single();

      if (appsError) throw appsError;
      setAppSettings(apps);
    } catch (err) {
      console.error('Error loading AI settings:', err);
      setError('Failed to load AI settings');
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBlock(id);
      setTimeout(() => setCopiedBlock(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setError('Failed to copy to clipboard');
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
    } catch (err) {
      console.error('Error in chat:', err);
      setError(err instanceof Error ? err.message : 'An error occurred during the conversation');
    } finally {
      setIsStreaming(false);
      setStreamingMessage('');
    }
  };

  const renderMessage = (content: string, isAssistant: boolean, messageId: string) => (
    <div className="relative">
      <ReactMarkdown
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeId = Math.random().toString(36).substring(7);
            return !inline && match ? (
              <div className="relative group">
                <button
                  onClick={() => copyToClipboard(String(children), codeId)}
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
      {isAssistant && (
        <button
          onClick={() => copyToClipboard(content, messageId)}
          className="absolute bottom-0 left-0 -mb-6 flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          {copiedBlock === messageId ? (
            <>
              <Check className="h-4 w-4" />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>Copy response</span>
            </>
          )}
        </button>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading chat...</p>
        </div>
      </div>
    );
  }

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
        className="flex-1 overflow-y-auto p-4 space-y-8 scroll-smooth"
      >
        {messages.length === 0 && !isStreaming ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
            <Bot className="h-12 w-12 mb-4" />
            <p className="text-lg mb-2">Start a conversation with the AI assistant</p>
            <p className="text-sm max-w-md">{appSettings?.settings.disclaimer_message}</p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start space-x-3 ${message.role === 'assistant' ? 'justify-start' : 'justify-end'
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
                  className={`flex-1 max-w-2xl ${message.role === 'assistant'
                      ? 'text-gray-900 dark:text-white'
                      : 'text-white ml-auto'
                    }`}
                >
                  <div className={`relative rounded-2xl px-4 py-2 mb-8 ${message.role === 'assistant'
                      ? 'bg-white dark:bg-gray-800'
                      : 'bg-indigo-600'
                    }`}>
                    <div className="text-sm">
                      {renderMessage(message.content, message.role === 'assistant', message.id)}
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
                      {renderMessage(streamingMessage, true, 'streaming')}
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
  );
}