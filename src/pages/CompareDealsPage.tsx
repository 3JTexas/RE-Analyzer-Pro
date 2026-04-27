import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useProperties } from '../hooks/useScenario'
import { calculate, fmtDollar, fmtDelta } from '../lib/calc'
import { Spinner } from '../components/ui'
import {
  COL_STYLES, COL_LABELS, ROW_SPECS, fmtVal, fmtDeltaVal,
} from '../components/model/compareShared'
import type { Property, Scenario, ModelInputs } from '../types'

interface ColSel { propertyId: string; scenarioId: string }

const MAX_COLS = 6

interface ResolvedCol {
  i: number
  property: Property
  scenario: Scenario
  inputs: ModelInputs
  style: typeof COL_STYLES[number]
  data: ReturnType<typeof calculate>
}

export function CompareDealsPage() {
  const { properties, loading } = useProperties()
  const [cols, setCols] = useState<ColSel[]>([])

  const propsWithScenarios = useMemo(
    () => properties.filter(p => (p.scenarios?.length ?? 0) > 0),
    [properties]
  )

  // Default to first 2 properties' default scenarios on first load
  useEffect(() => {
    if (loading || cols.length > 0) return
    if (propsWithScenarios.length === 0) return
    const init: ColSel[] = propsWithScenarios.slice(0, 2).map(p => {
      const def = p.scenarios!.find(s => s.is_default) ?? p.scenarios![0]
      return { propertyId: p.id, scenarioId: def.id }
    })
    setCols(init)
  }, [loading, propsWithScenarios, cols.length])

  const propsById = useMemo(
    () => new Map(properties.map(p => [p.id, p])),
    [properties]
  )

  const allCols: ResolvedCol[] = useMemo(() => {
    const out: ResolvedCol[] = []
    cols.forEach((col, i) => {
      const property = propsById.get(col.propertyId)
      const scenario = property?.scenarios?.find(s => s.id === col.scenarioId)
      if (!property || !scenario || !scenario.inputs) return
      // Ensure inputs reflect property-level source-of-truth fields before calc.
      const inputs: ModelInputs = {
        ...scenario.inputs,
        propertyType: property.property_type ?? scenario.inputs.propertyType ?? 'multifamily',
      }
      const useStabilized = !(inputs.ou > 0 && inputs.ou < inputs.tu) || !!scenario.is_default
      out.push({
        i,
        property,
        scenario,
        inputs,
        style: COL_STYLES[i] ?? COL_STYLES[COL_STYLES.length - 1],
        data: calculate(inputs, useStabilized),
      })
    })
    return out
  }, [cols, propsById])

  if (loading) return <Spinner />

  const setColProperty = (i: number, propertyId: string) => {
    setCols(cs => cs.map((c, ci) => {
      if (ci !== i) return c
      const newProp = propsById.get(propertyId)
      const def = newProp?.scenarios?.find(s => s.is_default) ?? newProp?.scenarios?.[0]
      return { propertyId, scenarioId: def?.id ?? '' }
    }))
  }

  const setColScenario = (i: number, scenarioId: string) => {
    setCols(cs => cs.map((c, ci) => ci === i ? { ...c, scenarioId } : c))
  }

  const addCol = () => {
    if (cols.length >= MAX_COLS) return
    if (propsWithScenarios.length === 0) return
    const used = new Set(cols.map(c => c.propertyId))
    const nextProp = propsWithScenarios.find(p => !used.has(p.id)) ?? propsWithScenarios[0]
    const def = nextProp.scenarios!.find(s => s.is_default) ?? nextProp.scenarios![0]
    setCols(cs => [...cs, { propertyId: nextProp.id, scenarioId: def.id }])
  }

  const removeCol = (i: number) => {
    setCols(cs => cs.filter((_, ci) => ci !== i))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sub-header */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white border-b border-gray-200 flex-shrink-0">
        <Link to="/" className="flex items-center gap-0.5 -ml-1 text-gray-400 hover:text-[#1a1a2e] transition-colors">
          <ChevronLeft size={20} />
          <span className="text-xs">Properties</span>
        </Link>
        <span className="text-xs font-medium text-gray-500 ml-2">Compare Deals</span>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Compare Deals</h1>
          <p className="text-xs text-gray-500 mb-5">
            Side-by-side comparison of any scenarios across properties. Column A is the baseline; deltas
            are shown vs A. Add up to {MAX_COLS} columns.
          </p>

          {propsWithScenarios.length === 0 ? (
            <div className="border border-dashed border-gray-200 rounded-lg p-10 text-center text-sm text-gray-400 bg-white">
              You need at least one property with a saved scenario to compare.
              <div className="mt-3">
                <Link to="/" className="text-xs font-medium text-[#c9a84c] hover:underline">
                  Go to Properties →
                </Link>
              </div>
            </div>
          ) : allCols.length === 0 ? (
            <div className="border border-dashed border-gray-200 rounded-lg p-10 text-center text-sm text-gray-400 bg-white">
              Loading…
            </div>
          ) : (
            <div className="rounded-lg border border-gray-100 overflow-hidden mb-3 bg-white">
              <div className="overflow-x-auto">
                <table className="text-xs" style={{ minWidth: `${260 + allCols.length * 180}px`, width: '100%' }}>
                  <thead className="bg-[#1a1a2e]">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-white">Line item</th>
                      {allCols.map((col, i) => (
                        <th key={i} className="px-2 py-2 min-w-[170px] align-top">
                          <div className="flex items-start gap-0.5">
                            <div className="flex-1 flex flex-col gap-1">
                              <select
                                value={col.property.id}
                                onChange={e => setColProperty(i, e.target.value)}
                                className={`text-[10px] font-semibold rounded px-1 py-1
                                  ${col.style.hdrBg} ${col.style.hdrText} ${col.style.border}
                                  border focus:outline-none cursor-pointer w-full`}
                              >
                                {propsWithScenarios.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                              <select
                                value={col.scenario.id}
                                onChange={e => setColScenario(i, e.target.value)}
                                className={`text-[10px] rounded px-1 py-1
                                  ${col.style.hdrBg} ${col.style.hdrText} ${col.style.border}
                                  border focus:outline-none cursor-pointer w-full`}
                              >
                                {col.property.scenarios?.map(s => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}{s.is_default ? ' ★' : ''}
                                  </option>
                                ))}
                              </select>
                            </div>
                            {cols.length > 1 && (
                              <button
                                onClick={() => removeCol(i)}
                                className="text-gray-400 hover:text-red-300 ml-0.5 text-sm leading-none flex-shrink-0"
                                title="Remove column"
                              >×</button>
                            )}
                          </div>
                          <div className={`text-[9px] text-center mt-1 ${col.style.hdrText} opacity-70`}>
                            {COL_LABELS[i]}{i > 0 ? ' — vs A' : ' (baseline)'}
                          </div>
                        </th>
                      ))}
                      <th className="px-2 py-2 text-right align-top">
                        {cols.length < MAX_COLS && (
                          <button
                            onClick={addCol}
                            className="text-[10px] bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded font-medium whitespace-nowrap"
                          >+ Add</button>
                        )}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Purchase Price headline row */}
                    {(() => {
                      const prices = allCols.map(c => c.inputs.price)
                      const basePrice = prices[0]
                      return (
                        <tr className="border-b-2 border-blue-200 bg-blue-50">
                          <td className="px-3 py-2 font-semibold text-gray-900">Purchase Price</td>
                          {allCols.map((col, ci) => (
                            <td key={ci} className={`px-3 py-2 text-right font-bold text-sm ${col.style.val}`}>
                              {fmtDollar(prices[ci])}
                            </td>
                          ))}
                          <td className="px-3 py-2 text-right">
                            {allCols.slice(1).map((_, ci) => {
                              const delta = prices[ci + 1] - basePrice
                              return (
                                <div key={ci} className={`font-medium text-[10px] ${delta > 0 ? 'text-red-600' : delta < 0 ? 'text-green-700' : 'text-gray-400'}`}>
                                  {allCols.length > 2 && <span className="opacity-50 mr-0.5">{COL_LABELS[ci + 1]}:</span>}
                                  {fmtDelta(delta)}
                                </div>
                              )
                            })}
                          </td>
                        </tr>
                      )
                    })()}
                    {/* Property type row */}
                    <tr className="bg-white">
                      <td className="px-3 py-1.5 text-gray-600">Type</td>
                      {allCols.map((col, ci) => (
                        <td key={ci} className={`px-3 py-1.5 text-right font-medium text-[10px] uppercase tracking-wide ${col.style.val}`}>
                          {(col.property.property_type ?? 'multifamily') === 'nnn' ? 'NNN' : 'Multifamily'}
                        </td>
                      ))}
                      <td />
                    </tr>
                    {/* Units row (MF only — NNN shows —) */}
                    {(() => {
                      const baseIsMF = (allCols[0].property.property_type ?? 'multifamily') !== 'nnn'
                      const baseUnits = baseIsMF ? allCols[0].inputs.tu : 0
                      return (
                        <tr className="bg-gray-50">
                          <td className="px-3 py-1.5 text-gray-600">Total units</td>
                          {allCols.map((col, ci) => {
                            const isMF = (col.property.property_type ?? 'multifamily') !== 'nnn'
                            return (
                              <td key={ci} className={`px-3 py-1.5 text-right font-medium ${col.style.val}`}>
                                {isMF ? col.inputs.tu : '—'}
                              </td>
                            )
                          })}
                          <td className="px-3 py-1.5 text-right">
                            {allCols.slice(1).map((col, ci) => {
                              const isMF = (col.property.property_type ?? 'multifamily') !== 'nnn'
                              if (!isMF || !baseIsMF) {
                                return <div key={ci} className="font-medium text-[10px] text-gray-300">—</div>
                              }
                              const delta = col.inputs.tu - baseUnits
                              const dColor = delta > 0 ? 'text-green-700' : delta < 0 ? 'text-red-600' : 'text-gray-400'
                              return (
                                <div key={ci} className={`font-medium text-[10px] ${dColor}`}>
                                  {allCols.length > 2 && <span className="opacity-50 mr-0.5">{COL_LABELS[ci + 1]}:</span>}
                                  {delta > 0 ? '+' : ''}{delta}
                                </div>
                              )
                            })}
                          </td>
                        </tr>
                      )
                    })()}
                    {/* Building SF row (NNN only — MF shows —) */}
                    {(() => {
                      const anyNNN = allCols.some(c => (c.property.property_type ?? 'multifamily') === 'nnn')
                      if (!anyNNN) return null
                      const baseIsNNN = (allCols[0].property.property_type ?? 'multifamily') === 'nnn'
                      const baseSF = baseIsNNN ? (allCols[0].inputs.buildingSqft ?? 0) : 0
                      return (
                        <tr className="bg-white">
                          <td className="px-3 py-1.5 text-gray-600">Building SF</td>
                          {allCols.map((col, ci) => {
                            const isNNN = (col.property.property_type ?? 'multifamily') === 'nnn'
                            return (
                              <td key={ci} className={`px-3 py-1.5 text-right font-medium ${col.style.val}`}>
                                {isNNN ? (col.inputs.buildingSqft ?? 0).toLocaleString() : '—'}
                              </td>
                            )
                          })}
                          <td className="px-3 py-1.5 text-right">
                            {allCols.slice(1).map((col, ci) => {
                              const isNNN = (col.property.property_type ?? 'multifamily') === 'nnn'
                              if (!isNNN || !baseIsNNN) {
                                return <div key={ci} className="font-medium text-[10px] text-gray-300">—</div>
                              }
                              const delta = (col.inputs.buildingSqft ?? 0) - baseSF
                              const dColor = delta > 0 ? 'text-green-700' : delta < 0 ? 'text-red-600' : 'text-gray-400'
                              return (
                                <div key={ci} className={`font-medium text-[10px] ${dColor}`}>
                                  {allCols.length > 2 && <span className="opacity-50 mr-0.5">{COL_LABELS[ci + 1]}:</span>}
                                  {delta > 0 ? '+' : ''}{delta.toLocaleString()}
                                </div>
                              )
                            })}
                          </td>
                        </tr>
                      )
                    })()}
                    {/* Price / unit OR Price / SF row (per type) */}
                    {(() => {
                      const baseType = allCols[0].property.property_type ?? 'multifamily'
                      const baseValue = (() => {
                        if (baseType === 'nnn') {
                          const sf = allCols[0].inputs.buildingSqft ?? 0
                          return sf > 0 ? allCols[0].inputs.price / sf : 0
                        }
                        return allCols[0].inputs.tu > 0 ? allCols[0].inputs.price / allCols[0].inputs.tu : 0
                      })()
                      return (
                        <tr className="bg-gray-50">
                          <td className="px-3 py-1.5 text-gray-600">
                            {baseType === 'nnn' ? 'Price / SF' : 'Price / door'}
                          </td>
                          {allCols.map((col, ci) => {
                            const t = col.property.property_type ?? 'multifamily'
                            const v = t === 'nnn'
                              ? ((col.inputs.buildingSqft ?? 0) > 0 ? col.inputs.price / (col.inputs.buildingSqft ?? 1) : 0)
                              : (col.inputs.tu > 0 ? col.inputs.price / col.inputs.tu : 0)
                            // Show, but suffix the unit so cross-type compares are visually clear
                            return (
                              <td key={ci} className={`px-3 py-1.5 text-right font-medium ${col.style.val}`}>
                                {v > 0 ? (
                                  <>
                                    {fmtDollar(v)}
                                    <span className="opacity-50 text-[9px] ml-0.5">{t === 'nnn' ? '/SF' : '/door'}</span>
                                  </>
                                ) : '—'}
                              </td>
                            )
                          })}
                          <td className="px-3 py-1.5 text-right">
                            {allCols.slice(1).map((col, ci) => {
                              const t = col.property.property_type ?? 'multifamily'
                              if (t !== baseType) {
                                return <div key={ci} className="font-medium text-[10px] text-gray-300">—</div>
                              }
                              const v = t === 'nnn'
                                ? ((col.inputs.buildingSqft ?? 0) > 0 ? col.inputs.price / (col.inputs.buildingSqft ?? 1) : 0)
                                : (col.inputs.tu > 0 ? col.inputs.price / col.inputs.tu : 0)
                              const delta = v - baseValue
                              const dColor = delta > 0.005 ? 'text-red-600' : delta < -0.005 ? 'text-green-700' : 'text-gray-400'
                              return (
                                <div key={ci} className={`font-medium text-[10px] ${dColor}`}>
                                  {allCols.length > 2 && <span className="opacity-50 mr-0.5">{COL_LABELS[ci + 1]}:</span>}
                                  {fmtDelta(delta)}
                                </div>
                              )
                            })}
                          </td>
                        </tr>
                      )
                    })()}
                    {/* NNN tenant + lease end (only renders if any column is NNN) */}
                    {allCols.some(c => (c.property.property_type ?? 'multifamily') === 'nnn') && (
                      <>
                        <tr className="bg-white">
                          <td className="px-3 py-1.5 text-gray-600">Tenant</td>
                          {allCols.map((col, ci) => {
                            const isNNN = (col.property.property_type ?? 'multifamily') === 'nnn'
                            return (
                              <td key={ci} className={`px-3 py-1.5 text-right font-medium text-[11px] ${col.style.val}`}>
                                {isNNN ? (col.inputs.tenantName || '—') : '—'}
                              </td>
                            )
                          })}
                          <td />
                        </tr>
                        <tr className="bg-gray-50">
                          <td className="px-3 py-1.5 text-gray-600">Lease end</td>
                          {allCols.map((col, ci) => {
                            const isNNN = (col.property.property_type ?? 'multifamily') === 'nnn'
                            return (
                              <td key={ci} className={`px-3 py-1.5 text-right font-medium text-[11px] ${col.style.val}`}>
                                {isNNN ? (col.inputs.leaseEnd || '—') : '—'}
                              </td>
                            )
                          })}
                          <td />
                        </tr>
                      </>
                    )}
                    {/* Standard P&L / return rows */}
                    {ROW_SPECS.map((spec, ri) => {
                      const vals = allCols.map(c => spec.get(c.data))
                      const baseVal = vals[0]
                      return (
                        <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className={`px-3 py-1.5
                            ${spec.indent ? 'pl-6 text-gray-400' : spec.bold ? 'font-semibold text-gray-900' : 'text-gray-600'}`}>
                            {spec.label.trim()}
                          </td>
                          {allCols.map((col, ci) => (
                            <td key={ci} className={`px-3 py-1.5 text-right font-medium ${col.style.val}`}>
                              {fmtVal(vals[ci], spec)}
                            </td>
                          ))}
                          <td className="px-3 py-1.5 text-right">
                            {allCols.slice(1).map((_, ci) => {
                              const delta = spec.noD ? 0 : vals[ci + 1] - baseVal
                              const dStr = fmtDeltaVal(delta, spec)
                              const dColor = spec.noD ? 'text-gray-300'
                                : delta > 0.005 ? 'text-green-700'
                                : delta < -0.005 ? 'text-red-600'
                                : 'text-gray-400'
                              return (
                                <div key={ci} className={`font-medium text-[10px] ${dColor}`}>
                                  {allCols.length > 2 && <span className="opacity-50 mr-0.5">{COL_LABELS[ci + 1]}:</span>}
                                  {dStr}
                                </div>
                              )
                            })}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {allCols.length > 0 && (
            <p className="text-[10px] text-gray-400 mt-3">
              ★ = primary scenario for that property. Stabilized model is used for default scenarios
              and any scenario that isn't a partial-vacancy lease-up.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
