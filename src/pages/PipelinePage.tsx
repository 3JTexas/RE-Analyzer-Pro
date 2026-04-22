import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, FileText, Home, ExternalLink, StickyNote, ChevronDown, Download, RefreshCw, Lock, Unlock } from 'lucide-react'
import { pdf } from '@react-pdf/renderer'
import { supabase } from '../lib/supabase'
import { usePipeline } from '../hooks/usePipeline'
import { getScenariosForProperty } from '../hooks/useScenario'
import { Spinner } from '../components/ui'
import { fmtDollar, fmtPct, calculate } from '../lib/calc'
import { TimelineSection } from '../components/pipeline/TimelineSection'
import { DocumentsSection } from '../components/pipeline/DocumentsSection'
import { DealTeamSection } from '../components/pipeline/DealTeamSection'
import { ExpensesSection } from '../components/pipeline/ExpensesSection'
import { RepairsSection } from '../components/pipeline/RepairsSection'
import { DealTermsSection } from '../components/pipeline/DealTermsSection'
import { DealTermsPdf } from '../components/pipeline/DealTermsPdf'
import { KeyDatesCard } from '../components/pipeline/KeyDatesCard'
import { AllNotesPanel } from '../components/pipeline/AllNotesPanel'
import { CrimeMap } from '../components/pipeline/CrimeMap'
import { useCustomRoles } from '../hooks/useCustomRoles'
import type { Scenario, ModelInputs } from '../types'
import { EMPTY_KEY_DATES } from '../types/pipeline'

function fmtShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return 'TBD'
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr + 'T00:00:00').getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.ceil(diff / 86400000)
}

function SummaryTile({ label, value, hint, tone, hintTone }: {
  label: string; value: string; hint?: string; tone?: 'default' | 'warn' | 'danger' | 'success' | 'accent';
  hintTone?: 'default' | 'warn' | 'danger' | 'success'
}) {
  const valueColor = tone === 'danger' ? 'text-red-600'
    : tone === 'warn' ? 'text-amber-600'
    : tone === 'success' ? 'text-green-600'
    : tone === 'accent' ? 'text-[#c9a84c]'
    : 'text-gray-900'
  const hintColor = hintTone === 'danger' ? 'text-red-500'
    : hintTone === 'warn' ? 'text-amber-600'
    : hintTone === 'success' ? 'text-green-600'
    : 'text-gray-400'
  return (
    <div className="flex flex-col gap-1.5 py-1">
      <span className="tile-label">{label}</span>
      <span className={`tile-number ${valueColor}`}>{value}</span>
      {hint && <span className={`text-[10px] font-medium ${hintColor}`}>{hint}</span>}
    </div>
  )
}

export function PipelinePage() {
  const { id } = useParams<{ id: string }>()
  const [property, setProperty] = useState<{ name: string; address: string | null; status: string } | null>(null)
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [propLoading, setPropLoading] = useState(true)
  const { pipeline, loading: pipelineLoading, updateLOITracking, updateMilestones, updateDealTeam, updateRepairEstimates, updateExpenseBudgets, updateActualInputs, updatePSATracking, updateKeyDates, updateDealScenarioId } = usePipeline(id)
  const { customRoles, addRole, removeRole } = useCustomRoles()

  // Wide layout on mount
  useEffect(() => {
    document.getElementById('root')?.classList.add('wide-layout')
    return () => { document.getElementById('root')?.classList.remove('wide-layout') }
  }, [])

  // Load property meta + scenarios
  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('properties').select('name, address, status').eq('id', id).single(),
      getScenariosForProperty(id),
    ]).then(([{ data: prop }, scens]) => {
      if (prop) setProperty(prop as any)
      setScenarios(scens)
      setPropLoading(false)
    })
  }, [id])

  const status = property?.status ?? 'research'
  const isPending = status === 'pending'
  const isActive = status === 'active'
  const isClosed = status === 'closed'

  // Tabs
  const tabs: { id: string; label: string }[] = isPending
    ? [
        { id: 'terms', label: 'Deal Terms' },
        { id: 'documents', label: 'Documents' },
        { id: 'contacts', label: 'Contacts' },
      ]
    : [
        { id: 'terms', label: 'Deal Terms' },
        { id: 'timeline', label: 'Timeline' },
        { id: 'documents', label: 'Documents' },
        { id: 'team', label: 'Deal Team' },
        { id: 'expenses', label: 'Expenses' },
        { id: 'repairs', label: 'Repairs' },
        { id: 'crime', label: 'Crime Map' },
      ]
  const [activeTab, setActiveTab] = useState<string>('terms')
  const [showNotes, setShowNotes] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [actionsOpen, setActionsOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const actionsCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setActiveTab('terms')
  }, [isPending, isActive, isClosed])

  const statusConfig: Record<string, { label: string; color: string; tone: 'default' | 'warn' | 'accent' | 'success' }> = {
    research: { label: 'Research', color: 'bg-gray-100 text-gray-600 border-gray-200', tone: 'default' },
    pending: { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200', tone: 'warn' },
    active: { label: 'Active', color: 'bg-green-50 text-green-700 border-green-200', tone: 'success' },
    closed: { label: 'Closed', color: 'bg-blue-50 text-blue-700 border-blue-200', tone: 'default' },
  }

  // Deal scenario
  const dealScenario = scenarios.find(s => s.id === pipeline?.deal_scenario_id)
  const nonBrokerScenarios = scenarios.filter(s => !s.is_default)

  // Latest PSA event with extracted terms (for key dates auto-population)
  const psaEvents = pipeline?.psa_tracking?.events ?? []
  const latestPSAWithTerms = [...psaEvents].reverse().find(e => e.extractedTerms)
  const psaExtractedTerms = latestPSAWithTerms?.extractedTerms ?? null

  const selectDealScenario = async (scenarioId: string | null) => {
    if (!pipeline) return
    await updateDealScenarioId(scenarioId)
    if (scenarioId) {
      const scens = await getScenariosForProperty(id!)
      setScenarios(scens)
    }
  }

  const keyDates = pipeline?.key_dates ?? EMPTY_KEY_DATES

  // Summary strip calculations
  const effectiveInputs: ModelInputs | null = dealScenario ? {
    ...dealScenario.inputs,
    ...Object.fromEntries(
      Object.entries(pipeline?.actual_inputs ?? {}).filter(([_, v]) => v !== undefined && v !== null && v !== '')
    ),
  } as ModelInputs : null
  const calc = effectiveInputs ? calculate(effectiveInputs, !(effectiveInputs.ou > 0 && effectiveInputs.ou < effectiveInputs.tu)) : null
  const ddDays = daysUntil(keyDates.ddEndDate)
  const closingDays = daysUntil(keyDates.closingDate)

  const ddTile = (): { value: string; tone: 'default' | 'warn' | 'danger' | 'success'; hint?: string } => {
    if (ddDays === null) return { value: 'TBD', tone: 'default' }
    if (ddDays < 0) return { value: `${Math.abs(ddDays)}d`, tone: 'danger', hint: 'Overdue' }
    if (ddDays === 0) return { value: 'Today', tone: 'danger' }
    if (ddDays <= 7) return { value: `${ddDays}d`, tone: 'danger' }
    if (ddDays <= 14) return { value: `${ddDays}d`, tone: 'warn' }
    return { value: `${ddDays}d`, tone: 'success' }
  }
  const dd = ddTile()

  const closingTile = (): { value: string; hint?: string; hintTone?: 'default' | 'warn' | 'danger' | 'success' } => {
    if (!keyDates.closingDate) return { value: 'TBD' }
    const label = fmtShortDate(keyDates.closingDate)
    if (closingDays === null) return { value: label }
    if (closingDays < 0) return { value: label, hint: `${Math.abs(closingDays)}d overdue`, hintTone: 'danger' }
    if (closingDays === 0) return { value: label, hint: 'Today', hintTone: 'danger' }
    if (closingDays <= 30) return { value: label, hint: `${closingDays}d away`, hintTone: 'warn' }
    return { value: label, hint: `${closingDays}d away` }
  }
  const cl = closingTile()

  const openActions = useCallback(() => {
    if (actionsCloseTimer.current) { clearTimeout(actionsCloseTimer.current); actionsCloseTimer.current = null }
    setActionsOpen(true)
  }, [])
  const closeActions = useCallback(() => {
    actionsCloseTimer.current = setTimeout(() => setActionsOpen(false), 350)
  }, [])

  const exportPdf = async (mode: 'full' | 'actual') => {
    if (!dealScenario) return
    setActionsOpen(false)
    setGenerating(true)
    try {
      const blob = await pdf(
        <DealTermsPdf
          projected={dealScenario.inputs}
          actualInputs={pipeline?.actual_inputs ?? {}}
          scenarioName={dealScenario.name}
          propertyName={property?.name ?? ''}
          propertyAddress={property?.address ?? null}
          keyDates={keyDates}
          mode={mode}
        />
      ).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const suffix = mode === 'actual' ? '_Actual' : ''
      a.download = `${(property?.name || 'Property').replace(/[^a-zA-Z0-9]/g, '_')}_Deal_Terms${suffix}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally { setGenerating(false) }
  }

  if (propLoading || pipelineLoading) return <Spinner />

  const statusPill = statusConfig[status] ?? statusConfig.research

  return (
    <div className="flex flex-col h-full">
      {/* ── Page Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 md:px-10 py-4 bg-white border-b border-gray-100 flex-shrink-0">
        <Link to="/" className="p-1.5 text-gray-400 hover:text-[#c9a84c] transition-colors" title="Home">
          <Home size={16} />
        </Link>
        <Link to={`/property/${id}`} className="hidden sm:flex items-center gap-0.5 -ml-1 text-gray-400 hover:text-[#1a1a2e] transition-colors">
          <ChevronLeft size={18} />
          <span className="text-xs">Property</span>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="eyebrow text-[#c9a84c] hidden sm:inline">Deal Tracker</span>
            <span className="text-gray-200 hidden sm:inline">·</span>
            <h1 className="text-lg md:text-xl font-semibold text-gray-900 truncate tracking-tight">{property?.name}</h1>
            <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${statusPill.color}`}>
              {statusPill.label}
            </span>
          </div>
          {property?.address && <p className="text-xs text-gray-400 truncate mt-0.5">{property.address}</p>}
        </div>
        {dealScenario && (
          <Link to={`/property/${id}`}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg hover:border-[#c9a84c] transition-colors flex-shrink-0"
            title="Open in Model">
            <FileText size={12} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-700 truncate max-w-[140px]">{dealScenario.name}</span>
            <ExternalLink size={11} className="text-gray-400" />
          </Link>
        )}
        {dealScenario && (
          <div className="relative" onMouseEnter={openActions} onMouseLeave={closeActions}>
            <button
              onClick={() => setActionsOpen(v => !v)}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1a2e] text-white rounded-lg hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors disabled:opacity-50 flex-shrink-0">
              <span className="text-xs font-semibold">{generating ? 'Generating…' : 'Actions'}</span>
              <ChevronDown size={12} />
            </button>
            {actionsOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
                <button
                  onClick={() => { setActionsOpen(false); setUnlocked(v => !v) }}
                  className="flex items-center gap-2 w-full text-left px-3.5 py-2.5 text-xs text-gray-700 hover:bg-gray-50">
                  {unlocked ? <Unlock size={13} className="text-amber-600" /> : <Lock size={13} className="text-gray-400" />}
                  <span>{unlocked ? 'Lock actuals' : 'Edit actuals'}</span>
                </button>
                <button
                  onClick={() => { setActionsOpen(false); selectDealScenario(null) }}
                  className="flex items-center gap-2 w-full text-left px-3.5 py-2.5 text-xs text-gray-700 hover:bg-gray-50">
                  <RefreshCw size={13} className="text-gray-400" />
                  <span>Change scenario</span>
                </button>
                <div className="border-t border-gray-100 my-1" />
                <div className="px-3.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-gray-400">Export</div>
                <button
                  onClick={() => exportPdf('full')}
                  className="flex items-start gap-2 w-full text-left px-3.5 py-2 text-xs text-gray-700 hover:bg-gray-50">
                  <Download size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <span>
                    <span className="block font-medium">Comparative PDF</span>
                    <span className="block text-[10px] text-gray-400">Projected vs Actual + Delta</span>
                  </span>
                </button>
                <button
                  onClick={() => exportPdf('actual')}
                  className="flex items-start gap-2 w-full text-left px-3.5 py-2 text-xs text-gray-700 hover:bg-gray-50">
                  <Download size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <span>
                    <span className="block font-medium">Actuals Only PDF</span>
                    <span className="block text-[10px] text-gray-400">Actual terms + 5-year projection</span>
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
        <button
          onClick={() => setShowNotes(!showNotes)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors flex-shrink-0
            ${showNotes ? 'bg-amber-50 border-[#c9a84c] text-[#c9a84c]' : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-[#c9a84c] hover:text-[#c9a84c]'}`}
          title="All Notes">
          <StickyNote size={12} />
          <span className="text-xs font-medium hidden sm:inline">Notes</span>
        </button>
      </div>

      {/* ── Summary strip ───────────────────────────────────────────── */}
      {dealScenario && calc && effectiveInputs && (
        <div className="bg-white border-b border-gray-100 flex-shrink-0 px-6 md:px-10 py-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <SummaryTile
              label="Purchase Price"
              value={fmtDollar(effectiveInputs.price || 0)}
              hint={effectiveInputs.tu > 0 ? `${fmtDollar((effectiveInputs.price || 0) / effectiveInputs.tu)} / door` : undefined}
            />
            <SummaryTile
              label="Cap Rate"
              value={fmtPct(calc.cap)}
              hint={`NOI ${fmtDollar(calc.NOI)}`}
              tone="accent"
            />
            <SummaryTile
              label="DD Days Left"
              value={dd.value}
              hint={keyDates.ddEndDate ? fmtShortDate(keyDates.ddEndDate) : 'Not set'}
              tone={dd.tone}
            />
            <SummaryTile
              label="Closing Date"
              value={cl.value}
              hint={cl.hint}
              hintTone={cl.hintTone}
            />
            <SummaryTile
              label="Deal Status"
              value={statusPill.label}
              hint={isClosed ? 'Locked — read only' : isActive ? 'Under contract' : isPending ? 'LOI / PSA' : 'Pre-contract'}
              tone={statusPill.tone === 'warn' ? 'warn' : statusPill.tone === 'success' ? 'success' : statusPill.tone === 'accent' ? 'accent' : 'default'}
            />
          </div>
        </div>
      )}

      {/* ── Notes panel ─────────────────────────────────────────────── */}
      {showNotes && pipeline && (
        <div className="border-b border-gray-100 bg-amber-50/30 px-4 md:px-10 py-4 max-h-80 overflow-y-auto flex-shrink-0">
          <AllNotesPanel pipeline={pipeline} />
        </div>
      )}

      {/* ── Body: sidebar + content ─────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Desktop sidebar */}
        <nav className="hidden lg:flex flex-col w-56 border-r border-gray-100 bg-white/60 py-6 px-3 gap-0.5 flex-shrink-0 overflow-y-auto">
          <div className="px-3 pb-3 eyebrow text-gray-400">Sections</div>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-left text-xs font-medium px-3 py-2 rounded-md transition-colors
                ${activeTab === tab.id
                  ? 'bg-[#1a1a2e] text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Mobile horizontal tabs */}
          <div className="lg:hidden flex overflow-x-auto border-b border-gray-100 bg-gray-50 px-4 flex-shrink-0 scrollbar-hide">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap px-4 py-2.5 text-xs font-medium transition-colors relative
                  ${activeTab === tab.id
                    ? 'text-[#1a1a2e] border-b-2 border-[#c9a84c] bg-white'
                    : 'text-gray-400 hover:text-gray-600'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 md:px-10 py-7 max-w-[1280px] mx-auto w-full">

              {/* Scenario selector (if no deal scenario picked yet) */}
              {!dealScenario && pipeline && (
                <div className="bg-white border-2 border-dashed border-[#c9a84c] rounded-lg p-6 mb-6">
                  <h3 className="section-title mb-1">Which scenario is your offer?</h3>
                  <p className="text-xs text-gray-400 mb-4">Select the scenario that represents the deal terms you're pursuing. Its price, financing, and key inputs will feed into the pipeline.</p>
                  {nonBrokerScenarios.length === 0 ? (
                    <p className="text-xs text-gray-400">No non-broker scenarios found. Go back and create an offer scenario first.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {nonBrokerScenarios.map(s => (
                        <button key={s.id} onClick={() => selectDealScenario(s.id)}
                          className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-[#c9a84c] hover:bg-[#c9a84c]/5 transition-colors text-left">
                          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0">
                            <FileText size={14} className="text-amber-600" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-gray-900 truncate">{s.name}</div>
                            <div className="text-[10px] text-gray-400">{fmtDollar(s.inputs.price)} · {s.inputs.lev}% LTV</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Deal Terms ── */}
              {activeTab === 'terms' && pipeline && dealScenario && (
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6">
                  <div className="min-w-0">
                    <DealTermsSection
                      dealScenario={{ name: dealScenario.name, inputs: dealScenario.inputs }}
                      actualInputs={pipeline.actual_inputs ?? {}}
                      onUpdateActuals={updateActualInputs}
                      onChangeScenario={() => selectDealScenario(null)}
                      propertyName={property?.name ?? ''}
                      propertyAddress={property?.address ?? null}
                      keyDates={keyDates}
                      onUpdateKeyDates={updateKeyDates}
                      psaExtractedTerms={psaExtractedTerms}
                      hideKeyDatesInline
                      hideHeaderControls
                      unlocked={unlocked}
                      onToggleUnlock={() => setUnlocked(v => !v)}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="xl:sticky xl:top-4">
                      <KeyDatesCard
                        keyDates={keyDates}
                        onUpdate={updateKeyDates}
                        psaExtractedTerms={psaExtractedTerms}
                        unlocked={unlocked}
                        onToggleUnlock={() => setUnlocked(v => !v)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Deal Terms — no scenario selected ── */}
              {activeTab === 'terms' && pipeline && !dealScenario && (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-400">Select a scenario above to see deal terms</p>
                </div>
              )}

              {/* ── Documents ── */}
              {activeTab === 'documents' && pipeline && (
                <DocumentsSection
                  pipelineId={pipeline.id}
                  loiTracking={pipeline.loi_tracking}
                  psaTracking={pipeline.psa_tracking ?? { events: [] }}
                  onUpdateLOI={loi => {
                    updateLOITracking(loi)
                    const events = loi.events ?? []
                    const last = events[events.length - 1]
                    const loiStatus = !last ? 'pending' : (last.type === 'accepted' ? 'completed' : 'in_progress')
                    const updated = (pipeline.milestones ?? []).map(m =>
                      m.id === 'loi' ? { ...m, status: loiStatus as any, date: last?.date ?? m.date } : m
                    )
                    if (JSON.stringify(updated) !== JSON.stringify(pipeline.milestones)) updateMilestones(updated)
                  }}
                  onUpdatePSA={psa => {
                    updatePSATracking(psa)
                    const events = psa.events ?? []
                    const last = events[events.length - 1]
                    const psaStatus = !last ? 'pending' : (last.type === 'executed' ? 'completed' : 'in_progress')
                    const updated = (pipeline.milestones ?? []).map(m =>
                      m.id === 'psa' ? { ...m, status: psaStatus as any, date: last?.date ?? m.date } : m
                    )
                    if (JSON.stringify(updated) !== JSON.stringify(pipeline.milestones)) updateMilestones(updated)
                  }}
                />
              )}

              {/* ── PENDING: Contacts (limited roles: attorney + broker) ── */}
              {activeTab === 'contacts' && pipeline && (
                <DealTeamSection dealTeam={pipeline.deal_team} onUpdate={updateDealTeam} limitedRoles={['attorney', 'broker']} customRoles={customRoles} />
              )}

              {/* ── ACTIVE: Timeline ── */}
              {activeTab === 'timeline' && pipeline && (isActive || isClosed) && (
                <TimelineSection milestones={pipeline.milestones} onUpdate={updateMilestones} loiTracking={pipeline.loi_tracking} psaTracking={pipeline.psa_tracking} readOnly={isClosed} />
              )}

              {/* ── ACTIVE: Deal Team (all roles) ── */}
              {activeTab === 'team' && pipeline && (
                <DealTeamSection dealTeam={pipeline.deal_team} onUpdate={updateDealTeam} customRoles={customRoles} onAddRole={addRole} onRemoveRole={removeRole} />
              )}

              {/* ── ACTIVE: Expenses ── */}
              {activeTab === 'expenses' && pipeline && (
                <ExpensesSection pipelineId={pipeline.id} expenseBudgets={pipeline.expense_budgets} onBudgetUpdate={updateExpenseBudgets} />
              )}

              {/* ── ACTIVE: Repairs ── */}
              {activeTab === 'repairs' && pipeline && (
                <RepairsSection
                  repairEstimates={pipeline.repair_estimates}
                  onUpdate={updateRepairEstimates}
                  propertyName={property?.name ?? ''}
                  propertyAddress={property?.address ?? null}
                  readOnly={isClosed}
                />
              )}

              {/* ── ACTIVE: Crime Map ── */}
              {activeTab === 'crime' && pipeline && property && (
                <CrimeMap
                  propertyName={property.name}
                  propertyAddress={property.address ?? ''}
                  pipelineId={pipeline.id}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
