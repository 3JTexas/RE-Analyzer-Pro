import { useState, useRef, useEffect, useCallback } from 'react'
import { Code2, X, Send, Loader2, Trash2, Github, Plus, History, ChevronLeft } from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface SessionRow {
  id: string
  title: string
  updated_at: string
}

const REPO_ISSUE_URL = 'https://github.com/3JTexas/RE-Analyzer-Pro/issues/new'

function buildIssueUrl(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find(m => m.role === 'user')
  const title = (lastUser?.content ?? 'Implement change from Dev Chat')
    .slice(0, 80)
    .replace(/\n/g, ' ')
    .trim()

  const transcript = messages
    .map(m => `**${m.role === 'user' ? 'Andrew' : 'Claude'}:**\n${m.content}`)
    .join('\n\n---\n\n')

  const body = `@claude please implement the change discussed below.\n\n## Context — Dev Chat transcript\n\n${transcript}`

  const params = new URLSearchParams({
    title,
    body,
    labels: 'claude',
  })
  return `${REPO_ISSUE_URL}?${params.toString()}`
}

function deriveTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find(m => m.role === 'user')
  if (!firstUser) return 'New chat'
  return firstUser.content.slice(0, 60).replace(/\n/g, ' ').trim() || 'New chat'
}

export function DevChatPanel() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [showSessionList, setShowSessionList] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (open && !showSessionList) textareaRef.current?.focus()
  }, [open, showSessionList])

  // On first open, load latest session (or start a fresh one)
  useEffect(() => {
    if (!open || sessionId !== null) return
    loadLatestOrStart()
  }, [open])

  const loadLatestOrStart = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('dev_chat_sessions')
      .select('id, title, messages, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      setSessionId(data.id)
      setMessages(((data as any).messages ?? []) as ChatMessage[])
    } else {
      await startNewSession()
    }
  }

  const startNewSession = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('dev_chat_sessions')
      .insert({ user_id: user.id, title: 'New chat', messages: [] })
      .select('id')
      .single()
    if (data) {
      setSessionId(data.id)
      setMessages([])
      setShowSessionList(false)
    }
  }

  const refreshSessionList = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('dev_chat_sessions')
      .select('id, title, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50)
    setSessions((data as SessionRow[]) ?? [])
  }

  const openSessionList = async () => {
    await refreshSessionList()
    setShowSessionList(true)
  }

  const resumeSession = async (id: string) => {
    const { data } = await supabase
      .from('dev_chat_sessions')
      .select('id, messages')
      .eq('id', id)
      .single()
    if (data) {
      setSessionId(data.id)
      setMessages(((data as any).messages ?? []) as ChatMessage[])
      setShowSessionList(false)
    }
  }

  const deleteSession = async (id: string) => {
    if (!window.confirm('Delete this chat session?')) return
    await supabase.from('dev_chat_sessions').delete().eq('id', id)
    setSessions(prev => prev.filter(s => s.id !== id))
    if (id === sessionId) {
      // If we deleted the active session, drop into "New chat" state
      setSessionId(null)
      setMessages([])
      await startNewSession()
    }
  }

  const persistMessages = async (newMessages: ChatMessage[]) => {
    if (!sessionId) return
    const title = deriveTitle(newMessages)
    await supabase
      .from('dev_chat_sessions')
      .update({ messages: newMessages, title, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
  }

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 96) + 'px'
  }, [])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    // Lazy-create a session if we somehow don't have one yet
    let activeSessionId = sessionId
    if (!activeSessionId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('dev_chat_sessions')
        .insert({ user_id: user.id, title: 'New chat', messages: [] })
        .select('id')
        .single()
      if (!data) return
      activeSessionId = data.id
      setSessionId(activeSessionId)
    }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)

    // Save the user turn immediately so it survives a refresh even if Claude errors out
    await persistMessages(updatedMessages)

    try {
      const { data, error } = await supabase.functions.invoke('chat-dev', {
        body: {
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
        },
      })

      if (error) throw error

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data?.content ?? '(empty response)',
        timestamp: Date.now(),
      }

      const withReply = [...updatedMessages, assistantMsg]
      setMessages(withReply)
      await persistMessages(withReply)
    } catch (e: any) {
      const errMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${e.message ?? 'Something went wrong. Try again.'}`,
        timestamp: Date.now(),
      }
      const withErr = [...updatedMessages, errMsg]
      setMessages(withErr)
      await persistMessages(withErr)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const sendToClaudeCode = () => {
    if (messages.length === 0) return
    const url = buildIssueUrl(messages)
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const clearCurrentSession = async () => {
    if (!sessionId) return
    if (!window.confirm('Clear this chat? This deletes the session.')) return
    await supabase.from('dev_chat_sessions').delete().eq('id', sessionId)
    setSessionId(null)
    setMessages([])
    await startNewSession()
  }

  return (
    <>
      {/* Slide-out panel from the LEFT */}
      <div
        className={`fixed top-14 md:top-16 bottom-0 left-0 w-full md:w-[420px] bg-white border-r border-gray-200 shadow-xl flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ zIndex: 40 }}
      >
        {/* Header — gold to distinguish from Deal Assistant (navy) */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-[#c9a84c] text-[#1a1a2e] flex-shrink-0">
          <div className="min-w-0 flex items-center gap-2">
            <Code2 size={16} />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold leading-tight">Dev Chat</h2>
              <p className="text-[10px] opacity-80 leading-tight truncate">
                {showSessionList ? 'All sessions' : 'Owner / admin only'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!showSessionList && (
              <>
                <button onClick={startNewSession} className="p-1.5 hover:bg-black/10 rounded transition-colors" title="New chat">
                  <Plus size={14} />
                </button>
                <button onClick={openSessionList} className="p-1.5 hover:bg-black/10 rounded transition-colors" title="Past chats">
                  <History size={14} />
                </button>
                {messages.length > 0 && (
                  <button onClick={clearCurrentSession} className="p-1.5 hover:bg-black/10 rounded transition-colors" title="Delete this chat">
                    <Trash2 size={14} />
                  </button>
                )}
              </>
            )}
            <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-black/10 rounded transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {showSessionList ? (
          /* Session list view */
          <div className="flex-1 overflow-y-auto min-h-0">
            <button
              onClick={() => setShowSessionList(false)}
              className="flex items-center gap-1 px-4 py-2.5 text-xs text-gray-500 hover:bg-gray-50 w-full border-b border-gray-100"
            >
              <ChevronLeft size={14} /> Back to current chat
            </button>
            {sessions.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-8">No saved chats yet.</p>
            ) : (
              <ul>
                {sessions.map(s => {
                  const date = new Date(s.updated_at)
                  return (
                    <li key={s.id} className={`border-b border-gray-100 ${s.id === sessionId ? 'bg-[#c9a84c]/10' : ''}`}>
                      <div className="flex items-start group">
                        <button
                          onClick={() => resumeSession(s.id)}
                          className="flex-1 text-left px-4 py-3 hover:bg-gray-50 min-w-0"
                        >
                          <div className="text-xs font-medium text-gray-800 truncate">{s.title}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {date.toLocaleDateString()} · {date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                          </div>
                        </button>
                        <button
                          onClick={() => deleteSession(s.id)}
                          className="p-3 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 text-xs mt-8">
                  <Code2 size={32} className="mx-auto mb-3 opacity-40" />
                  <p className="font-medium mb-1">Dev Chat</p>
                  <p className="text-[11px] leading-snug max-w-[280px] mx-auto">
                    Talk through code changes, features, and refactors. Claude can read the repo
                    via tools. When you're ready to ship one, hit <span className="font-semibold">Send to Claude Code</span> — it
                    opens a GitHub issue tagged <code className="bg-gray-100 px-1 rounded">@claude</code> for the
                    Claude Code Action to pick up. Sessions auto-save.
                  </p>
                </div>
              )}
              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[88%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-[#1a1a2e] text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-lg px-3 py-2">
                    <Loader2 size={16} className="animate-spin text-gray-400" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Footer / input */}
            <div className="border-t border-gray-200 px-3 py-2 flex-shrink-0 bg-white">
              {messages.length > 0 && (
                <button
                  onClick={sendToClaudeCode}
                  className="flex items-center justify-center gap-1.5 w-full text-[11px] font-medium text-[#1a1a2e] bg-[#c9a84c]/15 hover:bg-[#c9a84c]/25 transition-colors mb-2 py-1.5 rounded"
                  title="Open a GitHub issue with @claude mention so the Claude Code Action implements this change"
                >
                  <Github size={12} /> Send to Claude Code →
                </button>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe a change, ask about the code…"
                  rows={1}
                  className="flex-1 resize-none border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a84c] focus:border-[#c9a84c]"
                  style={{ maxHeight: 96 }}
                  disabled={loading}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading}
                  className="p-2 rounded-md bg-[#1a1a2e] text-white hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Floating bubble — bottom-LEFT to avoid colliding with Deal Assistant on right */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 left-4 md:bottom-6 md:left-6 w-12 h-12 rounded-full bg-[#c9a84c] text-[#1a1a2e] shadow-lg hover:bg-[#1a1a2e] hover:text-[#c9a84c] transition-colors flex items-center justify-center"
          style={{ zIndex: 40 }}
          title="Dev Chat (admin only)"
        >
          <Code2 size={20} />
        </button>
      )}
    </>
  )
}
