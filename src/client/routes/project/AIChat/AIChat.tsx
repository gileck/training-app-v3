import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Input } from '@/client/components/template/ui/input';
import { Button } from '@/client/components/template/ui/button';
import { Card } from '@/client/components/template/ui/card';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/client/components/template/ui/select';
import { LinearProgress } from '@/client/components/template/ui/linear-progress';
import { Badge } from '@/client/components/template/ui/badge';
import { Send, MessageSquare } from 'lucide-react';
import { getModelsByTier } from '@/common/ai/models';
import { sendChatMessage } from '@/apis/project/chat/client';
import { useSettingsStore, useIsAdmin } from '@/client/features';

// Message type definition
interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  cost?: number;
  timestamp: Date;
  isFromCache?: boolean;
  cacheProvider?: 'fs' | 's3' | 'localStorage' | 'indexedDB';
}

export function AIChat() {
  // eslint-disable-next-line state-management/prefer-state-architecture -- form input before submission
  const [input, setInput] = useState('');
  // eslint-disable-next-line state-management/prefer-state-architecture -- session chat history (intentionally not persisted)
  const [messages, setMessages] = useState<Message[]>([]);
  // eslint-disable-next-line state-management/prefer-state-architecture -- local loading indicator
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use Zustand store
  const settings = useSettingsStore((state) => state.settings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  const isAdmin = useIsAdmin();
  const groupedModels = useMemo(() => getModelsByTier(), []);

  // Auto scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleModelChange = (value: string) => {
    updateSettings({ aiModel: value });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim() || !settings.aiModel) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date(),
      isFromCache: false
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call the API
      const { data, isFromCache, metadata } = await sendChatMessage({
        modelId: settings.aiModel,
        text: input
      });

      // Check if the response contains an error
      if (data.error) {
        // Add error message
        const errorMessage: Message = {
          id: Date.now().toString(),
          text: data.error,
          sender: 'ai',
          timestamp: new Date(),
          isFromCache
        };

        setMessages(prev => [...prev, errorMessage]);
      } else {
        const { cost, result } = data;

        // Add AI message
        const aiMessage: Message = {
          id: Date.now().toString(),
          text: result,
          sender: 'ai',
          cost: cost.totalCost,
          timestamp: new Date(),
          isFromCache,
          cacheProvider: metadata?.provider
        };

        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error('Error sending message:', error);

      // Add error message
      const errorMessage: Message = {
        id: Date.now().toString(),
        text: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        sender: 'ai',
        timestamp: new Date(),
        isFromCache: false
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Format cost to display in a readable format
  const formatCost = (cost: number): string => {
    return `$${cost.toFixed(2)}`;
  };

  return (
    <div className="mx-auto flex h-[100vh] max-w-3xl flex-col py-4">
      <h1 className="mb-2 flex items-center text-2xl font-semibold"><MessageSquare className="mr-2 h-5 w-5" /> AI Chat</h1>

      <div className="mb-3">
        <Select value={settings.aiModel} onValueChange={handleModelChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select AI Model" />
          </SelectTrigger>
          <SelectContent>
            {groupedModels.map(({ tier, models }) => (
              <SelectGroup key={tier}>
                <SelectLabel>{tier}{!isAdmin && tier !== 'Budget' ? ' (Admin only)' : ''}</SelectLabel>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id} disabled={!isAdmin && tier !== 'Budget'}>
                    {model.name} ({model.provider})
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="mb-2 flex flex-1 flex-col overflow-auto p-2">
        {messages.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Start a conversation with the AI</p>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`mb-2 max-w-[80%] rounded-lg p-2 ${message.sender === 'user' ? 'self-end bg-primary/10' : 'self-start bg-background border'}`}
              >
                <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>

                {message.cost !== undefined && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {message.isFromCache ? (
                      <Badge variant="secondary">From cache ({message.cacheProvider || 'unknown'})</Badge>
                    ) : (
                      `Cost: ${formatCost(message.cost)}`
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </Card>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          placeholder="Type your message..."
          value={input}
          onChange={handleInputChange}
          disabled={isLoading}
        />
        <Button type="submit" disabled={isLoading || !input.trim()}>
          <Send className="mr-2 h-4 w-4" /> Send
        </Button>
        {isLoading && <div className="w-32"><LinearProgress /></div>}
      </form>
    </div>
  );
}
