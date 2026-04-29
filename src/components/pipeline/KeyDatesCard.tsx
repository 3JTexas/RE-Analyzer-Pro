import { Sparkles, X, Calendar, Lock, Unlock } from 'lucide-react'
import type { KeyDates } from '../../types/pipeline'
import { deriveKeyDatesFromPSA, EMPTY_KEY_DATES } from '../../types/pipeline'

interface Props {
  keyDates?: KeyDates
  onUpdate: (dates: KeyDates) => void
  psaExtractedTerms?: Record<string, any> | null
  unlocked: boolean
  onToggleUnlock: () => void
}

const DATE_FIELDS: { key: keyof KeyDates; label: string }[] = [
  { key: 'effectiveDate', label: 'Effective Date' },
  { key: 'earnestMoneyDueDate', label: 'Earnest Money Due' },
  { key: 'additionalDepositDueDate', label: 'Additional Deposit Due' },
  { key: 'titleCommitmentDate', label: 'Title Commitment' },
  { key: 'surveyDeadlineDate', label: 'Survey Deadline' },
  { key: 'ddEndDate', label: 'DD Period Ends' },
  { key: 'financingDeadlineDate', label: 'Financing Deadline' },
  { key: 'closingDate', label: 'Closing Date' },
]

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr + 'T00:00:00').getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(diff / 86400000)
}

function countdownBadge(dateStr: string | null) {
  const days = daysUntil(dateStr)
  if (days === null) return null
  if (days < 0) return <span className="text-[9px] font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">{Math.abs(days)}d overdue</span>
  if (days === 0) return <span className="text-[9px] font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">Today</span>
  if (days <= 7) return <span className="text-[9px] font-semibold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full">{days}d</span>
  if (days <= 14) return <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">{days}d</span>
  return <span className="text-[9px] font-semibold text-green-600 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">{days}d</span>
}

function fmtDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function KeyDatesCard({ keyDates: keyDatesProp, onUpdate, psaExtractedTerms, unlocked, onToggleUnlock }: Props) {
  const keyDates = keyDatesProp ?? EMPTY_KEY_DATES

  const updateDate = (key: keyof KeyDates, val: string) => {
    onUpdate({ ...keyDates, [key]: val || null })
  }
  const clearDate = (key: keyof KeyDates) => {
    onUpdate({ ...keyDates, [key]: null })
  }
  const populateFromPSA = () => {
    if (!psaExtractedTerms) return
    const derived = deriveKeyDatesFromPSA(psaExtractedTerms)
    const merged = { ...keyDates }
    for (const [k, v] of Object.entries(derived)) {
      if (v && !(merged as any)[k]) (merged as any)[k] = v
    }
    onUpdate(merged)
  }

  const hasAnyDate = DATE_FIELDS.some(f => keyDates[f.key])

  return (
    <div className="card-soft overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-[#1a1a2e]">
        <div className="flex items-center gap-2">
          <Calendar size={12} className="text-[#c9a84c]" />
          <h3 className="text-[11px] font-semibold tracking-wider uppercase text-white">Key Dates</h3>
        </div>
        <div className="flex items-center gap-3">
          {psaExtractedTerms && (
            <button onClick={populateFromPSA}
              className="flex items-center gap-1 text-[10px] font-medium text-[#c9a84c] hover:text-amber-300 transition-colors">
              <Sparkles size={10} /> Populate from PSA
            </button>
          )}
          <button onClick={onToggleUnlock}
            className="flex items-center gap-1 text-[10px] font-semibold text-white/70 hover:text-white transition-colors"
            title={unlocked ? 'Lock dates' : 'Edit dates'}>
            {unlocked ? <><Unlock size={10} /> Editing</> : <><Lock size={10} /> Locked</>}
          </button>
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {DATE_FIELDS.map(f => {
          const val = keyDates[f.key]
          return (
            <div key={f.key} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50">
              <div className="min-w-0 flex-1 pr-3">
                <div className="text-[11px] font-medium text-gray-700">{f.label}</div>
                {unlocked ? (
                  <input
                    type="date"
                    value={val ?? ''}
                    onChange={e => updateDate(f.key, e.target.value)}
                    className="mt-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-[#c9a84c] bg-white w-full max-w-[180px]"
                  />
                ) : (
                  <div className={`text-xs mt-0.5 ${val ? 'text-gray-900 font-medium' : 'text-gray-300'}`}>{fmtDate(val)}</div>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {countdownBadge(val)}
                {unlocked && val && (
                  <button onClick={() => clearDate(f.key)} className="text-gray-300 hover:text-red-400" title="Clear">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {!hasAnyDate && !unlocked && (
        <div className="px-4 py-4 text-center bg-gray-50/50">
          <p className="text-[10px] text-gray-400">No dates set yet — unlock to enter manually{psaExtractedTerms ? ' or populate from PSA' : ''}</p>
        </div>
      )}
    </div>
  )
}
