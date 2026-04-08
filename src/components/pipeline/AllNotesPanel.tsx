import { StickyNote, Calendar, User, FileText, DollarSign, Wrench } from 'lucide-react'
import type { DealPipeline } from '../../types/pipeline'

interface NoteEntry {
  source: string
  icon: typeof StickyNote
  text: string
  date?: string
  color: string
}

interface Props {
  pipeline: DealPipeline
}

export function AllNotesPanel({ pipeline }: Props) {
  const notes: NoteEntry[] = []

  // Milestone notes
  for (const m of pipeline.milestones ?? []) {
    if (m.notes?.trim()) {
      notes.push({ source: `Timeline — ${m.name}`, icon: Calendar, text: m.notes, date: m.date ?? undefined, color: 'text-amber-600' })
    }
  }

  // LOI event notes
  for (const evt of pipeline.loi_tracking?.events ?? []) {
    if (evt.notes?.trim()) {
      notes.push({ source: `LOI — ${evt.type.replace(/_/g, ' ')}`, icon: FileText, text: evt.notes, date: evt.date, color: 'text-blue-600' })
    }
  }

  // PSA event notes
  for (const evt of pipeline.psa_tracking?.events ?? []) {
    if (evt.notes?.trim()) {
      notes.push({ source: `PSA — ${evt.type.replace(/_/g, ' ')}`, icon: FileText, text: evt.notes, date: evt.date, color: 'text-blue-600' })
    }
  }

  // Deal team contact notes
  for (const [role, data] of Object.entries(pipeline.deal_team ?? {})) {
    for (const c of data.candidates ?? []) {
      if (c.notes?.trim()) {
        notes.push({ source: `Contact — ${c.name} (${role.replace(/_/g, ' ')})`, icon: User, text: c.notes, color: 'text-green-600' })
      }
    }
  }

  // Expense descriptions (from expense_budgets notes aren't stored, but deal_expenses have descriptions)
  // These are in a separate table, not on pipeline object directly. Skip for now.

  // Repair notes
  for (const r of pipeline.repair_estimates ?? []) {
    if (r.notes?.trim()) {
      notes.push({ source: `Repair — ${r.description ?? 'Item'}`, icon: Wrench, text: r.notes, color: 'text-orange-600' })
    }
  }

  if (notes.length === 0) {
    return (
      <div className="text-center py-8">
        <StickyNote size={24} className="text-gray-200 mx-auto mb-2" />
        <p className="text-xs text-gray-400">No notes across this deal yet</p>
        <p className="text-[10px] text-gray-300 mt-1">Notes from timeline, documents, contacts, and repairs will appear here</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium mb-2">{notes.length} note{notes.length !== 1 ? 's' : ''} across this deal</p>
      {notes.map((n, i) => {
        const Icon = n.icon
        return (
          <div key={i} className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-2 mb-1">
              <Icon size={10} className={n.color} />
              <span className={`text-[10px] font-semibold ${n.color}`}>{n.source}</span>
              {n.date && (
                <span className="text-[9px] text-gray-400 ml-auto">
                  {new Date(n.date + (n.date.includes('T') ? '' : 'T00:00:00')).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-700 leading-relaxed">{n.text}</p>
          </div>
        )
      })}
    </div>
  )
}
