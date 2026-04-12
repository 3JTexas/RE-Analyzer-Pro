import { useState } from 'react'
import { X, Send, Lightbulb, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'underwriting', label: 'Underwriting / P&L' },
  { value: 'pipeline', label: 'Deal Pipeline' },
  { value: 'tax', label: 'Tax / 1031' },
  { value: 'reporting', label: 'PDF / Reports' },
  { value: 'mobile', label: 'Mobile / iOS' },
  { value: 'other', label: 'Other' },
]

export function FeatureSuggestionModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('general')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!title.trim()) return
    setSubmitting(true)
    setError('')

    try {
      const { error: invokeError } = await supabase.functions.invoke('submit-feature', {
        body: {
          title: title.trim(),
          description: description.trim(),
          category,
          userEmail: user?.email ?? null,
        },
      })

      if (invokeError) throw invokeError
      setSubmitted(true)
      setTimeout(onClose, 1500)
    } catch (e: any) {
      setError(e.message ?? 'Failed to submit. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-lg shadow-xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Lightbulb size={18} className="text-[#c9a84c]" />
            <h2 className="text-sm font-semibold text-gray-900">Suggest a Feature</h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {submitted ? (
          <div className="px-5 py-10 text-center">
            <CheckCircle size={40} className="mx-auto mb-3 text-green-500" />
            <p className="text-sm font-medium text-gray-900">Thanks for the suggestion!</p>
            <p className="text-xs text-gray-500 mt-1">We'll review it shortly.</p>
          </div>
        ) : (
          <>
            {/* Form */}
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Brief description of the feature"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a84c] focus:border-[#c9a84c]"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a84c] focus:border-[#c9a84c] bg-white"
                >
                  {CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Details</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Describe the feature, use case, or problem it solves..."
                  rows={4}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#c9a84c] focus:border-[#c9a84c] resize-none"
                />
              </div>

              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!title.trim() || submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-[#1a1a2e] text-white rounded-md hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={12} />
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
