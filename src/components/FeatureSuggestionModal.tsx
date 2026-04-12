import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Lightbulb, CheckCircle, Loader2, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface FeatureRequest {
  title: string
  category: string
  summary: string
  userStory: string
  acceptanceCriteria: string[]
  priority: string
  notes: string
}

export function FeatureSuggestionModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [featureRequest, setFeatureRequest] = useState<FeatureRequest | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, featureRequest])

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const handleTextareaChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 80) + 'px'
  }, [])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMsg = { id: crypto.randomUUID(), role: 'user', content: text }
    const updated = [...messages, userMsg]
    setMessages(updated)
    setInput('')
    setFeatureRequest(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setLoading(true)

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('refine-feature', {
        body: { messages: updated.map(m => ({ role: m.role, content: m.content })) },
      })

      if (invokeError) throw invokeError

      if (data?.content) {
        setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.content,
        }])
      }

      if (data?.featureRequest) {
        setFeatureRequest(data.featureRequest)
      }
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Error: ${e.message ?? 'Something went wrong. Try again.'}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!featureRequest) return
    setSubmitting(true)
    setError('')

    try {
      const { error: invokeError } = await supabase.functions.invoke('submit-feature', {
        body: {
          title: featureRequest.title,
          description: JSON.stringify(featureRequest, null, 2),
          category: featureRequest.category,
          userEmail: user?.email ?? null,
        },
      })

      if (invokeError) throw invokeError
      setSubmitted(true)
      setTimeout(onClose, 2000)
    } catch (e: any) {
      setError(e.message ?? 'Failed to submit. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const priorityColor = (p: string) => {
    if (p === 'must-have') return 'bg-red-100 text-red-700'
    if (p === 'should-have') return 'bg-yellow-100 text-yellow-700'
    return 'bg-gray-100 text-gray-600'
  }

  const categoryLabel = (c: string) => {
    const map: Record<string, string> = {
      general: 'General', underwriting: 'Underwriting / P&L', pipeline: 'Deal Pipeline',
      tax: 'Tax / 1031', reporting: 'PDF / Reports', mobile: 'Mobile / iOS', other: 'Other',
    }
    return map[c] ?? c
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col"
        style={{ maxHeight: 'min(85vh, 640px)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Lightbulb size={18} className="text-[#c9a84c]" />
            <h2 className="text-sm font-semibold text-gray-900">Suggest a Feature</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {submitted ? (
          <div className="px-5 py-12 text-center">
            <CheckCircle size={40} className="mx-auto mb-3 text-green-500" />
            <p className="text-sm font-medium text-gray-900">Feature request submitted!</p>
            <p className="text-xs text-gray-500 mt-1">It's been queued for review.</p>
          </div>
        ) : (
          <>
            {/* Chat area */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 text-xs mt-6">
                  <Lightbulb size={28} className="mx-auto mb-2 opacity-40" />
                  <p className="font-medium mb-1">Describe your feature idea</p>
                  <p className="text-[11px]">I'll ask a few questions to refine it into a clear request</p>
                </div>
              )}

              {messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-[#1a1a2e] text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
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

              {/* Feature request card */}
              {featureRequest && !loading && (
                <div className="border border-[#c9a84c]/30 rounded-lg bg-[#c9a84c]/5 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">{featureRequest.title}</h3>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1a1a2e]/10 text-[#1a1a2e] font-medium">
                        {categoryLabel(featureRequest.category)}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priorityColor(featureRequest.priority)}`}>
                        {featureRequest.priority}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-600">{featureRequest.summary}</p>

                  <div className="text-xs text-gray-500 italic">{featureRequest.userStory}</div>

                  {featureRequest.acceptanceCriteria?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Acceptance Criteria</p>
                      <ul className="space-y-0.5">
                        {featureRequest.acceptanceCriteria.map((c, i) => (
                          <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                            <span className="text-[#c9a84c] mt-0.5">✓</span> {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {featureRequest.notes && (
                    <p className="text-[11px] text-gray-400 border-t border-gray-200 pt-2">{featureRequest.notes}</p>
                  )}

                  {error && <p className="text-xs text-red-500">{error}</p>}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleSubmit}
                      disabled={submitting}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#1a1a2e] text-white rounded-md hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors disabled:opacity-40"
                    >
                      <Send size={12} />
                      {submitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                    <button
                      onClick={() => {
                        setFeatureRequest(null)
                        textareaRef.current?.focus()
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      <RefreshCw size={12} /> Revise
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-gray-200 px-4 py-2 flex-shrink-0 bg-white rounded-b-lg">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder={messages.length === 0 ? "Describe your feature idea..." : "Reply..."}
                  rows={1}
                  className="flex-1 resize-none border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a84c] focus:border-[#c9a84c]"
                  style={{ maxHeight: 80 }}
                  disabled={loading || submitting}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || loading || submitting}
                  className="p-2 rounded-md bg-[#1a1a2e] text-white hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
