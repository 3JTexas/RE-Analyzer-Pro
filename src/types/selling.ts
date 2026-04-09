export type SellingStatus = 'listed' | 'under_contract' | 'closed'

export interface SellingProperty {
  id: string
  user_id: string
  name: string
  address: string | null
  sale_price: number
  selling_costs_pct: number
  mortgage_payoff: number
  original_purchase_price: number
  capital_improvements: number
  depreciation_taken: number
  cg_rate: number
  recapture_rate: number
  status: SellingStatus
  closing_date: string | null
  listing_date: string | null
  contract_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Exchange1031Link {
  id: string
  selling_property_id: string
  buying_property_id: string
  user_id: string
  allocated_amount: number
  notes: string | null
  created_at: string
  // Joined data
  selling_property?: SellingProperty
  buying_property?: { id: string; name: string; address: string }
}

// Computed sale analysis
export interface SaleAnalysis {
  sellingCosts: number
  netProceeds: number
  adjustedBasis: number
  capitalGain: number
  recaptureTax: number
  capGainsTax: number
  totalTaxDeferred: number
}

export function computeSaleAnalysis(sp: SellingProperty): SaleAnalysis {
  const sellingCosts = sp.sale_price * (sp.selling_costs_pct / 100)
  const adjustedBasis = sp.original_purchase_price + sp.capital_improvements - sp.depreciation_taken
  const capitalGain = Math.max(0, sp.sale_price - sellingCosts - adjustedBasis)
  const recaptureTax = sp.depreciation_taken * (sp.recapture_rate / 100)
  const capGainsTax = capitalGain * (sp.cg_rate / 100)
  const totalTaxDeferred = capGainsTax + recaptureTax
  const netProceeds = sp.sale_price - sellingCosts - sp.mortgage_payoff

  return { sellingCosts, netProceeds, adjustedBasis, capitalGain, recaptureTax, capGainsTax, totalTaxDeferred }
}
