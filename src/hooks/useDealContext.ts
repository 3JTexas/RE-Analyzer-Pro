import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { calculate } from '../lib/calc'
import type { ModelInputs, ModelOutputs, Scenario } from '../types'

export interface DealContext {
  currentView: string // e.g. 'scenario', 'property', 'pipeline', 'properties', 'demo'
  property: {
    name: string
    address: string | null
    units: number | null
    yearBuilt: number | null
    status: string
  } | null
  scenario: {
    name: string
    inputs: ModelInputs
  } | null
  outputs: ModelOutputs | null
  dealTerms: {
    actualInputs: Record<string, any>
    capx: number | null
    actualCapx: number | null
    rentGrowth: number
    expGrowth: number
    year1CF: number | null       // after capx
    fiveYearProjection: {
      year: number
      GSR: number
      EGI: number
      NOI: number
      CF: number
      afterTaxCF: number
    }[]
  } | null
  pipeline: {
    milestones: any[]
    keyDates: any
    loiTracking: any
    psaTracking: any
    repairEstimates: any[]
    expenseBudgets: any
  } | null
}

/** Reads deal data from the current route for the chat assistant */
export function useDealContext(): { dealContext: DealContext | null; loading: boolean } {
  const location = useLocation()
  const [dealContext, setDealContext] = useState<DealContext | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const path = location.pathname

    const scenarioMatch = path.match(/^\/scenario\/([^/]+)/)
    const pipelineMatch = path.match(/^\/property\/([^/]+)\/pipeline/)
    const propertyMatch = path.match(/^\/property\/([^/]+)/)

    if (scenarioMatch) {
      loadFromScenario(scenarioMatch[1])
    } else if (pipelineMatch) {
      loadFromProperty(pipelineMatch[1], 'pipeline')
    } else if (propertyMatch) {
      loadFromProperty(propertyMatch[1], 'property')
    } else {
      setDealContext(null)
    }
  }, [location.pathname])

  function buildFiveYearProjection(baseInputs: ModelInputs, actualInputs: Record<string, any>, y1Outputs: ModelOutputs) {
    const rentGrowth = (actualInputs as any)?._rentGrowth ?? 2
    const expGrowth = (actualInputs as any)?._expGrowth ?? 3
    const useOM = !(baseInputs.ou > 0 && baseInputs.ou < baseInputs.tu)

    const capxAmt = (actualInputs?.capx ?? baseInputs.capx ?? 0) as number

    // Year 1
    const y1CF = y1Outputs.CF - capxAmt
    const projection = [{
      year: 1,
      GSR: y1Outputs.GSR,
      EGI: y1Outputs.EGI,
      NOI: y1Outputs.NOI,
      CF: y1CF,
      afterTaxCF: y1Outputs.at - capxAmt,
    }]

    // Years 2-5
    for (let year = 2; year <= 5; year++) {
      const rg = Math.pow(1 + rentGrowth / 100, year - 1)
      const eg = Math.pow(1 + expGrowth / 100, year - 1)
      const scaled: ModelInputs = {
        ...baseInputs,
        rent: baseInputs.rent * rg,
        rentRoll: baseInputs.rentRoll?.map(u => ({ ...u, rent: (u.rent || 0) * rg })),
        otherIncome: baseInputs.otherIncome?.map(x => ({ ...x, amount: (x.amount || 0) * rg })),
        tax: baseInputs.tax * eg,
        ins: baseInputs.ins * eg,
        rm: baseInputs.rm * eg,
        res: baseInputs.res * eg,
        cs: baseInputs.cs * eg,
        ga: baseInputs.ga * eg,
        util: baseInputs.util * eg,
        utilElec: baseInputs.utilElec * eg,
        utilWater: baseInputs.utilWater * eg,
        utilTrash: baseInputs.utilTrash * eg,
        pmPerUnit: baseInputs.pmPerUnit * eg,
        otherExpenses: baseInputs.otherExpenses?.map(x => ({ ...x, amount: (x.amount || 0) * eg })),
        costSeg: 0,
        closingDate: undefined,
      }
      const out = calculate(scaled, useOM)
      projection.push({
        year,
        GSR: out.GSR,
        EGI: out.EGI,
        NOI: out.NOI,
        CF: out.CF,
        afterTaxCF: out.at,
      })
    }

    return { projection, rentGrowth, expGrowth, capxAmt, y1CF }
  }

  async function loadFromScenario(scenarioId: string) {
    setLoading(true)
    try {
      const { data: scenario } = await supabase
        .from('scenarios').select('*').eq('id', scenarioId).single()
      if (!scenario) { setDealContext(null); return }

      const s = scenario as Scenario

      const { data: prop } = await supabase
        .from('properties').select('name, address, units, year_built, status')
        .eq('id', s.property_id).single()

      // property.units is the source of truth — override any stale scenario.inputs.tu
      if (prop?.units && prop.units > 0 && s.inputs.tu !== prop.units) {
        s.inputs = { ...s.inputs, tu: prop.units }
      }

      const outputs = calculate(s.inputs, s.is_default)

      const { data: pipe } = await supabase
        .from('deal_pipelines')
        .select('milestones, key_dates, loi_tracking, psa_tracking, actual_inputs, repair_estimates, expense_budgets')
        .eq('property_id', s.property_id).single()

      const actualInputs = (pipe?.actual_inputs ?? {}) as Record<string, any>

      // Merge actuals over projected for effective calc
      const effectiveInputs: ModelInputs = {
        ...s.inputs,
        ...Object.fromEntries(
          Object.entries(actualInputs).filter(([_, v]) => v !== undefined && v !== null)
        ),
      }
      const effectiveOutputs = calculate(effectiveInputs, s.is_default)
      const { projection, rentGrowth, expGrowth, capxAmt, y1CF } = buildFiveYearProjection(effectiveInputs, actualInputs, effectiveOutputs)

      setDealContext({
        currentView: 'scenario',
        property: prop ? {
          name: prop.name, address: prop.address, units: prop.units,
          yearBuilt: prop.year_built, status: prop.status,
        } : null,
        scenario: { name: s.name, inputs: s.inputs },
        outputs: effectiveOutputs,
        dealTerms: {
          actualInputs,
          capx: s.inputs.capx ?? null,
          actualCapx: actualInputs.capx ?? null,
          rentGrowth, expGrowth,
          year1CF: y1CF,
          fiveYearProjection: projection,
        },
        pipeline: pipe ? {
          milestones: pipe.milestones ?? [],
          keyDates: pipe.key_dates ?? null,
          loiTracking: pipe.loi_tracking ?? null,
          psaTracking: pipe.psa_tracking ?? null,
          repairEstimates: pipe.repair_estimates ?? [],
          expenseBudgets: pipe.expense_budgets ?? null,
        } : null,
      })
    } catch (e) {
      console.error('useDealContext error:', e)
      setDealContext(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadFromProperty(propertyId: string, view: string) {
    setLoading(true)
    try {
      const { data: prop } = await supabase
        .from('properties').select('name, address, units, year_built, status')
        .eq('id', propertyId).single()
      if (!prop) { setDealContext(null); return }

      // Load deal scenario (prefer deal_scenario_id from pipeline, fall back to default)
      const { data: pipe } = await supabase
        .from('deal_pipelines')
        .select('deal_scenario_id, milestones, key_dates, loi_tracking, psa_tracking, actual_inputs, repair_estimates, expense_budgets')
        .eq('property_id', propertyId).single()

      let s: Scenario | undefined
      if (pipe?.deal_scenario_id) {
        const { data } = await supabase
          .from('scenarios').select('*').eq('id', pipe.deal_scenario_id).single()
        s = data as Scenario | undefined
      }
      if (!s) {
        const { data: scenarios } = await supabase
          .from('scenarios').select('*').eq('property_id', propertyId)
          .order('is_default', { ascending: false })
          .order('created_at', { ascending: true }).limit(1)
        s = scenarios?.[0] as Scenario | undefined
      }

      // property.units is the source of truth — override any stale scenario.inputs.tu
      if (s && prop.units && prop.units > 0 && s.inputs.tu !== prop.units) {
        s.inputs = { ...s.inputs, tu: prop.units }
      }

      const outputs = s ? calculate(s.inputs, s.is_default) : null
      const actualInputs = (pipe?.actual_inputs ?? {}) as Record<string, any>

      let dealTerms: DealContext['dealTerms'] = null
      if (s && outputs) {
        const effectiveInputs: ModelInputs = {
          ...s.inputs,
          ...Object.fromEntries(
            Object.entries(actualInputs).filter(([_, v]) => v !== undefined && v !== null)
          ),
        }
        const effectiveOutputs = calculate(effectiveInputs, s.is_default)
        const { projection, rentGrowth, expGrowth, capxAmt, y1CF } = buildFiveYearProjection(effectiveInputs, actualInputs, effectiveOutputs)
        dealTerms = {
          actualInputs,
          capx: s.inputs.capx ?? null,
          actualCapx: actualInputs.capx ?? null,
          rentGrowth, expGrowth,
          year1CF: y1CF,
          fiveYearProjection: projection,
        }
      }

      setDealContext({
        currentView: view,
        property: {
          name: prop.name, address: prop.address, units: prop.units,
          yearBuilt: prop.year_built, status: prop.status,
        },
        scenario: s ? { name: s.name, inputs: s.inputs } : null,
        outputs,
        dealTerms,
        pipeline: pipe ? {
          milestones: pipe.milestones ?? [],
          keyDates: pipe.key_dates ?? null,
          loiTracking: pipe.loi_tracking ?? null,
          psaTracking: pipe.psa_tracking ?? null,
          repairEstimates: pipe.repair_estimates ?? [],
          expenseBudgets: pipe.expense_budgets ?? null,
        } : null,
      })
    } catch (e) {
      console.error('useDealContext error:', e)
      setDealContext(null)
    } finally {
      setLoading(false)
    }
  }

  return { dealContext, loading }
}
