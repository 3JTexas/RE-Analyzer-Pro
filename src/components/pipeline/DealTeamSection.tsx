import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2, Check, Phone, Mail, User, Globe, MapPin } from 'lucide-react'
import type { DealTeam, DealTeamCandidate, DealTeamRole } from '../../types/pipeline'
import { DEAL_TEAM_ROLES } from '../../types/pipeline'

interface Props {
  dealTeam: DealTeam
  onUpdate: (team: DealTeam) => void
  limitedRoles?: DealTeamRole[]  // if set, only show these roles (for mini-pipeline Contacts tab)
}

export function DealTeamSection({ dealTeam, onUpdate, limitedRoles }: Props) {
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [draft, setDraft] = useState({ name: '', company: '', phone: '', email: '', website: '', address: '', notes: '' })

  const roles = limitedRoles
    ? DEAL_TEAM_ROLES.filter(r => limitedRoles.includes(r.id))
    : DEAL_TEAM_ROLES

  const getCandidates = (role: string): DealTeamCandidate[] =>
    dealTeam[role]?.candidates ?? []

  const getSelected = (role: string): DealTeamCandidate | undefined =>
    getCandidates(role).find(c => c.selected)

  const addCandidate = (role: string) => {
    if (!draft.name.trim()) return
    const candidate: DealTeamCandidate = {
      id: crypto.randomUUID(),
      name: draft.name.trim(),
      company: draft.company.trim(),
      phone: draft.phone.trim(),
      email: draft.email.trim(),
      website: draft.website.trim(),
      address: draft.address.trim(),
      notes: draft.notes.trim(),
      selected: getCandidates(role).length === 0,  // auto-select first one
    }
    const updated = { ...dealTeam }
    updated[role] = { candidates: [...getCandidates(role), candidate] }
    onUpdate(updated)
    setDraft({ name: '', company: '', phone: '', email: '', website: '', address: '', notes: '' })
    setAddingTo(null)
  }

  const removeCandidate = (role: string, candidateId: string) => {
    const updated = { ...dealTeam }
    updated[role] = { candidates: getCandidates(role).filter(c => c.id !== candidateId) }
    onUpdate(updated)
  }

  const toggleSelected = (role: string, candidateId: string) => {
    const updated = { ...dealTeam }
    updated[role] = {
      candidates: getCandidates(role).map(c => ({
        ...c,
        selected: c.id === candidateId ? !c.selected : false,
      })),
    }
    onUpdate(updated)
  }

  return (
    <div className="space-y-2">
      {roles.map(role => {
        const candidates = getCandidates(role.id)
        const selected = getSelected(role.id)
        const expanded = expandedRole === role.id

        return (
          <div key={role.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Role header */}
            <button
              onClick={() => setExpandedRole(expanded ? null : role.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                  <User size={14} className="text-gray-500" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-gray-900">{role.label}</div>
                  {selected ? (
                    <div className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                      <Check size={9} /> {selected.name}{selected.company ? ` — ${selected.company}` : ''}
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-400">
                      {candidates.length > 0 ? `${candidates.length} candidate${candidates.length > 1 ? 's' : ''} — none selected` : 'No contacts added'}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {candidates.length > 0 && (
                  <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                    {candidates.length}
                  </span>
                )}
                {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </div>
            </button>

            {/* Expanded: candidates + add form */}
            {expanded && (
              <div className="border-t border-gray-100 px-4 py-3">
                {/* Candidate cards */}
                {candidates.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {candidates.map(c => (
                      <div key={c.id}
                        className={`flex items-start gap-3 p-3 rounded-lg border transition-colors
                          ${c.selected ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-900">{c.name}</span>
                            {c.selected && (
                              <span className="text-[9px] font-semibold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">Selected</span>
                            )}
                          </div>
                          {c.company && <div className="text-[10px] text-gray-500 mt-0.5">{c.company}</div>}
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {c.phone && (
                              <a href={`tel:${c.phone}`} className="text-[10px] text-gray-400 hover:text-[#c9a84c] flex items-center gap-0.5">
                                <Phone size={9} /> {c.phone}
                              </a>
                            )}
                            {c.email && (
                              <a href={`mailto:${c.email}`} className="text-[10px] text-gray-400 hover:text-[#c9a84c] flex items-center gap-0.5">
                                <Mail size={9} /> {c.email}
                              </a>
                            )}
                            {c.website && (
                              <a href={c.website.startsWith('http') ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer"
                                className="text-[10px] text-gray-400 hover:text-[#c9a84c] flex items-center gap-0.5">
                                <Globe size={9} /> {c.website.replace(/^https?:\/\//, '')}
                              </a>
                            )}
                          </div>
                          {c.address && (
                            <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-0.5">
                              <MapPin size={9} className="flex-shrink-0" /> {c.address}
                            </div>
                          )}
                          {c.notes && <div className="text-[10px] text-gray-400 mt-1 italic">{c.notes}</div>}
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => toggleSelected(role.id, c.id)}
                            className={`p-1 rounded transition-colors ${c.selected ? 'text-green-600 hover:text-green-800' : 'text-gray-400 hover:text-green-600'}`}
                            title={c.selected ? 'Deselect' : 'Select as vendor'}>
                            <Check size={14} />
                          </button>
                          <button onClick={() => { if (window.confirm(`Remove ${c.name}?`)) removeCandidate(role.id, c.id) }}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Remove">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add form */}
                {addingTo === role.id ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
                      <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                        placeholder="Name *" className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white" />
                      <input value={draft.company} onChange={e => setDraft(d => ({ ...d, company: e.target.value }))}
                        placeholder="Company" className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white" />
                      <input value={draft.phone} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))}
                        placeholder="Phone" className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white" />
                      <input value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
                        placeholder="Email" className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white" />
                      <input value={draft.website} onChange={e => setDraft(d => ({ ...d, website: e.target.value }))}
                        placeholder="Website" className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white" />
                      <input value={draft.address} onChange={e => setDraft(d => ({ ...d, address: e.target.value }))}
                        placeholder="Address" className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white" />
                    </div>
                    <textarea value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                      placeholder="Notes (optional)" rows={2}
                      className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white resize-none mb-2" />
                    <div className="flex gap-2">
                      <button onClick={() => addCandidate(role.id)}
                        disabled={!draft.name.trim()}
                        className="flex-1 bg-[#1a1a2e] text-white text-xs font-medium py-2 rounded-lg hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors disabled:opacity-40">
                        Add Contact
                      </button>
                      <button onClick={() => { setAddingTo(null); setDraft({ name: '', company: '', phone: '', email: '', website: '', address: '', notes: '' }) }}
                        className="flex-1 bg-white border border-gray-200 text-gray-500 text-xs font-medium py-2 rounded-lg">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAddingTo(role.id)}
                    className="flex items-center gap-1.5 text-[10px] font-medium text-[#c9a84c] hover:text-[#b8963f] transition-colors">
                    <Plus size={12} /> Add {role.label.toLowerCase()}
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
