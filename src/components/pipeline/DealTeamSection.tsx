import { useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2, Check, Phone, Mail, User, Globe, MapPin, Pencil, Download, X } from 'lucide-react'
import type { DealTeam, DealTeamCandidate, DealTeamRole } from '../../types/pipeline'
import { DEAL_TEAM_ROLES } from '../../types/pipeline'
import type { CustomRole } from '../../hooks/useCustomRoles'

interface Props {
  dealTeam: DealTeam
  onUpdate: (team: DealTeam) => void
  limitedRoles?: DealTeamRole[]  // if set, only show these roles (for mini-pipeline Contacts tab)
  customRoles?: CustomRole[]
  onAddRole?: (label: string) => Promise<CustomRole | null>
  onRemoveRole?: (id: string) => Promise<void>
}

const emptyDraft = { name: '', company: '', phone: '', email: '', website: '', address: '', notes: '' }

function exportVCard(c: DealTeamCandidate, roleLabel: string) {
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${c.name}`,
  ]
  if (c.company) lines.push(`ORG:${c.company}`)
  if (c.phone) lines.push(`TEL;TYPE=WORK:${c.phone}`)
  if (c.email) lines.push(`EMAIL;TYPE=WORK:${c.email}`)
  if (c.website) lines.push(`URL:${c.website.startsWith('http') ? c.website : `https://${c.website}`}`)
  if (c.address) lines.push(`ADR;TYPE=WORK:;;${c.address};;;;`)
  if (c.notes || roleLabel) {
    const note = [roleLabel ? `Role: ${roleLabel}` : '', c.notes].filter(Boolean).join(' — ')
    lines.push(`NOTE:${note}`)
  }
  lines.push('END:VCARD')

  const blob = new Blob([lines.join('\r\n')], { type: 'text/vcard' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${c.name.replace(/\s+/g, '_')}.vcf`
  a.click()
  URL.revokeObjectURL(url)
}

export function DealTeamSection({ dealTeam, onUpdate, limitedRoles, customRoles = [], onAddRole, onRemoveRole }: Props) {
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set())
  const [addingTo, setAddingTo] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [showAddRole, setShowAddRole] = useState(false)
  const [newRoleLabel, setNewRoleLabel] = useState('')

  const allRoles = [...DEAL_TEAM_ROLES, ...customRoles.map(r => ({ id: r.id, label: r.label }))]
  const roles = limitedRoles
    ? allRoles.filter(r => limitedRoles.includes(r.id))
    : allRoles

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
    setDraft(emptyDraft)
    setAddingTo(null)
  }

  const saveEdit = (role: string, candidateId: string) => {
    if (!draft.name.trim()) return
    const updated = { ...dealTeam }
    updated[role] = {
      candidates: getCandidates(role).map(c =>
        c.id === candidateId
          ? { ...c, name: draft.name.trim(), company: draft.company.trim(), phone: draft.phone.trim(), email: draft.email.trim(), website: draft.website.trim(), address: draft.address.trim(), notes: draft.notes.trim() }
          : c
      ),
    }
    onUpdate(updated)
    setDraft(emptyDraft)
    setEditingId(null)
  }

  const startEdit = (c: DealTeamCandidate) => {
    setEditingId(c.id)
    setAddingTo(null)
    setDraft({ name: c.name, company: c.company || '', phone: c.phone || '', email: c.email || '', website: c.website || '', address: c.address || '', notes: c.notes || '' })
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

  const inputCls = "text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white"

  return (
    <div className="space-y-2">
      {roles.map(role => {
        const candidates = getCandidates(role.id)
        const selected = getSelected(role.id)
        const expanded = expandedRoles.has(role.id)
        const isCustom = customRoles.some(r => r.id === role.id)

        return (
          <div key={role.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Role header */}
            <button
              onClick={() => setExpandedRoles(prev => {
                const next = new Set(prev)
                if (next.has(role.id)) next.delete(role.id); else next.add(role.id)
                return next
              })}
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
                {isCustom && onRemoveRole && candidates.length === 0 && (
                  <button
                    onClick={e => { e.stopPropagation(); if (window.confirm(`Remove "${role.label}" role from all deals?`)) onRemoveRole(role.id) }}
                    className="p-1 text-gray-300 hover:text-red-500 transition-colors" title="Remove custom role">
                    <X size={12} />
                  </button>
                )}
                {isCustom && (
                  <span className="text-[9px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Custom</span>
                )}
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
                    {candidates.map(c => {
                      const isEditing = editingId === c.id

                      if (isEditing) {
                        return (
                          <div key={c.id} className="bg-amber-50/50 border border-[#c9a84c] rounded-lg p-3">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
                              <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                                placeholder="Name *" className={inputCls} />
                              <input value={draft.company} onChange={e => setDraft(d => ({ ...d, company: e.target.value }))}
                                placeholder="Company" className={inputCls} />
                              <input value={draft.phone} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))}
                                placeholder="Phone" className={inputCls} />
                              <input value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
                                placeholder="Email" className={inputCls} />
                              <input value={draft.website} onChange={e => setDraft(d => ({ ...d, website: e.target.value }))}
                                placeholder="Website" className={inputCls} />
                              <input value={draft.address} onChange={e => setDraft(d => ({ ...d, address: e.target.value }))}
                                placeholder="Address" className={inputCls} />
                            </div>
                            <textarea value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                              placeholder="Notes (optional)" rows={2}
                              className={`w-full resize-none mb-2 ${inputCls}`} />
                            <div className="flex gap-2">
                              <button onClick={() => saveEdit(role.id, c.id)}
                                disabled={!draft.name.trim()}
                                className="flex-1 bg-[#1a1a2e] text-white text-xs font-medium py-2 rounded-lg hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors disabled:opacity-40">
                                Save
                              </button>
                              <button onClick={() => { setEditingId(null); setDraft(emptyDraft) }}
                                className="flex-1 bg-white border border-gray-200 text-gray-500 text-xs font-medium py-2 rounded-lg">
                                Cancel
                              </button>
                            </div>
                          </div>
                        )
                      }

                      return (
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
                            <button onClick={() => exportVCard(c, role.label)}
                              className="p-1 text-gray-400 hover:text-[#c9a84c] transition-colors" title="Save to Contacts (.vcf)">
                              <Download size={14} />
                            </button>
                            <button onClick={() => startEdit(c)}
                              className="p-1 text-gray-400 hover:text-[#c9a84c] transition-colors" title="Edit">
                              <Pencil size={14} />
                            </button>
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
                      )
                    })}
                  </div>
                )}

                {/* Add form */}
                {addingTo === role.id ? (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-2">
                      <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                        placeholder="Name *" className={inputCls} />
                      <input value={draft.company} onChange={e => setDraft(d => ({ ...d, company: e.target.value }))}
                        placeholder="Company" className={inputCls} />
                      <input value={draft.phone} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))}
                        placeholder="Phone" className={inputCls} />
                      <input value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
                        placeholder="Email" className={inputCls} />
                      <input value={draft.website} onChange={e => setDraft(d => ({ ...d, website: e.target.value }))}
                        placeholder="Website" className={inputCls} />
                      <input value={draft.address} onChange={e => setDraft(d => ({ ...d, address: e.target.value }))}
                        placeholder="Address" className={inputCls} />
                    </div>
                    <textarea value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                      placeholder="Notes (optional)" rows={2}
                      className={`w-full resize-none mb-2 ${inputCls}`} />
                    <div className="flex gap-2">
                      <button onClick={() => addCandidate(role.id)}
                        disabled={!draft.name.trim()}
                        className="flex-1 bg-[#1a1a2e] text-white text-xs font-medium py-2 rounded-lg hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors disabled:opacity-40">
                        Add Contact
                      </button>
                      <button onClick={() => { setAddingTo(null); setDraft(emptyDraft) }}
                        className="flex-1 bg-white border border-gray-200 text-gray-500 text-xs font-medium py-2 rounded-lg">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => { setAddingTo(role.id); setEditingId(null); setDraft(emptyDraft) }}
                    className="flex items-center gap-1.5 text-[10px] font-medium text-[#c9a84c] hover:text-[#b8963f] transition-colors">
                    <Plus size={12} /> Add {role.label.toLowerCase()}
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Add new role */}
      {onAddRole && !limitedRoles && (
        showAddRole ? (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-3">
            <div className="flex gap-2">
              <input
                value={newRoleLabel}
                onChange={e => setNewRoleLabel(e.target.value)}
                placeholder="Role name (e.g. Contractor, Title Agent)"
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white"
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter' && newRoleLabel.trim()) {
                    onAddRole(newRoleLabel.trim())
                    setNewRoleLabel('')
                    setShowAddRole(false)
                  }
                }}
              />
              <button
                onClick={async () => {
                  if (newRoleLabel.trim()) {
                    await onAddRole(newRoleLabel.trim())
                    setNewRoleLabel('')
                    setShowAddRole(false)
                  }
                }}
                disabled={!newRoleLabel.trim()}
                className="px-4 py-2 text-xs font-semibold bg-[#1a1a2e] text-white rounded-lg hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors disabled:opacity-40">
                Add
              </button>
              <button onClick={() => { setShowAddRole(false); setNewRoleLabel('') }}
                className="px-4 py-2 text-xs font-medium bg-white border border-gray-200 text-gray-500 rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowAddRole(true)}
            className="w-full flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-[#c9a84c] hover:text-[#b8963f] border border-dashed border-gray-300 rounded-lg hover:border-[#c9a84c] transition-colors">
            <Plus size={14} /> Add New Role
          </button>
        )
      )}
    </div>
  )
}
