/**
 * frontend/src/pages/Chat.tsx
 *
 * Dedicated 1-on-1 agent chat with full conversation isolation.
 * Backend endpoints:
 *  - GET    /api/v1/chat/conversations?agent_id=...   list conversations
 *  - POST   /api/v1/chat/conversations                create conversation
 *  - GET    /api/v1/chat/conversations/{id}           load with messages
 *  - PUT    /api/v1/chat/conversations/{id}           rename
 *  - DELETE /api/v1/chat/conversations/{id}           delete
 *  - POST   /api/v1/chat/conversations/{id}/messages  send message → agent reply
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AGENT_PROFILES, AgentId } from '../types/agent';
import { useActiveModel } from '../hooks/useActiveModel';
import { MarkdownRenderer } from '../components/common/MarkdownRenderer';
import {
  Send,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  MessageSquare,
  Bot,
  User,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  Cpu,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface ConversationSummary {
  id: string;
  agent_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface MessageItem {
  id: string;
  conversation_id: string;
  sender: 'user' | 'agent';
  content: string;
  tokens_used: number;
  created_at: string;
}

interface ConversationDetail {
  id: string;
  agent_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: MessageItem[];
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const AGENT_IDS: AgentId[] = ['researcher', 'analyst', 'alternative', 'critic', 'specialist'];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Message Bubble ────────────────────────────────────────────────────────────

interface BubbleProps { message: MessageItem; agentId: AgentId }
const MessageBubble: React.FC<BubbleProps> = ({ message, agentId }) => {
  const isUser = message.sender === 'user';
  const profile = AGENT_PROFILES[agentId];

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold text-xs shadow-md border ${
          isUser
            ? 'bg-deepMidnight/80 border-white/20'
            : `bg-gradient-to-tr ${profile.color} border-white/20`
        }`}
      >
        {isUser ? <User className="w-4 h-4 text-cyan-300" /> : profile.name.charAt(0)}
      </div>

      {/* Content */}
      <div className={`max-w-[75%] space-y-1 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-gradient-to-r from-tealAccent/20 to-electricCyan/20 border border-cyan-400/30 text-offWhite rounded-tr-sm whitespace-pre-wrap shadow-sm'
              : 'glass-secondary text-gray-200 rounded-tl-sm border border-white/10'
          }`}
        >
          {isUser ? message.content : <MarkdownRenderer content={message.content} />}
        </div>
        <span className="text-xs text-gray-600 px-1">
          {relativeTime(message.created_at)}
          {message.tokens_used > 0 && !isUser && (
            <span className="ml-2 text-gray-700">{message.tokens_used} tok</span>
          )}
        </span>
      </div>
    </div>
  );
};

// ─── Conversation List Item ────────────────────────────────────────────────────

interface ConvItemProps {
  conv: ConversationSummary;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (newTitle: string) => void;
}

const ConvItem: React.FC<ConvItemProps> = ({ conv, active, onSelect, onDelete, onRename }) => {
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(conv.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const commitRename = () => {
    if (draftTitle.trim() && draftTitle !== conv.title) onRename(draftTitle.trim());
    setEditing(false);
  };

  return (
    <div
      onClick={!editing ? onSelect : undefined}
      className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
        active
          ? 'bg-cyan-950/50 border border-cyan-400/40 text-cyan-300'
          : 'hover:bg-white/5 border border-transparent text-gray-400 hover:text-white'
      }`}
    >
      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${active ? 'text-cyan-400' : 'text-gray-500'}`} />

      {editing ? (
        <input
          ref={inputRef}
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-black/60 border border-cyan-400/60 rounded-lg px-2 py-0.5 text-xs text-offWhite focus:outline-none"
        />
      ) : (
        <span className="flex-1 text-xs text-gray-300 truncate">{conv.title}</span>
      )}

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {editing ? (
          <>
            <button onClick={(e) => { e.stopPropagation(); commitRename(); }} className="p-0.5 text-emerald-400 hover:text-emerald-300">
              <Check className="w-3 h-3" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setEditing(false); }} className="p-0.5 text-gray-500 hover:text-gray-300">
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <>
            <button onClick={(e) => { e.stopPropagation(); setEditing(true); }} className="p-0.5 text-gray-500 hover:text-blue-300">
              <Edit2 className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-0.5 text-gray-500 hover:text-red-400"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </>
        )}
      </div>

      <span className="text-xs text-gray-600 shrink-0 hidden group-hover:hidden">{conv.message_count}</span>
    </div>
  );
};

// ─── Main Chat Page ────────────────────────────────────────────────────────────

export const Chat: React.FC = () => {
  const { activeModel } = useActiveModel();
  const [selectedAgent, setSelectedAgent] = useState<AgentId>('analyst');
  const [conversations, setConversations] = useState<Record<AgentId, ConversationSummary[]>>(
    {} as Record<AgentId, ConversationSummary[]>
  );
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState<ConversationDetail | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Fetch conversation list for selected agent ──────────────────────────────

  const fetchConversations = useCallback(async (agentId: AgentId) => {
    setLoadingConvs(true);
    try {
      const res = await fetch(`/api/v1/chat/conversations?agent_id=${agentId}`);
      if (!res.ok) throw new Error(`Failed to fetch conversations: ${res.status}`);
      const data: ConversationSummary[] = await res.json();
      setConversations((prev) => ({ ...prev, [agentId]: data }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingConvs(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations(selectedAgent);
  }, [selectedAgent, fetchConversations]);

  // ─── Load conversation detail ────────────────────────────────────────────────

  const loadConversation = useCallback(async (convId: string) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/chat/conversations/${convId}`);
      if (!res.ok) throw new Error(`Failed to load conversation: ${res.status}`);
      const data: ConversationDetail = await res.json();
      setActiveConversation(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (activeConversationId) loadConversation(activeConversationId);
    else setActiveConversation(null);
  }, [activeConversationId, loadConversation]);

  // ─── Auto-scroll to bottom ───────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  // ─── Create conversation ─────────────────────────────────────────────────────

  const handleNewConversation = async () => {
    try {
      const res = await fetch('/api/v1/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: selectedAgent }),
      });
      if (!res.ok) throw new Error('Failed to create conversation');
      const data: ConversationSummary = await res.json();
      await fetchConversations(selectedAgent);
      setActiveConversationId(data.id);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ─── Delete conversation ─────────────────────────────────────────────────────

  const handleDeleteConversation = async (convId: string) => {
    if (!window.confirm('Delete this conversation? This cannot be undone.')) return;
    try {
      await fetch(`/api/v1/chat/conversations/${convId}`, { method: 'DELETE' });
      if (activeConversationId === convId) {
        setActiveConversationId(null);
        setActiveConversation(null);
      }
      await fetchConversations(selectedAgent);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ─── Rename conversation ─────────────────────────────────────────────────────

  const handleRenameConversation = async (convId: string, newTitle: string) => {
    try {
      await fetch(`/api/v1/chat/conversations/${convId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      await fetchConversations(selectedAgent);
      if (activeConversation && activeConversation.id === convId) {
        setActiveConversation((prev) => prev ? { ...prev, title: newTitle } : null);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  // ─── Send message ────────────────────────────────────────────────────────────

  const handleSend = async () => {
    const content = inputText.trim();
    if (!content || sending || !activeConversationId) return;

    // Optimistically add user message to UI
    const tempUserMsg: MessageItem = {
      id: `temp-${Date.now()}`,
      conversation_id: activeConversationId,
      sender: 'user',
      content,
      tokens_used: 0,
      created_at: new Date().toISOString(),
    };
    setActiveConversation((prev) =>
      prev ? { ...prev, messages: [...prev.messages, tempUserMsg] } : null
    );
    setInputText('');
    setSending(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/chat/conversations/${activeConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail ?? `Server returned ${res.status}`);
      }
      const agentMsg: MessageItem = await res.json();

      // Replace temp message + add agent reply
      setActiveConversation((prev) => {
        if (!prev) return null;
        const withoutTemp = prev.messages.filter((m) => m.id !== tempUserMsg.id);
        // Re-add user msg with server timestamp if needed:
        const userConfirmed: MessageItem = { ...tempUserMsg, id: `user-${Date.now()}` };
        return { ...prev, messages: [...withoutTemp, userConfirmed, agentMsg] };
      });

      // Update conversation list (message count + title may change)
      await fetchConversations(selectedAgent);
    } catch (err: any) {
      setError(err.message);
      // Remove the optimistic user message on error
      setActiveConversation((prev) =>
        prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== tempUserMsg.id) } : null
      );
    } finally {
      setSending(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const profile = AGENT_PROFILES[selectedAgent];
  const agentConvs = conversations[selectedAgent] ?? [];

  return (
    <div className="h-[calc(100vh-5rem)] flex gap-4">
      {/* ─── Left Sidebar: Agent Tabs + Conversation List ─────────────────────── */}
      <aside className="w-64 flex-shrink-0 flex flex-col glass-secondary rounded-2xl overflow-hidden">
        {/* Agent Selector Tabs */}
        <div className="p-3 border-b border-white/10 space-y-1">
          <p className="text-xs font-mono text-cyan-400 px-2 mb-2 font-semibold tracking-wider">SELECT AGENT</p>
          {AGENT_IDS.map((aid) => {
            const p = AGENT_PROFILES[aid];
            return (
              <button
                key={aid}
                onClick={() => {
                  setSelectedAgent(aid);
                  setActiveConversationId(null);
                  setActiveConversation(null);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                  selectedAgent === aid
                    ? 'bg-gradient-to-r from-tealAccent/20 to-transparent border-l-2 border-l-cyan-400 text-white'
                    : 'hover:bg-white/5 border border-transparent text-mutedSilver'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full bg-gradient-to-tr ${p.color} flex items-center justify-center text-white font-bold text-xs flex-shrink-0 border border-white/20`}
                >
                  {p.name.charAt(0)}
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-offWhite truncate">{p.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{p.badge}</p>
                </div>
                {selectedAgent === aid && (
                  <ChevronRight className="w-3.5 h-3.5 text-cyan-400 ml-auto" />
                )}
              </button>
            );
          })}
        </div>

        {/* Conversation List */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/10">
            <p className="text-xs font-mono text-gray-400">CONVERSATIONS</p>
            <button
              onClick={handleNewConversation}
              title="New conversation"
              className="p-1 rounded-lg hover:bg-white/10 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingConvs ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <RefreshCw className="w-4 h-4 animate-spin text-cyan-400" />
              </div>
            ) : agentConvs.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-6 h-6 text-gray-600 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No conversations yet.</p>
                <button
                  onClick={handleNewConversation}
                  className="text-xs text-cyan-400 hover:underline mt-1 cursor-pointer"
                >
                  Start one
                </button>
              </div>
            ) : (
              agentConvs.map((conv) => (
                <ConvItem
                  key={conv.id}
                  conv={conv}
                  active={activeConversationId === conv.id}
                  onSelect={() => setActiveConversationId(conv.id)}
                  onDelete={() => handleDeleteConversation(conv.id)}
                  onRename={(t) => handleRenameConversation(conv.id, t)}
                />
              ))
            )}
          </div>
        </div>
      </aside>

      {/* ─── Main Chat Area ────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col glass-primary rounded-2xl overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-obsidian/40 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`w-9 h-9 rounded-full bg-gradient-to-tr ${profile.color} flex items-center justify-center text-white font-bold text-sm shadow-md border border-white/20`}
            >
              {profile.name.charAt(0)}
            </div>
            <div>
              <h3 className="font-semibold text-offWhite text-sm">
                {activeConversation?.title ?? profile.name}
              </h3>
              <p className="text-xs text-mutedSilver">{profile.role}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-deepMidnight/80 text-[11px] font-mono text-gray-300 border border-white/10">
              <Cpu className={`w-3.5 h-3.5 ${activeModel.is_online ? 'text-violetAccent' : 'text-cyan-400'}`} />
              <span>{activeModel.display_text}</span>
            </div>

            {!activeConversationId && (
              <button
                onClick={handleNewConversation}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-300 text-xs font-medium border border-cyan-400/30 transition-all cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                New Chat
              </button>
            )}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-4 mt-3 flex items-center gap-2 bg-red-950/40 border border-red-800/40 text-red-300 rounded-xl px-3 py-2 text-xs">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            {error}
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!activeConversationId ? (
            /* No conversation selected — welcome prompt */
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div
                className={`w-16 h-16 rounded-2xl bg-gradient-to-tr ${profile.color} flex items-center justify-center text-white font-bold text-2xl shadow-lg mb-4`}
              >
                {profile.name.charAt(0)}
              </div>
              <h2 className="text-lg font-bold text-offWhite mb-1">{profile.name}</h2>
              <p className="text-sm text-gray-400 max-w-xs mb-2">{profile.description}</p>
              <p className="text-xs text-gray-600 mb-5">
                Select a conversation from the sidebar or start a new one.
              </p>
              <button
                onClick={handleNewConversation}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-cyan-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Start New Conversation
              </button>
            </div>
          ) : loadingDetail ? (
            <div className="flex items-center justify-center py-16 text-gray-500 font-mono text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mr-2 text-cyan-400" />
              Loading conversation…
            </div>
          ) : activeConversation?.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bot className="w-10 h-10 text-gray-600 mb-3" />
              <p className="text-sm text-gray-400">
                Say hello to <span className="text-offWhite font-semibold">{profile.name}</span>.
              </p>
              <p className="text-xs text-gray-500 mt-1">Your conversation is private and isolated.</p>
            </div>
          ) : (
            activeConversation?.messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} agentId={selectedAgent} />
            ))
          )}

          {/* Typing indicator */}
          {sending && (
            <div className="flex gap-3">
              <div
                className={`w-8 h-8 rounded-full bg-gradient-to-tr ${profile.color} flex items-center justify-center text-white font-bold text-xs flex-shrink-0`}
              >
                {profile.name.charAt(0)}
              </div>
              <div className="bg-black/60 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-white/10 bg-black/40 backdrop-blur-md flex-shrink-0">
          {!activeConversationId ? (
            <p className="text-center text-xs text-gray-600">Select or create a conversation to start chatting.</p>
          ) : (
            <div className="flex items-end gap-3">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${profile.name}… (Enter to send, Shift+Enter for newline)`}
                disabled={sending}
                rows={1}
                className="flex-1 bg-obsidian/70 border border-white/10 rounded-xl px-4 py-3 text-sm text-offWhite placeholder-gray-500 focus:outline-none focus:border-cyan-400/70 transition-colors resize-none disabled:opacity-50"
                style={{ minHeight: '44px', maxHeight: '120px' }}
                onInput={(e) => {
                  const el = e.currentTarget;
                  el.style.height = 'auto';
                  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                }}
              />
              <button
                onClick={handleSend}
                disabled={sending || !inputText.trim()}
                className="w-10 h-10 rounded-xl bg-gradient-to-r from-tealAccent to-electricCyan text-obsidian shadow-[0_0_15px_rgba(69,217,245,0.3)] hover:brightness-110 flex items-center justify-center transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 cursor-pointer active:scale-95"
              >
                {sending ? (
                  <RefreshCw className="w-4 h-4 animate-spin text-obsidian" />
                ) : (
                  <Send className="w-4 h-4 text-obsidian" />
                )}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
