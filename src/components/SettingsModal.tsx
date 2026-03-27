/**
 * Settings Modal — user underwriting defaults
 *
 * REQUIRED: Run this migration in the Supabase SQL Editor before using:
 *
 * CREATE TABLE IF NOT EXISTS user_defaults (
 *   id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
 *   defaults jsonb NOT NULL DEFAULT '{}',
 *   created_at timestamptz DEFAULT now(),
 *   updated_at timestamptz DEFAULT now()
 * );
 * ALTER TABLE user_defaults ENABLE ROW LEVEL SECURITY;
 * CREATE POLICY "Users manage own defaults" ON user_defaults FOR ALL USING (auth.uid() = user_id);
 */

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useUserDefaults } from '../hooks/useUserDefaults'

interface Props {
  onClose: () => void
}

const FIELDS = [
  { section: 'Underwriting Defaults' },
  { key: 'brk',     label: 'Tax Bracket %',     step: 1 },
  { key: 'ir',      label: 'Interest Rate %',   step: 0.125 },
  { key: 'lev',     label: 'LTV %',             step: 1 },
  { key: 'am',      label: 'Amortization (yrs)', step: 5 },
  { key: 'pm',      label: 'Prop Mgmt %',       step: 0.5 },
  { section: 'Depreciation Defaults' },
  { key: 'land',    label: 'Land %',            step: 1 },
  { key: 'costSeg', label: 'Cost Seg %',        step: 1 },
] as const

type FieldRow = { key: string; label: string; step: number }

export function SettingsModal({ onClose }: Props) {
  const { loadDefaults, saveDefaults } = useUserDefaults()
  const [values, setValues] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDefaults().then(d => {
      const v: Record<string, number> = {}
      for (const f of FIELDS) {
        if ('key' in f && f.key) {
          const val = (d as any)[f.key]
          if (typeof val === 'number' && val !== 0) v[f.key] = val
        }
      }
      setValues(v)
      setLoading(false)
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setError('')
    const defaults: Record<string, number> = {}
    for (const [k, v] of Object.entries(values)) {
      if (v !== 0 && v !== undefined) defaults[k] = v
    }
    const { error: err } = await saveDefaults(defaults)
    if (err) setError(err)
    else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-24" onClick={onClose}>
      <div className="bg-white w-full max-w-sm mx-4 rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800">Settings</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div className="px-5 py-5 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <p className="text-xs text-gray-400 text-center py-4">Loading...</p>
          ) : (
            <>
              {FIELDS.map((f, i) => {
                if ('section' in f && f.section) {
                  return (
                    <div key={i} className={i > 0 ? 'mt-5' : ''}>
                      <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide mb-2">{f.section}</p>
                    </div>
                  )
                }
                const field = f as FieldRow
                return (
                  <div key={field.key} className="flex items-center justify-between mb-2.5">
                    <label className="text-xs text-gray-600">{field.label}</label>
                    <input
                      type="number"
                      step={field.step}
                      value={values[field.key] ?? ''}
                      onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value === '' ? 0 : +e.target.value }))}
                      placeholder="—"
                      className="w-24 text-xs text-right border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:border-[#c9a84c] transition"
                    />
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100">
          {error && <p className="text-red-500 text-[11px] mb-2">{error}</p>}
          {saved ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 text-green-700 text-xs text-center">
              Saved
            </div>
          ) : (
            <button onClick={handleSave} disabled={saving || loading}
              className="w-full bg-[#1a1a2e] text-white text-xs font-medium py-2.5 rounded-lg hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save defaults'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
