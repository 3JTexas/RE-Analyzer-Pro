import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { DealPipeline, DealDocument, DealExpense, LOITracking, Milestone, DealTeam, RepairEstimate, ExpenseBudgets, DealDocType } from '../types/pipeline'
import { DEFAULT_LOI_TRACKING, DEFAULT_MILESTONES, derivePropertyStatus } from '../types/pipeline'

// ── Main pipeline hook ───────────────────────────────────────────────────
export function usePipeline(propertyId?: string) {
  const [pipeline, setPipeline] = useState<DealPipeline | null>(null)
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!propertyId) return
    setLoading(true)

    // Try to load existing pipeline
    const { data, error } = await supabase
      .from('deal_pipelines')
      .select('*')
      .eq('property_id', propertyId)
      .single()

    if (data && !error) {
      setPipeline(data as DealPipeline)
      setLoading(false)
      return
    }

    // Auto-create if not found
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: created } = await supabase
      .from('deal_pipelines')
      .insert({
        property_id: propertyId,
        user_id: user.id,
        deal_scenario_id: null,
        loi_tracking: DEFAULT_LOI_TRACKING,
        milestones: DEFAULT_MILESTONES,
        deal_team: {},
        repair_estimates: [],
        expense_budgets: {},
      })
      .select()
      .single()

    if (created) setPipeline(created as DealPipeline)
    setLoading(false)
  }, [propertyId])

  useEffect(() => { fetch() }, [fetch])

  const updateField = async (field: string, value: any) => {
    if (!pipeline) return
    await supabase
      .from('deal_pipelines')
      .update({ [field]: value })
      .eq('id', pipeline.id)
    const updated = { ...pipeline, [field]: value }
    setPipeline(updated)
    // Auto-sync derived status to properties table
    const newStatus = derivePropertyStatus(updated as DealPipeline)
    await supabase.from('properties').update({ status: newStatus }).eq('id', updated.property_id)
  }

  const updateLOITracking = (loi: LOITracking) => updateField('loi_tracking', loi)
  const updateMilestones = (milestones: Milestone[]) => updateField('milestones', milestones)
  const updateDealTeam = (team: DealTeam) => updateField('deal_team', team)
  const updateRepairEstimates = (repairs: RepairEstimate[]) => updateField('repair_estimates', repairs)
  const updateExpenseBudgets = (budgets: ExpenseBudgets) => updateField('expense_budgets', budgets)
  const updateActualInputs = (actuals: Record<string, any>) => updateField('actual_inputs', actuals)
  const updateDealScenarioId = async (scenarioId: string | null) => {
    if (!pipeline) return
    await supabase.from('deal_pipelines').update({ deal_scenario_id: scenarioId }).eq('id', pipeline.id)
    const updated = { ...pipeline, deal_scenario_id: scenarioId }
    setPipeline(updated)
    const newStatus = derivePropertyStatus(updated as DealPipeline)
    await supabase.from('properties').update({ status: newStatus }).eq('id', updated.property_id)
  }

  return {
    pipeline, loading, refresh: fetch,
    updateLOITracking, updateMilestones, updateDealTeam,
    updateRepairEstimates, updateExpenseBudgets, updateActualInputs,
    updateDealScenarioId,
  }
}

// ── Documents hook ───────────────────────────────────────────────────────
export function useDealDocuments(pipelineId?: string) {
  const [documents, setDocuments] = useState<DealDocument[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!pipelineId) return
    setLoading(true)
    const { data } = await supabase
      .from('deal_documents')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .order('uploaded_at', { ascending: false })
    setDocuments((data as DealDocument[]) ?? [])
    setLoading(false)
  }, [pipelineId])

  useEffect(() => { fetch() }, [fetch])

  const uploadDocument = async (file: File, docType: DealDocType) => {
    if (!pipelineId) return null
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const ext = file.name.split('.').pop() ?? 'pdf'
    const path = `${pipelineId}/${crypto.randomUUID()}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from('deal-documents')
      .upload(path, file, { upsert: false })
    if (uploadErr) { console.error('Upload failed:', uploadErr.message); return null }

    const { data: urlData } = supabase.storage.from('deal-documents').getPublicUrl(path)

    const { data: doc } = await supabase
      .from('deal_documents')
      .insert({
        pipeline_id: pipelineId,
        user_id: user.id,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
        doc_type: docType,
      })
      .select()
      .single()

    if (doc) {
      setDocuments(prev => [doc as DealDocument, ...prev])
      return doc as DealDocument
    }
    return null
  }

  const deleteDocument = async (docId: string) => {
    await supabase.from('deal_documents').delete().eq('id', docId)
    setDocuments(prev => prev.filter(d => d.id !== docId))
  }

  const updateExtracted = async (docId: string, extracted: Record<string, any>) => {
    await supabase.from('deal_documents').update({ extracted }).eq('id', docId)
    setDocuments(prev => prev.map(d => d.id === docId ? { ...d, extracted } : d))
  }

  return { documents, loading, uploadDocument, deleteDocument, updateExtracted, refresh: fetch }
}

// ── Expenses hook ────────────────────────────────────────────────────────
export function useDealExpenses(pipelineId?: string) {
  const [expenses, setExpenses] = useState<DealExpense[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!pipelineId) return
    setLoading(true)
    const { data } = await supabase
      .from('deal_expenses')
      .select('*')
      .eq('pipeline_id', pipelineId)
      .order('created_at', { ascending: false })
    setExpenses((data as DealExpense[]) ?? [])
    setLoading(false)
  }, [pipelineId])

  useEffect(() => { fetch() }, [fetch])

  const addExpense = async (expense: Omit<DealExpense, 'id' | 'pipeline_id' | 'user_id' | 'created_at'>) => {
    if (!pipelineId) return null
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data } = await supabase
      .from('deal_expenses')
      .insert({ ...expense, pipeline_id: pipelineId, user_id: user.id })
      .select()
      .single()
    if (data) setExpenses(prev => [data as DealExpense, ...prev])
    return data as DealExpense | null
  }

  const deleteExpense = async (expenseId: string) => {
    await supabase.from('deal_expenses').delete().eq('id', expenseId)
    setExpenses(prev => prev.filter(e => e.id !== expenseId))
  }

  return { expenses, loading, addExpense, deleteExpense, refresh: fetch }
}
