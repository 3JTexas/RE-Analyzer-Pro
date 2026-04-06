import { useState } from 'react'
import { Plus, Trash2, DollarSign } from 'lucide-react'
import { useDealExpenses } from '../../hooks/usePipeline'
import type { ExpenseBudgets, ExpenseCategory, DealExpense } from '../../types/pipeline'
import { EXPENSE_CATEGORIES } from '../../types/pipeline'

interface Props {
  pipelineId: string
  expenseBudgets: ExpenseBudgets
  onBudgetUpdate: (budgets: ExpenseBudgets) => void
}

export function ExpensesSection({ pipelineId, expenseBudgets, onBudgetUpdate }: Props) {
  const { expenses, addExpense, deleteExpense } = useDealExpenses(pipelineId)
  const [showAdd, setShowAdd] = useState(false)
  const [draft, setDraft] = useState({
    category: 'other' as ExpenseCategory,
    amount: '',
    vendor: '',
    description: '',
    expense_date: '',
  })

  const setBudget = (category: string, budget: number) => {
    onBudgetUpdate({ ...expenseBudgets, [category]: { budget } })
  }

  const getBudget = (category: string): number =>
    expenseBudgets[category]?.budget ?? 0

  const getActual = (category: string): number =>
    expenses.filter(e => e.category === category).reduce((s, e) => s + Number(e.amount), 0)

  const totalBudget = EXPENSE_CATEGORIES.reduce((s, c) => s + getBudget(c.id), 0)
  const totalActual = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalVariance = totalBudget - totalActual

  const handleAdd = async () => {
    if (!draft.amount) return
    await addExpense({
      category: draft.category,
      amount: parseFloat(draft.amount) || 0,
      vendor: draft.vendor.trim() || null,
      description: draft.description.trim() || null,
      expense_date: draft.expense_date || null,
    })
    setDraft({ category: 'other', amount: '', vendor: '', description: '', expense_date: '' })
    setShowAdd(false)
  }

  const fmtD = (n: number) => `$${Math.round(n).toLocaleString()}`

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[10px] text-gray-500 mb-1">Total Budget</div>
          <div className="text-xl font-semibold text-gray-900">{fmtD(totalBudget)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-[10px] text-gray-500 mb-1">Total Spent</div>
          <div className={`text-xl font-semibold ${totalActual > totalBudget ? 'text-red-600' : 'text-gray-900'}`}>{fmtD(totalActual)}</div>
        </div>
        <div className={`border rounded-lg p-4 ${totalVariance >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="text-[10px] text-gray-500 mb-1">Remaining</div>
          <div className={`text-xl font-semibold ${totalVariance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {totalVariance >= 0 ? fmtD(totalVariance) : `(${fmtD(Math.abs(totalVariance))})`}
          </div>
        </div>
      </div>

      {/* Budget vs Actual table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-4">
        <div className="bg-[#1a1a2e] px-4 py-2.5">
          <h3 className="text-xs font-semibold text-white">Budget vs Actual by Category</h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="text-left px-4 py-2 font-semibold text-gray-600">Category</th>
              <th className="text-right px-4 py-2 font-semibold text-gray-600 w-32">Budget</th>
              <th className="text-right px-4 py-2 font-semibold text-gray-600 w-28">Actual</th>
              <th className="text-right px-4 py-2 font-semibold text-gray-600 w-28">Variance</th>
              <th className="px-4 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {EXPENSE_CATEGORIES.map((cat, i) => {
              const budget = getBudget(cat.id)
              const actual = getActual(cat.id)
              const variance = budget - actual
              const overBudget = budget > 0 && actual > budget
              const pct = budget > 0 ? Math.min((actual / budget) * 100, 100) : 0

              return (
                <tr key={cat.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{cat.label}</td>
                  <td className="px-4 py-2.5 text-right">
                    <input
                      type="number"
                      value={budget || ''}
                      onChange={e => setBudget(cat.id, parseFloat(e.target.value) || 0)}
                      placeholder="—"
                      className="w-full text-xs text-right border border-transparent hover:border-gray-200 focus:border-[#c9a84c] rounded px-2 py-1 focus:outline-none bg-transparent"
                    />
                  </td>
                  <td className={`px-4 py-2.5 text-right font-medium ${overBudget ? 'text-red-600' : 'text-gray-700'}`}>
                    {actual > 0 ? fmtD(actual) : '—'}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-medium ${budget === 0 ? 'text-gray-300' : variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {budget === 0 ? '—' : variance >= 0 ? fmtD(variance) : `(${fmtD(Math.abs(variance))})`}
                  </td>
                  <td className="px-4 py-2.5">
                    {budget > 0 && (
                      <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${overBudget ? 'bg-red-500' : 'bg-green-500'}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
              <td className="px-4 py-2.5 text-gray-900">Total</td>
              <td className="px-4 py-2.5 text-right text-gray-900">{fmtD(totalBudget)}</td>
              <td className="px-4 py-2.5 text-right text-gray-900">{fmtD(totalActual)}</td>
              <td className={`px-4 py-2.5 text-right ${totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalVariance >= 0 ? fmtD(totalVariance) : `(${fmtD(Math.abs(totalVariance))})`}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Expense log */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
          <h3 className="text-xs font-semibold text-gray-700">Expense Log</h3>
          <button onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 text-[10px] font-semibold text-[#c9a84c] hover:text-[#b8963f] transition-colors">
            <Plus size={12} /> Add Expense
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="px-4 py-3 border-b border-gray-200 bg-amber-50/50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
              <select value={draft.category} onChange={e => setDraft(d => ({ ...d, category: e.target.value as ExpenseCategory }))}
                className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white">
                {EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              <input type="number" value={draft.amount} onChange={e => setDraft(d => ({ ...d, amount: e.target.value }))}
                placeholder="Amount ($)" className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white" />
              <input value={draft.vendor} onChange={e => setDraft(d => ({ ...d, vendor: e.target.value }))}
                placeholder="Vendor" className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white" />
              <input type="date" value={draft.expense_date} onChange={e => setDraft(d => ({ ...d, expense_date: e.target.value }))}
                className="text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white" />
            </div>
            <div className="flex gap-2">
              <input value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))}
                placeholder="Description (optional)" className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#c9a84c] bg-white" />
              <button onClick={handleAdd} disabled={!draft.amount}
                className="px-4 py-2 text-xs font-semibold bg-[#1a1a2e] text-white rounded-lg hover:bg-[#c9a84c] hover:text-[#1a1a2e] transition-colors disabled:opacity-40">
                Add
              </button>
              <button onClick={() => setShowAdd(false)}
                className="px-4 py-2 text-xs font-medium bg-white border border-gray-200 text-gray-500 rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Expense rows */}
        {expenses.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <DollarSign size={24} className="text-gray-200 mx-auto mb-2" />
            <p className="text-xs text-gray-400">No expenses logged yet</p>
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Date</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Category</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Description</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Vendor</th>
                <th className="text-right px-4 py-2 font-semibold text-gray-600">Amount</th>
                <th className="px-2 py-2 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((exp, i) => {
                const catLabel = EXPENSE_CATEGORIES.find(c => c.id === exp.category)?.label ?? exp.category
                return (
                  <tr key={exp.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-2 text-gray-500">
                      {exp.expense_date ? new Date(exp.expense_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-2 text-gray-700">{catLabel}</td>
                    <td className="px-4 py-2 text-gray-500">{exp.description || '—'}</td>
                    <td className="px-4 py-2 text-gray-500">{exp.vendor || '—'}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">{fmtD(Number(exp.amount))}</td>
                    <td className="px-2 py-2">
                      <button onClick={() => { if (window.confirm('Delete?')) deleteExpense(exp.id) }}
                        className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
