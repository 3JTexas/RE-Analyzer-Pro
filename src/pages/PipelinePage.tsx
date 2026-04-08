import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ChevronLeft, FileText, Home, ExternalLink, StickyNote } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { usePipeline } from '../hooks/usePipeline'
import { getScenariosForProperty } from '../hooks/useScenario'
import { Spinner } from '../components/ui'
import { fmtDollar } from '../lib/calc'
import { TimelineSection } from '../components/pipeline/TimelineSection'
import { DocumentsSection } from '../components/pipeline/DocumentsSection'
import { DealTeamSection } from '../components/pipeline/DealTeamSection'
import { ExpensesSection } from '../components/pipeline/ExpensesSection'
import { RepairsSection } from '../components/pipeline/RepairsSection'
import { DealTermsSection } from '../components/pipeline/DealTermsSection'
import { AllNotesPanel } from '../components/pipeline/AllNotesPanel'
import { useCustomRoles } from '../hooks/useCustomRoles'
import type { Scenario } from '../types'
import type { MiniPipelineTab, FullPipelineTab, LOIStatus } from '../types/pipeline'

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

  // Tabs — Deal Terms always first, full tabs added when Active/Closed
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
      ]
  const [activeTab, setActiveTab] = useState<string>('terms')
  const [showNotes, setShowNotes] = useState(false)

  useEffect(() => {
    setActiveTab('terms')
  }, [isPending, isActive, isClosed])

  const statusConfig: Record<string, { label: string; color: string }> = {
    research: { label: 'Research', color: 'bg-gray-100 text-gray-600 border-gray-200' },
    pending: { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    active: { label: 'Active', color: 'bg-green-50 text-green-700 border-green-200' },
    closed: { label: 'Closed', color: 'bg-blue-50 text-blue-700 border-blue-200' },
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
      // Refresh scenarios to get the selected one's data
      const scens = await getScenariosForProperty(id!)
      setScenarios(scens)
    }
  }

  if (propLoading || pipelineLoading) return <Spinner />

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-8 py-3 bg-white border-b border-gray-200 flex-shrink-0">
        <Link to="/" className="p-1.5 text-gray-400 hover:text-[#c9a84c] transition-colors" title="Home">
          <Home size={16} />
        </Link>
        <Link to={`/property/${id}`} className="flex items-center gap-0.5 -ml-1 text-gray-400 hover:text-[#1a1a2e] transition-colors">
          <ChevronLeft size={20} />
          <span className="text-xs">Property</span>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-gray-900 truncate">{property?.name}</h1>
            <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${statusConfig[status]?.color ?? statusConfig.research.color}`}>
              {statusConfig[status]?.label ?? 'Research'}
            </span>
          </div>
          {property?.address && <p className="text-xs text-gray-400 truncate">{property.address}</p>}
        </div>
        <div className="flex-shrink-0 px-3">
          <span className="text-sm font-bold tracking-widest text-[#1a1a2e] uppercase">Deal Tracker</span>
        </div>
        {dealScenario && (
          <Link to={`/property/${id}`} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg hover:border-[#c9a84c] transition-colors" title="Open in Model">
            <FileText size={12} className="text-gray-400" />
            <span className="text-xs font-medium text-gray-700">{dealScenario.name}</span>
          </Link>
        )}
        <button
          onClick={() => setShowNotes(!showNotes)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors flex-shrink-0
            ${showNotes ? 'bg-amber-50 border-[#c9a84c] text-[#c9a84c]' : 'bg-gray-50 border-gray-200 text-gray-400 hover:border-[#c9a84c] hover:text-[#c9a84c]'}`}
          title="All Notes">
          <StickyNote size={12} />
          <span className="text-xs font-medium">Notes</span>
        </button>
      </div>

      {/* All Notes panel */}
      {showNotes && pipeline && (
        <div className="border-b border-gray-200 bg-amber-50/30 px-4 md:px-8 py-4 max-h-80 overflow-y-auto">
          <AllNotesPanel pipeline={pipeline} />
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-gray-50 px-4 md:px-8">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-medium transition-colors relative
              ${activeTab === tab.id
                ? 'text-[#1a1a2e] border-b-2 border-[#c9a84c] bg-white'
                : 'text-gray-400 hover:text-gray-600'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-6xl mx-auto w-full">

        {/* ── Scenario selector (if no deal scenario picked yet) ── */}
        {!dealScenario && pipeline && (
          <div className="bg-white border-2 border-dashed border-[#c9a84c] rounded-lg p-5 mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Which scenario is your offer?</h3>
            <p className="text-[10px] text-gray-400 mb-3">Select the scenario that represents the deal terms you're pursuing. Its price, financing, and key inputs will feed into the pipeline.</p>
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
          <div>
            <div className="flex items-center justify-end mb-3">
              <Link to={`/property/${id}`}
                className="flex items-center gap-1.5 text-xs font-medium text-[#c9a84c] hover:text-[#b8963f] transition-colors">
                <ExternalLink size={12} /> Open in Model
              </Link>
            </div>
            {/* Projected vs Actual deal terms */}
            <DealTermsSection
              dealScenario={{ name: dealScenario.name, inputs: dealScenario.inputs }}
              actualInputs={pipeline.actual_inputs ?? {}}
              onUpdateActuals={updateActualInputs}
              onChangeScenario={() => selectDealScenario(null)}
              propertyName={property?.name ?? ''}
              propertyAddress={property?.address ?? null}
              keyDates={pipeline.key_dates ?? { effectiveDate: null, earnestMoneyDueDate: null, ddEndDate: null, financingDeadlineDate: null, closingDate: null }}
              onUpdateKeyDates={updateKeyDates}
              psaExtractedTerms={psaExtractedTerms}
            />
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
              // Auto-sync LOI milestone
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
              // Auto-sync PSA milestone
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
      </div>
    </div>
  )
}
