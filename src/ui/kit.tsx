import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../core/DataContext.tsx'
import { PAY_LABEL, STATUS_LABEL } from '../core/logic.ts'
import type { PayStatus, VisitStatus } from '../core/types.ts'

const AVATAR_COLORS = ['#0f7c7a', '#c96f12', '#4f46e5', '#059669', '#db2777', '#7c3aed', '#0891b2', '#b45309']
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name.split(/[\s,.]+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase()
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: AVATAR_COLORS[h % AVATAR_COLORS.length] }} aria-hidden="true">{initials}</span>
}

export function PageHeader({ title, sub, children, avatar }: { title: string; sub?: string; children?: ReactNode; avatar?: string }) {
  return (
    <div className="page-head">
      {avatar && <Avatar name={avatar} size={52} />}
      <div className="grow">
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children && <div className="row gap wrap">{children}</div>}
    </div>
  )
}

export function Card({ title, actions, children, pad = true }: { title?: string; actions?: ReactNode; children: ReactNode; pad?: boolean }) {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="card-head">
          <h2>{title}</h2>
          {actions && <div className="row gap">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'card-body' : ''}>{children}</div>
    </section>
  )
}

export function Stat({ label, value, hint, tone, to }: { label: string; value: ReactNode; hint?: string; tone?: 'good' | 'warn' | 'bad'; to?: string }) {
  const body = (
    <>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      {hint && <span className="muted small">{hint}</span>}
    </>
  )
  return to ? <Link to={to} className={`stat ${tone ?? ''}`}>{body}</Link> : <div className={`stat ${tone ?? ''}`}>{body}</div>
}

/** Small "?" bubble that explains a term in plain words on hover/focus. */
export function Tip({ text }: { text: string }) {
  return <button type="button" className="tip" data-tip={text} aria-label={text}>?</button>
}

export function PayBadge({ status }: { status: PayStatus }) {
  return <span className={`badge p-${status}`}>{PAY_LABEL[status]}</span>
}
export function StatusChip({ status }: { status: VisitStatus }) {
  return <span className={`badge v-${status}`}>{STATUS_LABEL[status]}</span>
}

export function SourceTag({ source }: { source: string }) {
  const map: Record<string, string> = { manual: 'Desk entry', 'doctor-tap': 'Doctor tap', 'agent-confirmed': 'AI match, confirmed', online: 'Online (verified)' }
  return <span className={`src src-${source}`}>{map[source] ?? source}</span>
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children && <p className="muted">{children}</p>}
    </div>
  )
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose(): void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="card-head">
          <h2>{title}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Close">✕</button>
        </header>
        <div className="card-body">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, error, hint, children, span }: { label: string; error?: string; hint?: string; children: ReactNode; span?: 2 | 3 | 'all' }) {
  return (
    <label className={`field ${error ? 'has-error' : ''} ${span ? `span-${span}` : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="muted small">{hint}</span>}
      {error && <span className="error-text">{error}</span>}
    </label>
  )
}

export function Toasts() {
  const { toasts } = useData()
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>
      ))}
    </div>
  )
}

export function ProgressBar({ value, max, tone }: { value: number; max: number; tone?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="bar" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <span className={tone ?? 'good'} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: NoInfer<T>; label: string }[]; value: T; onChange(v: T): void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={t.id === value} className={t.id === value ? 'on' : ''} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  )
}
