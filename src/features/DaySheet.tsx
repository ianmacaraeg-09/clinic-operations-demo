import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../core/DataContext.tsx'
import { addDays, balance, collections, owes, peso, prettyDate, sortByTime, todayIso, unpaidList } from '../core/logic.ts'
import { Card, PageHeader, Stat } from '../ui/kit.tsx'
import { useNewBooking } from '../ui/Layout.tsx'
import VisitTable from './VisitTable.tsx'

export default function DaySheet() {
  const { visits, payments, patients, contacts, proposals, config, role, doctorId, can } = useData()
  const newBooking = useNewBooking()
  const today = todayIso()
  const [date, setDate] = useState(today)
  const [doctor, setDoctor] = useState(role === 'doctor' ? doctorId : 'all')
  const [service, setService] = useState('all')
  const effectiveDoctor = role === 'doctor' ? doctorId : doctor

  const day = useMemo(
    () => visits.filter((v) => v.date === date && (effectiveDoctor === 'all' || v.doctorId === effectiveDoctor) && (service === 'all' || v.serviceId === service)).sort(sortByTime),
    [visits, date, effectiveDoctor, service],
  )
  const live = day.filter((v) => v.status !== 'cancelled')
  const arrived = live.filter((v) => v.status === 'arrived' || v.status === 'done').length
  const dayIds = new Set(day.map((v) => v.id))
  const collectedToday = collections(payments.filter((p) => dayIds.has(p.visitId)), date, date).total
  const owedToday = day.filter((v) => (v.status === 'arrived' || v.status === 'done')).reduce((n, v) => n + balance(v, payments), 0)
  const unpaidTotal = unpaidList({ visits, payments, patients, contacts }, today, config.graceDays)
  const pending = proposals.filter((p) => p.status === 'pending').length
  const upcoming = day.filter((v) => owes(v) && v.status === 'booked').length

  return (
    <>
      <PageHeader title="Day sheet" sub={`${prettyDate(date)}${date === today ? ' · today' : ''}. One live list, replacing the logbook.`}>
        <button className="btn" onClick={() => window.print()}>Print day sheet</button>
        {can('bookings.edit') && <button className="btn primary" onClick={() => newBooking({ date })}>New booking</button>}
      </PageHeader>

      {can('unpaid.view') && (unpaidTotal.length > 0 || pending > 0) && (
        <div className="callout no-print">
          <div className="grow">
            <strong>Needs attention</strong>
            {unpaidTotal.length > 0 && <span><Link to="/app/unpaid">{unpaidTotal.length} unpaid {unpaidTotal.length === 1 ? 'visit' : 'visits'} ({peso(unpaidTotal.reduce((n, r) => n + r.balance, 0))})</Link>. </span>}
            {pending > 0 && can('inbox.confirm') && <span><Link to="/app/inbox">{pending} payment {pending === 1 ? 'message is' : 'messages are'} waiting for your confirmation</Link>.</span>}
          </div>
        </div>
      )}

      <div className="stats">
        <Stat label="Patients booked" value={live.length} hint={`${upcoming} still to come`} />
        <Stat label="Arrived or done" value={arrived} hint={`of ${live.length}`} tone="good" />
        <Stat label="Collected" value={peso(collectedToday)} hint="payments on these visits" tone="good" />
        <Stat label="Still owed" value={peso(owedToday)} hint="arrived or done, unpaid" tone={owedToday > 0 ? 'warn' : 'good'} to={can('unpaid.view') ? '/app/unpaid' : undefined} />
      </div>

      <Card pad={false}>
        <div className="filters no-print">
          <div className="date-nav">
            <button className="btn sm" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">‹</button>
            <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" />
            <button className="btn sm" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">›</button>
            {date !== today && <button className="btn sm ghost" onClick={() => setDate(today)}>Today</button>}
          </div>
          {role !== 'doctor' && (
            <select value={doctor} onChange={(e) => setDoctor(e.target.value)} aria-label="Doctor">
              <option value="all">All doctors</option>
              {config.doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}
          <select value={service} onChange={(e) => setService(e.target.value)} aria-label="Service">
            <option value="all">All services</option>
            {config.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="print-area">
          <div className="print-title muted small">{config.clinic.name} · Day sheet · {prettyDate(date)}</div>
          <VisitTable visits={day} empty="Nothing booked for this day." />
        </div>
      </Card>
    </>
  )
}
