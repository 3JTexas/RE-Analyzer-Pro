// ── Property status ──────────────────────────────────────────────────────
export type PropertyStatus = 'research' | 'pending' | 'active' | 'closed'

// ── LOI tracking (Pending status) ────────────────────────────────────────
export type LOIStatus = 'none' | 'submitted' | 'counter_offer' | 'accepted' | 'rejected'

export type LOIEventType = 'sent' | 'received' | 'counter_offer' | 'revised' | 'accepted' | 'rejected'

// PSA iteration tracking (same pattern as LOI)
export type PSAEventType = 'draft_sent' | 'draft_received' | 'seller_redlines' | 'buyer_redlines' | 'revised_sent' | 'revised_received' | 'executed'

export interface PSAEvent {
  id: string
  type: PSAEventType
  date: string
  notes: string
  documentUrl: string | null
  extractedTerms: Record<string, any> | null
}

export interface PSATracking {
  events: PSAEvent[]
}

export interface LOIEvent {
  id: string
  type: LOIEventType
  date: string
  notes: string
  documentUrl: string | null   // PDF attached to this event
  price: number | null         // offer/counter price at this iteration
  extractedTerms: LOIExtractedTerms | null  // AI-extracted from uploaded PDF
}

export interface LOITracking {
  status: LOIStatus
  events: LOIEvent[]           // chronological history of LOI iterations
  submittedDate: string | null
  counterOfferNotes: string
  responseDate: string | null
  loiDocumentUrl: string | null
  extractedTerms: LOIExtractedTerms | null
}

export interface LOIExtractedTerms {
  purchasePrice: number | null
  earnestDeposit: number | null
  ddPeriodDays: number | null
  closingDays: number | null
  contingencies: string | null
  buyerName: string | null
  sellerName: string | null
  loiDate: string | null
  loanApprovalDays: number | null
  expirationDays: number | null
  ddDeliveryDays: number | null
  financingContingency: boolean | null
  propertyAddress: string | null
  notes: string | null
}

// ── Deal Pipeline (Active status) ────────────────────────────────────────
export type MilestoneStatus = 'pending' | 'in_progress' | 'completed'

export interface Milestone {
  id: string
  name: string
  date: string | null
  status: MilestoneStatus
  notes: string
}

export type DealTeamRole = string  // built-in + custom roles

export const DEAL_TEAM_ROLES: { id: string; label: string }[] = [
  { id: 'attorney', label: 'Attorney' },
  { id: 'inspector', label: 'Inspector' },
  { id: 'property_manager', label: 'Property Manager' },
  { id: 'lender', label: 'Lender' },
  { id: 'title_company', label: 'Title Company' },
  { id: 'broker', label: 'Broker' },
  { id: 'appraiser', label: 'Appraiser' },
  { id: 'insurance_agent', label: 'Insurance Agent' },
]

export interface DealTeamCandidate {
  id: string
  name: string
  company: string
  phone: string
  email: string
  website: string
  address: string
  notes: string
  selected: boolean
}

export interface DealTeam {
  [role: string]: { candidates: DealTeamCandidate[] }
}

// ── Documents ────────────────────────────────────────────────────────────
export type DealDocType = 'loi' | 'psa' | 'inspection_report' | 'contract' | 'other'

export const DOC_TYPE_LABELS: Record<DealDocType, string> = {
  loi: 'LOI',
  psa: 'PSA',
  inspection_report: 'Inspection Report',
  contract: 'Contract',
  other: 'Other',
}

export interface DealDocument {
  id: string
  pipeline_id: string
  user_id: string
  file_name: string
  file_url: string
  file_size: number | null
  doc_type: DealDocType
  extracted: Record<string, any> | null
  uploaded_at: string
}

// ── Expenses ─────────────────────────────────────────────────────────────
export type ExpenseCategory =
  | 'travel' | 'professional_fees' | 'inspections' | 'earnest_money'
  | 'appraisal' | 'legal' | 'title_escrow' | 'lender_fees' | 'other'

export const EXPENSE_CATEGORIES: { id: ExpenseCategory; label: string }[] = [
  { id: 'travel', label: 'Travel' },
  { id: 'professional_fees', label: 'Professional Fees' },
  { id: 'inspections', label: 'Inspections' },
  { id: 'earnest_money', label: 'Earnest Money' },
  { id: 'appraisal', label: 'Appraisal' },
  { id: 'legal', label: 'Legal' },
  { id: 'title_escrow', label: 'Title / Escrow' },
  { id: 'lender_fees', label: 'Lender Fees' },
  { id: 'other', label: 'Other' },
]

export interface ExpenseBudgets {
  [category: string]: { budget: number }
}

export interface DealExpense {
  id: string
  pipeline_id: string
  user_id: string
  category: ExpenseCategory
  amount: number
  vendor: string | null
  description: string | null
  expense_date: string | null
  created_at: string
}

// ── Repairs ──────────────────────────────────────────────────────────────
export type RepairStatus = 'pending' | 'approved' | 'completed'
export type RepairSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface RepairEstimate {
  id: string
  description: string
  severity: RepairSeverity
  contractor: string
  estimatedCost: number
  status: RepairStatus
  fromInspection: boolean
  notes: string
}

// ── Pipeline record ──────────────────────────────────────────────────────
export const DEFAULT_MILESTONES: Milestone[] = [
  { id: 'loi', name: 'LOI', date: null, status: 'pending', notes: '' },
  { id: 'psa', name: 'PSA Executed', date: null, status: 'pending', notes: '' },
  { id: 'inspection', name: 'Inspection Period', date: null, status: 'pending', notes: '' },
  { id: 'financing', name: 'Financing Contingency', date: null, status: 'pending', notes: '' },
  { id: 'appraisal', name: 'Appraisal', date: null, status: 'pending', notes: '' },
  { id: 'closing', name: 'Closing', date: null, status: 'pending', notes: '' },
]

export const DEFAULT_LOI_TRACKING: LOITracking = {
  status: 'none',
  events: [],
  submittedDate: null,
  counterOfferNotes: '',
  responseDate: null,
  loiDocumentUrl: null,
  extractedTerms: null,
}

export interface DealPipeline {
  id: string
  property_id: string
  user_id: string
  deal_scenario_id: string | null  // which scenario represents the offer/deal terms
  loi_tracking: LOITracking
  psa_tracking: PSATracking
  milestones: Milestone[]
  deal_team: DealTeam
  repair_estimates: RepairEstimate[]
  expense_budgets: ExpenseBudgets
  actual_inputs: Partial<import('../types').ModelInputs>  // actual quotes/terms as they come in
  created_at: string
  updated_at: string
}

// ── Status derivation ────────────────────────────────────────────────────
export function derivePropertyStatus(pipeline: DealPipeline | null): PropertyStatus {
  if (!pipeline) return 'research'
  if (!pipeline.deal_scenario_id) return 'research'

  // Check if closing milestone is completed → closed
  const closingMilestone = pipeline.milestones?.find(m => m.id === 'closing')
  if (closingMilestone?.status === 'completed') return 'closed'

  // Check LOI events for accepted → active
  const events = pipeline.loi_tracking?.events ?? []
  const lastEvent = events[events.length - 1]
  if (lastEvent?.type === 'accepted') return 'active'

  // Has LOI events → pending
  if (events.length > 0) return 'pending'

  // Has deal scenario but no LOI activity → pending (just started tracking)
  return 'pending'
}

// ── UI helpers ───────────────────────────────────────────────────────────
export type MiniPipelineTab = 'terms' | 'documents' | 'contacts'
export type FullPipelineTab = 'timeline' | 'documents' | 'team' | 'expenses' | 'repairs'
