import React, {useState, useEffect, useRef, useCallback} from "react";
import {supabase} from "../../lib/supabase";
import {Bot, AlertCircle, Loader2, Send, User, Copy, Check} from "lucide-react";
import {useProfile} from "../../hooks/useProfile";
import {useOrganization} from "../../hooks/useOrganization";
import ReactMarkdown from "react-markdown";
import {Prism as SyntaxHighlighter} from "react-syntax-highlighter";
import {oneDark} from "react-syntax-highlighter/dist/esm/styles/prism";
const stripe_price_id = import.meta.env.VITE_STRIPE_PRICE_ID;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from "@supabase/supabase-js";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  tokens?: number;
}

interface Subscription {
  id: string;
  user_id: string;
  status: "active" | "canceled" | "incomplete" | "past_due";
  stripe_subscription_id: string;
  created_at: string;
}

// Simple token estimation (can be replaced with a more accurate model)
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

export function AIChat() {
  const {profile} = useProfile();
  const {currentOrganizationId} = useOrganization();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appSettings, setAppSettings] = useState<any>(null);
  const [streamingMessage, setStreamingMessage] = useState<string>("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedBlock, setCopiedBlock] = useState<string | null>(null);
  const [hasSubscription, setHasSubscription] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const callEdgeFunction = async () => {
    try {
      const response = await fetch(
        "https://velkrznyagoyolyvhcmu.supabase.co/functions/v1/checkout-session",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            priceId: stripe_price_id,
            email: profile?.email,
            user_id: profile?.id,
          }),
        }
      );

      // Check if the response is OK (status code 200-299)
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();

      if (data.url) {
        // Redirect the user to the Stripe Checkout URL
        window.location.href = data.url;

      } else {
        console.error("No URL found in the response:", data);
      }
    } catch (error) {
      alert('Something went wrong')
      setError("Error occured while subscribing")
    }
  };
  useEffect(() => {
    if (currentOrganizationId && profile?.id) {
      loadMessages();
      loadSettings();
    }
  }, [currentOrganizationId, profile?.id]);

  useEffect(() => {
    if (appSettings?.enabled && !profile?.is_global_admin) {
      checkSubscription();
    }
  }, [appSettings]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      const {scrollHeight, clientHeight} = chatContainerRef.current;
      const maxScroll = scrollHeight - clientHeight;
      chatContainerRef.current.scrollTop = maxScroll;
    }
  };

  const loadMessages = async () => {
    if (!currentOrganizationId) return;

    try {
      setLoading(true);
      setError(null);

      // Determine the organization ID based on the user's role
      const organizationId = profile?.is_global_admin
        ? currentOrganizationId // Use currentOrganizationId for global admins
        : localStorage.getItem("organization_id"); // Use localStorage for non-admins

      console.log("organization id from ai chats:", organizationId);

      if (!organizationId) {
        throw new Error("Organization ID not found");
      }

      // Fetch messages for the determined organization ID
      const {data, error} = await supabase
        .from("chat_messages")
        .select("*")
        .eq("organization_id", organizationId) // Use the determined organization ID
        .order("created_at", {ascending: true});

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error("Error loading messages:", error);
      setError("Failed to load chat history");
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    if (!currentOrganizationId) return;

    try {
      const {data: apps, error: appsError} = await supabase
        .from("organization_apps")
        .select("*")
        .eq("organization_id", currentOrganizationId)
        .eq("app_type", "ai_chat")
        .single();

      if (appsError) throw appsError;
      setAppSettings(apps);
    } catch (err) {
      console.error("Error loading AI settings:", err);
      setError("Failed to load AI settings");
    }
  };

  const checkSubscription = async () => {
    if (!profile?.id) return;

    try {
      const {data: subscription, error} = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", profile.id)
        .eq("status", "active")
        .single();

      if (error) throw error;
      setHasSubscription(!!subscription);
    } catch (error) {
      console.error("Error checking subscription:", error);
      setError("Failed to check subscription status");
    }
  };

  // const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

  // const redirectToCheckout = async (sessionId: string) => {
  //   const stripe = await stripePromise;
  //   if (stripe) {
  //     stripe.redirectToCheckout({ sessionId });
  //   }
  // };

  const handleSubscribe = async () => {
    // Call Supabase Edge Function to create a Stripe Checkout session
    const {data: productData, error: productError} = await supabase
      .from("products")
      .select("stripe_price_id")
      .eq("name", "AI-Chat")
      .single();

    if (productError || !productData) {
      console.error(
        "Error fetching product from Supabase:",
        productError?.message
      );
      return;
    }

    const price_id = productData.stripe_price_id;
    console.log(price_id, "stripe price id");

    const userID = profile?.id;

    try {
      // Invoke the Edge Function
      const {data, error} = await supabase.functions.invoke("stripe-checkout", {
        body: {user_id: userID, price_id: price_id},
      });

      if (error) {
        throw error;
      }

      // Redirect the user to the Stripe checkout page
      window.location.href = data.url;
      // Redirect the user to Stripe Checkout
      // redirectToCheckout(data.sessionId);
    } catch (error) {
      // console.log(error, 'error')
      if (error instanceof FunctionsHttpError) {
        const errorMessage = await error.context.json();
        console.log("Function returned an error", errorMessage);
      } else if (error instanceof FunctionsRelayError) {
        console.log("Relay error:", error.message);
      } else if (error instanceof FunctionsFetchError) {
        console.log("Fetch error:", error.message);
      }
      alert("Something went wrong. Please try again.");
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBlock(id);
      setTimeout(() => setCopiedBlock(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      setError("Failed to copy to clipboard");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !input.trim() ||
      !currentOrganizationId ||
      !appSettings?.enabled ||
      !hasSubscription && !profile?.is_global_admin
    )
      return;

    const userMessage = input.trim();
    setInput("");
    setError(null);

    try {
      // Save user message
      const {data: savedMessage, error: saveError} = await supabase
        .from("chat_messages")
        .insert([
          {
            organization_id: currentOrganizationId,
            role: "user",
            content: userMessage,
            user_id: profile?.id,
          },
        ])
        .select()
        .single();

      if (saveError) throw saveError;
      setMessages((prev) => [...prev, savedMessage]);

      // Start streaming
      setIsStreaming(true);
      setStreamingMessage("");

      const response = await fetch(appSettings.settings.endpoint_url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${appSettings.settings.api_key}`,
        },
        body: JSON.stringify({
          model: appSettings.settings.model,
          messages: messages
            .map((m) => ({
              role: m.role,
              content: m.content,
            }))
            .concat([
              {
                role: "user",
                content: userMessage,
              },
            ]),
          max_tokens: appSettings.settings.max_output_tokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("Response body is not readable");

      let accumulatedMessage = "";

      while (true) {
        const {done, value} = await reader.read();
        if (done) break;

        // Convert the chunk to text and handle SSE format
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(5);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || "";
              accumulatedMessage += content;
              setStreamingMessage(accumulatedMessage);
            } catch (e) {
              console.error("Error parsing SSE message:", e);
            }
          }
        }
      }

      // Save the assistant's message
      const {error: assistantError} = await supabase
        .from("chat_messages")
        .insert([
          {
            organization_id: currentOrganizationId,
            role: "assistant",
            content: accumulatedMessage,
            user_id: profile?.id,
          },
        ]);

      if (assistantError) throw assistantError;

      // Reload messages to get the new message with its ID
      await loadMessages();
    } catch (err) {
      console.error("Error in chat:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred during the conversation"
      );
    } finally {
      setIsStreaming(false);
      setStreamingMessage("");
    }
  };

  const renderMessage = (
    content: string,
    isAssistant: boolean,
    messageId: string
  ) => (
    <div className="relative">
      <ReactMarkdown
        components={{
          code({node, inline, className, children, ...props}) {
            const match = /language-(\w+)/.exec(className || "");
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
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              </div>
            ) : (
              <code {...props} className={className}>
                {children}
              </code>
            );
          },
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
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Loading chat...
          </p>
        </div>
      </div>
    );
  }

  // If app settings are not enabled, show the disabled message
  if (!appSettings?.enabled) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <AlertCircle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            AI Chat Not Available
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            AI features are not enabled for your organization. Please contact
            your administrator to enable AI chat.
          </p>
        </div>
      </div>
    );
  }

  // If app settings are enabled but the user doesn't have a subscription, show the subscription prompt
  if (!hasSubscription && !profile?.is_global_admin) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          <AlertCircle className="mx-auto h-12 w-12 text-yellow-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Subscription Required
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            You need an active subscription to access AI chat features.
          </p>
          <button
            onClick={callEdgeFunction}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-full shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Subscribe Now
          </button>
        </div>
      </div>
    );
  }

  // If app settings are enabled and the user has a subscription, show the chat interface
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
            <p className="text-lg mb-2">
              Start a conversation with the AI assistant
            </p>
            <p className="text-sm max-w-md">
              {appSettings?.settings.disclaimer_message}
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start space-x-3 ${
                  message.role === "assistant" ? "justify-start" : "justify-end"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
                      <Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                  </div>
                )}
                <div
                  className={`flex-1 max-w-2xl ${
                    message.role === "assistant"
                      ? "text-gray-900 dark:text-white"
                      : "text-white ml-auto"
                  }`}
                >
                  <div
                    className={`relative rounded-2xl px-4 py-2 mb-8 ${
                      message.role === "assistant"
                        ? "bg-white dark:bg-gray-800"
                        : "bg-indigo-600"
                    }`}
                  >
                    <div className="text-sm">
                      {renderMessage(
                        message.content,
                        message.role === "assistant",
                        message.id
                      )}
                    </div>
                    <div className="flex items-center justify-end mt-1 text-xs text-gray-500 dark:text-gray-400">
                      <span>
                        {new Date(message.created_at).toLocaleTimeString()}
                      </span>
                      <span className="mx-2">•</span>
                      <span>
                        {message.tokens || estimateTokens(message.content)}{" "}
                        tokens
                      </span>
                    </div>
                  </div>
                </div>
                {message.role === "user" && (
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
                      {renderMessage(streamingMessage, true, "streaming")}
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
