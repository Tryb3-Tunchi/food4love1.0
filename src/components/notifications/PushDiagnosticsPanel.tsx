'use client'

import { CheckCircle2, Circle, CircleHelp, XCircle } from 'lucide-react'
import {
  type PushDiagnosticInput,
  type StageState,
  pushDiagnostics,
} from '@/lib/push/diagnostics'

const ICON: Record<StageState, typeof Circle> = {
  ok: CheckCircle2,
  fail: XCircle,
  waiting: Circle,
  unknown: CircleHelp,
}
const TONE: Record<StageState, string> = {
  ok: 'text-[var(--success)]',
  fail: 'text-[#d64545]',
  waiting: 'text-[var(--text-3)]',
  unknown: 'text-[var(--text-3)]',
}

// "Check this device": each link of the push chain, proven separately. The bell in the app is
// never used as evidence that this device received or displayed a notification.
export function PushDiagnosticsPanel({
  input,
  onRefresh,
}: {
  input: PushDiagnosticInput
  onRefresh: () => void
}) {
  const stages = pushDiagnostics(input)
  return (
    <details className="border-t border-[var(--border)] px-5 py-4">
      <summary className="cursor-pointer text-sm font-semibold text-[var(--text-1)]">
        Check this device
      </summary>
      <p className="mt-2 text-xs text-[var(--text-3)]">
        Each step must be ticked for notifications to reach this device when
        Food4Love is closed. Notifications in the app&apos;s bell do not prove
        that this device received one.
      </p>
      <ol className="mt-3 space-y-2.5">
        {stages.map((stage) => {
          const Icon = ICON[stage.state]
          return (
            <li key={stage.key} className="flex gap-2.5">
              <Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${TONE[stage.state]}`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[var(--text-1)]">
                  {stage.label}
                  <span className="sr-only">: {stage.state}</span>
                </p>
                <p className="text-xs leading-5 text-[var(--text-3)]">
                  {stage.detail}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
      <button
        type="button"
        onClick={onRefresh}
        className="mt-3 rounded-lg px-2.5 py-2 text-xs font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
      >
        Check again
      </button>
    </details>
  )
}
