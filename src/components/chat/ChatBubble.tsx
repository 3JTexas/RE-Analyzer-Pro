import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageCircle, X, Send, Loader2, Lightbulb } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useDealContext } from '../../hooks/useDealContext'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export function ChatBubble() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { dealContext } = useDealContext()

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus textarea when panel opens
  useEffect(() => {
    if (open) textareaRef.current?.focus()
  }, [open])

  // Auto-resize textarea
  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 96) + 'px' // max ~3 lines
  }, [])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

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

    try {
      const { data, error } = await supabase.functions.invoke('chat-re', {
        body: {
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          dealContext,
        },
      })

      if (error) throw error

      if (data?.content) {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.content,
          timestamp: Date.now(),
        }])
      }
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${e.message ?? 'Something went wrong. Try again.'}`,
        timestamp: Date.now(),
      }])
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

  const contextLabel = dealContext?.property?.name ?? 'General'

  return (
    <>
      {/* Slide-out panel */}
      <div
        className={`fixed top-14 md:top-16 bottom-0 right-0 w-full md:w-96 bg-white border-l border-gray-200 shadow-xl flex flex-col transition-transform duration-300 ease-in-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ zIndex: 40 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-[#1a1a2e] text-white flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Deal Assistant</h2>
            <p className="text-[10px] text-gray-300 truncate">{contextLabel}</p>
          </div>
          <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/10 rounded transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 text-xs mt-8">
              <MessageCircle size={32} className="mx-auto mb-3 opacity-40" />
              <p className="font-medium mb-1">RE Investment Assistant</p>
              <p className="text-[11px]">
                {dealContext
                  ? `Deal loaded: ${contextLabel} — ask about this deal or any RE topic`
                  : 'Ask any real estate, tax, or financing question'}
              </p>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
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

        {/* Input */}
        <div className="border-t border-gray-200 px-3 py-2 flex-shrink-0 bg-white">
          <a
            href="mailto:andrew@chaiholdings.com?subject=RE%20Analyzer%20Pro%20%E2%80%94%20Feature%20Suggestion&body=Feature%20idea%3A%0A%0A"
            className="flex items-center gap-1.5 text-[10px] text-[#c9a84c] hover:text-[#b8963f] transition-colors mb-2 px-1"
          >
            <Lightbulb size={12} /> Suggest a feature
          </a>
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this deal or any RE topic..."
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
      </div>

      {/* Floating bubble */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full bg-[#1a1a2e] text-white shadow-lg hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors flex items-center justify-center"
          style={{ zIndex: 40 }}
          title="Deal Assistant"
        >
          <MessageCircle size={24} />
          {dealContext && (
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-[#c9a84c] rounded-full border-2 border-white" />
          )}
        </button>
      )}
    </>
  )
}
