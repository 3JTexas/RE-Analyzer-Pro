import { ModelCalculator } from '../components/model/ModelCalculator'

export function DemoPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 bg-amber-50 border-b border-amber-100">
        <p className="text-[10px] text-amber-700 text-center">
          Quick model — not saved. Sign in to save scenarios.
        </p>
      </div>
      <div className="flex-1 overflow-hidden">
        <ModelCalculator scenarioName="Quick analysis" />
      </div>
    </div>
  )
}
