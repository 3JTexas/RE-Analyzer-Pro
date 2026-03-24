import React from 'react'

// ── Input field ───────────────────────────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  badge?: string
  badgeColor?: 'blue' | 'amber'
  tooltip?: string
  dollar?: boolean
}

function commaFmt(v: number | string): string {
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (isNaN(n) || n === 0) return '0'
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

function stripCommas(s: string): string {
  return s.replace(/,/g, '')
}

export function InputField({ label, badge, badgeColor = 'blue', tooltip, dollar, className, onFocus, onBlur, onChange, value, type, ...props }: InputProps) {
  const isNumber = type === 'number' && !dollar
  const [editing, setEditing] = React.useState(false)
  const [rawText, setRawText] = React.useState('')

  const inputType = dollar ? 'text' : type
  const displayValue = dollar
    ? (editing ? rawText : commaFmt(value as number | string))
    : value

  return (
    <div className="relative bg-gray-50 rounded-lg p-2.5">
      {badge && (
        <span className={`absolute top-1.5 right-2 text-[9px] font-medium px-1.5 py-0.5 rounded-full
          ${badgeColor === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
          {badge}
        </span>
      )}
      <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
        {label}
        {tooltip && (
          <span className="relative group">
            <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-gray-200 text-[9px] text-gray-500 cursor-help font-semibold leading-none">i</span>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-56 px-2.5 py-2 text-[10px] leading-snug text-white bg-gray-800 rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
              {tooltip}
            </span>
          </span>
        )}
      </label>
      <input
        {...props}
        type={inputType}
        inputMode={dollar ? 'decimal' : props.inputMode}
        value={displayValue}
        onFocus={e => {
          if (dollar) {
            const num = stripCommas(e.target.value)
            setRawText(num === '0' ? '' : num)
            setEditing(true)
            setTimeout(() => e.target.select(), 0)
          } else if (isNumber) {
            e.target.select()
          }
          onFocus?.(e)
        }}
        onBlur={e => {
          if (dollar) {
            setEditing(false)
            const num = parseFloat(stripCommas(e.target.value)) || 0
            if (onChange) {
              const synth = { ...e, target: { ...e.target, value: String(num) } } as React.ChangeEvent<HTMLInputElement>
              onChange(synth)
            }
          } else if (isNumber && e.target.value === '') {
            const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
            nativeSet.call(e.target, '0')
            e.target.dispatchEvent(new Event('input', { bubbles: true }))
          }
          onBlur?.(e)
        }}
        onChange={e => {
          if (dollar) {
            const cleaned = e.target.value.replace(/[^0-9.\-]/g, '')
            setRawText(cleaned)
            if (onChange) {
              const num = parseFloat(cleaned) || 0
              const synth = { ...e, target: { ...e.target, value: String(num) } } as React.ChangeEvent<HTMLInputElement>
              onChange(synth)
            }
          } else {
            if (isNumber) {
              const raw = e.target.value
              const cleaned = raw.replace(/^0+(\d)/, '$1')
              if (cleaned !== raw) e.target.value = cleaned
            }
            onChange?.(e)
          }
        }}
        className={`w-full text-sm font-medium text-gray-900 bg-white border border-gray-200
          rounded-md px-2 py-1 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 ${className ?? ''}`}
      />
    </div>
  )
}

// ── Section header ────────────────────────────────────────────────────────
export function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mt-4 mb-2 pb-1 border-b border-gray-200">
      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{title}</span>
      {children}
    </div>
  )
}

// ── Badge ─────────────────────────────────────────────────────────────────
export function Badge({ label, color }: { label: string; color: 'blue' | 'amber' | 'green' | 'red' }) {
  const cls = {
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
  }[color]
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ml-2 ${cls}`}>{label}</span>
}

// ── Metric card ───────────────────────────────────────────────────────────
export function MetricCard({ label, value, sub, valueColor }:
  { label: string; value: string; sub?: string; valueColor?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="text-[10px] text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-semibold ${valueColor ?? 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

// ── P&L row ───────────────────────────────────────────────────────────────
export function PLRow({ label, value, variant = 'normal', indent = false }:
  { label: string; value: string; variant?: 'normal'|'neg'|'pos'|'total'|'noi'|'cf'; indent?: boolean }) {
  const valueColor = {
    normal: 'text-gray-900',
    neg: 'text-red-700',
    pos: 'text-green-700',
    total: 'text-gray-900',
    noi: 'text-blue-700',
    cf: 'text-gray-900',
  }[variant]
  const isBold = ['total', 'noi', 'cf'].includes(variant)
  const rowBg = variant === 'total' ? 'bg-blue-50 border-t border-b border-blue-200 mt-1' :
                variant === 'noi'   ? 'bg-green-50 border-t border-b border-blue-200 mt-1' : ''
  return (
    <div className={`flex justify-between items-center py-1 text-xs border-b border-gray-100 last:border-0 ${rowBg}`}>
      <span className={`flex-1 ${indent ? 'pl-4 text-gray-500' : ''} ${isBold ? 'font-semibold' : ''}`}>{label}</span>
      <span className={`font-medium ${valueColor} ${isBold ? 'font-semibold' : ''}`}>{value}</span>
    </div>
  )
}

// ── Alert banner ──────────────────────────────────────────────────────────
export function Alert({ type, children }: { type: 'red'|'yellow'|'green'; children: React.ReactNode }) {
  const cls = {
    red:    'bg-red-50 text-red-800 border-red-200',
    yellow: 'bg-amber-50 text-amber-800 border-amber-200',
    green:  'bg-green-50 text-green-800 border-green-200',
  }[type]
  return (
    <div className={`border rounded-lg px-3 py-2 text-xs font-medium leading-relaxed ${cls}`}>
      {children}
    </div>
  )
}

// ── Toggle ────────────────────────────────────────────────────────────────
export function Toggle<T extends string>({
  value, onChange, options
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string; sub: string }[] }) {
  return (
    <div className="flex border border-gray-200 rounded-lg overflow-hidden">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-4 py-2 text-xs font-semibold text-center leading-tight transition-colors
            ${value === opt.value
              ? opt.value === 'om'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-amber-100 text-amber-800'
              : 'text-gray-500 hover:bg-gray-50'
            }`}
        >
          {opt.label}<br />
          <span className="font-normal">{opt.sub}</span>
        </button>
      ))}
    </div>
  )
}

// ── DCR bar ───────────────────────────────────────────────────────────────
export function DCRBar({ dcr }: { dcr: number }) {
  const pct = Math.min((dcr / 2) * 100, 100)
  const markerPct = (1.2 / 2) * 100
  const color = dcr < 1 ? 'bg-red-500' : dcr < 1.2 ? 'bg-amber-500' : 'bg-green-600'
  return (
    <div>
      <div className="relative h-2.5 bg-gray-100 rounded-full mt-1 mb-1">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
        <div className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-red-400 rounded"
          style={{ left: `${markerPct}%` }} />
      </div>
      <div className="flex justify-between text-[9px] text-gray-400">
        <span>0×</span><span>1.20× min</span><span>2.0×</span>
      </div>
    </div>
  )
}

// ── Loading spinner ───────────────────────────────────────────────────────
export function Spinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────
export function EmptyState({ icon, title, description, action }:
  { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-gray-300 mb-4">{icon}</div>
      <h3 className="text-base font-semibold text-gray-700 mb-1">{title}</h3>
      <p className="text-sm text-gray-400 mb-6">{description}</p>
      {action}
    </div>
  )
}
