import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import BookingModal, { type Prefill } from '../features/BookingModal.tsx'
import { ROLE_LABEL } from '../config/clinic.config.ts'
import { useData } from '../core/DataContext.tsx'
import { fullName, todayIso, unpaidList } from '../core/logic.ts'
import type { Permission, Role } from '../core/types.ts'
import { Avatar, Card, Modal, Toasts } from './kit.tsx'

const ICONS: Record<string, string> = {
  dashboard: 'M3 4h18v16H3zM3 9h18M8 4v5M16 4v5',
  bookings: 'M8 2v4M16 2v4M3 8h18M5 4h14a2 2 0 012 2v14H3V6a2 2 0 012-2zM8 13h3M8 17h3M14 13h2',
  unpaid: 'M12 8v5M12 17h.01M10.3 3.9L2.4 18a2 2 0 001.7 3h15.8a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13l3.5 7v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6z',
  payments: 'M2 6h20v12H2zM2 10h20M6 15h4',
  patients: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8',
  quick: 'M13 2L4 14h7l-1 8 9-12h-7z',
  reports: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 00-2-1.2L14 3h-4l-.6 2.6a7 7 0 00-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9c.6.5 1.3.9 2 1.2L10 21h4l.6-2.6c.7-.3 1.4-.7 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3',
  plus: 'M12 5v14M5 12h14',
  menu: 'M4 6h16M4 12h16M4 18h16',
  help: 'M9.1 9a3 3 0 115.8 1c0 2-3 2.5-3 4.5M12 18h.01M12 22a10 10 0 100-20 10 10 0 000 20z',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
  cross: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
}
export function Icon({ name, size }: { name: string; size?: number }) {
  return (
    <svg className="ico" viewBox="0 0 24 24" aria-hidden="true" style={size ? { width: size, height: size } : undefined}>
      <path d={ICONS[name] ?? ''} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo({ size = 38 }: { size?: number }) {
  return (
    <span className="logo" style={{ width: size, height: size }} aria-hidden="true">
      <Icon name="cross" size={size * 0.58} />
    </span>
  )
}

/* "New booking" can be opened from anywhere. */
const BookingCtx = createContext<(p?: Prefill) => void>(() => {})
export const useNewBooking = () => useContext(BookingCtx)

export function Guard({ perm, children }: { perm: Permission; children: ReactNode }) {
  const { can, roleLabel } = useData()
  if (can(perm)) return <>{children}</>
  return (
    <Card title="No access">
      <p>The <strong>{roleLabel}</strong> role does not have permission to open this page. Switch role from the sidebar (demo) or ask an administrator.</p>
    </Card>
  )
}

const ROLES: Role[] = ['admin', 'frontdesk', 'doctor']

/** Type-ahead patient search. Press "/" anywhere to focus it. */
function GlobalSearch() {
  const { patients, can } = useData()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const results = useMemo(() => {
    const n = q.trim().toLowerCase()
    if (!n) return []
    return patients.filter((p) => `${p.firstName} ${p.lastName} ${p.patientNo} ${p.phone}`.toLowerCase().includes(n)).slice(0, 6)
  }, [q, patients])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') { e.preventDefault(); input.current?.focus() }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
  if (!can('patients.view')) return <div className="grow" />

  const go = (id: string) => { nav(`/app/patients/${id}`); setQ(''); setOpen(false); input.current?.blur() }
  return (
    <div className="gsearch">
      <Icon name="search" size={18} />
      <input ref={input} value={q} placeholder="Search a patient, number or phone…" aria-label="Search patients"
        onChange={(e) => { setQ(e.target.value); setOpen(true); setIdx(0) }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)) }
          if (e.key === 'Enter' && results[idx]) go(results[idx].id)
          if (e.key === 'Escape') { setQ(''); input.current?.blur() }
        }} />
      <kbd>/</kbd>
      {open && q.trim() && (
        <ul className="gsearch-pop" role="listbox">
          {results.length === 0 && <li className="muted gs-none">No patient matches “{q}”.</li>}
          {results.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === idx} className={i === idx ? 'on' : ''} onMouseDown={() => go(p.id)} onMouseEnter={() => setIdx(i)}>
              <Avatar name={fullName(p)} size={32} />
              <div className="grow"><strong>{fullName(p)}</strong><div className="muted small">{p.patientNo} · {p.phone}</div></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AdminLayout() {
  const { config, can, role, setRole, backend, visits, payments, patients, contacts, proposals } = useData()
  const [open, setOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const [booking, setBooking] = useState<Prefill | null>(null)
  const loc = useLocation()
  useEffect(() => { setOpen(false) }, [loc.pathname])

  const unpaidCount = useMemo(() => unpaidList({ visits, payments, patients, contacts }, todayIso(), config.graceDays).length, [visits, payments, patients, contacts, config.graceDays])
  const pending = proposals.filter((p) => p.status === 'pending').length

  const nav: { to: string; label: string; icon: string; perm: Permission; badge?: number }[] = [
    { to: '/app', label: 'Day sheet', icon: 'dashboard', perm: 'dashboard.view' },
    { to: '/app/quick', label: role === 'doctor' ? 'My patients today' : 'Quick view', icon: 'quick', perm: 'dashboard.view' },
    { to: '/app/bookings', label: 'Bookings', icon: 'bookings', perm: 'dashboard.view' },
    { to: '/app/unpaid', label: 'Unpaid list', icon: 'unpaid', perm: 'unpaid.view', badge: unpaidCount },
    { to: '/app/inbox', label: 'Payment inbox', icon: 'inbox', perm: 'inbox.confirm', badge: pending },
    { to: '/app/payments', label: 'Payments', icon: 'payments', perm: 'unpaid.view' },
    { to: '/app/patients', label: 'Patients', icon: 'patients', perm: 'patients.view' },
    { to: '/app/reports', label: 'Reports', icon: 'reports', perm: 'reports.view' },
    { to: '/app/settings', label: 'Settings', icon: 'settings', perm: 'settings.edit' },
  ]
  return (
    <BookingCtx.Provider value={(p) => setBooking(p ?? {})}>
      <div className="shell">
        {open && <div className="scrim" onClick={() => setOpen(false)} />}
        <aside className={`sidebar ${open ? 'open' : ''}`}>
          <div className="brand">
            <Logo size={42} />
            <div>
              <strong>{config.clinic.shortName}</strong>
              <span>Operations</span>
            </div>
          </div>
          <nav aria-label="Main">
            {nav.filter((n) => can(n.perm)).map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/app'} className={({ isActive }) => (isActive ? 'on' : '')}>
                <Icon name={n.icon} />
                <span className="grow">{n.label}</span>
                {!!n.badge && <span className="nav-badge">{n.badge}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="side-foot">
            {config.bookingLink && <Link className="side-link" to="/book" target="_blank"><Icon name="external" size={16} />Patient booking page</Link>}
            <div className="side-user">
              <Avatar name={ROLE_LABEL[role]} size={34} />
              <label>
                <span>Demo: using as</span>
                <select value={role} onChange={(e) => setRole(e.target.value as Role)} aria-label="Using the system as">
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
              </label>
            </div>
            <span className="side-note">{backend === 'local' ? 'Demo data saved on this device only' : 'Connected to Supabase'}</span>
          </div>
        </aside>

        <div className="content">
          <div className="sample-strip no-print">Demo with sample data. Every name, number and amount is fictional.</div>
          <header className="topbar no-print">
            <button className="btn ghost icon menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
            <GlobalSearch />
            {can('bookings.edit') && <button className="btn primary add-btn" onClick={() => setBooking({})}><Icon name="plus" size={18} /><span>New booking</span></button>}
            <button className="btn ghost icon" onClick={() => setHelp(true)} aria-label="Help"><Icon name="help" /></button>
          </header>
          <main className="main">
            <Outlet />
          </main>
        </div>

        {help && (
          <Modal title="How this works" onClose={() => setHelp(false)}>
            <ol className="help-list">
              <li><strong>Record it once, where it happens.</strong> Bookings and payments are entered at the desk or by the doctor in a few taps. Nobody relays anything.</li>
              <li><strong>One live status.</strong> The Day sheet shows every patient as Booked, Arrived or Done, and Unpaid, Partial or Paid.</li>
              <li><strong>Unpaid list builds itself.</strong> Staff work down it, log each contact and copy the drafted reminder.</li>
              <li><strong>Payment inbox.</strong> The AI reads a payment message and proposes the patient and visit. A person confirms with one tap; nothing is marked paid on its own.</li>
            </ol>
            <p className="muted small">Shortcut: press <kbd className="kbd">/</kbd> anywhere to search a patient. Switch roles in the sidebar to see the doctor and front-desk views.</p>
            <div className="row end"><button className="btn primary" onClick={() => setHelp(false)}>Got it</button></div>
          </Modal>
        )}
        {booking && <BookingModal prefill={booking} onClose={() => setBooking(null)} />}
        <Toasts />
      </div>
    </BookingCtx.Provider>
  )
}

export function PublicLayout() {
  const { config } = useData()
  return (
    <div className="public">
      <div className="sample-strip">Demo with sample data. Requests made here stay in this browser only.</div>
      <header className="public-head">
        <Link to="/" className="brand">
          <Logo size={44} />
          <div>
            <strong>{config.clinic.name}</strong>
            <span className="muted small">{config.clinic.tagline}</span>
          </div>
        </Link>
        <nav className="row gap">
          <Link to="/app">Staff sign-in</Link>
        </nav>
      </header>
      <main className="public-main">
        <Outlet />
      </main>
      <footer className="public-foot muted small">{config.clinic.name} · {config.clinic.address} · {config.clinic.phone}</footer>
      <Toasts />
    </div>
  )
}
