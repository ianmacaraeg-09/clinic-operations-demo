import { useMemo, useState } from 'react'
import { useData } from '../core/DataContext.tsx'
import { STATUS_LABEL, addDays, fullName, sortByTime, todayIso } from '../core/logic.ts'
import type { VisitStatus } from '../core/types.ts'
import { Card, PageHeader } from '../ui/kit.tsx'
import { useNewBooking } from '../ui/Layout.tsx'
import VisitTable from './VisitTable.tsx'

type Range = 'upcoming' | 'week' | 'past' | 'all'

export default function Bookings() {
  const { visits, patients, config, can, role, doctorId } = useData()
  const newBooking = useNewBooking()
  const today = todayIso()
  const [q, setQ] = useState('')
  const [range, setRange] = useState<Range>('upcoming')
  const [status, setStatus] = useState<'all' | VisitStatus>('all')
  const [service, setService] = useState('all')

  const requested = visits.filter((v) => v.status === 'requested').length

  const rows = useMemo(() => {
    const byId = new Map(patients.map((p) => [p.id, p]))
    const n = q.trim().toLowerCase()
    return visits
      .filter((v) => (role === 'doctor' ? v.doctorId === doctorId : true))
      .filter((v) => (range === 'upcoming' ? v.date >= today : range === 'week' ? v.date >= today && v.date <= addDays(today, 7) : range === 'past' ? v.date < today : true))
      .filter((v) => status === 'all' || v.status === status)
      .filter((v) => service === 'all' || v.serviceId === service)
      .filter((v) => {
        if (!n) return true
        const p = byId.get(v.patientId)
        return p ? `${fullName(p)} ${p.patientNo}`.toLowerCase().includes(n) : false
      })
      .sort((a, b) => (range === 'past' ? -sortByTime(a, b) : sortByTime(a, b)))
      .slice(0, 150)
  }, [visits, patients, q, range, status, service, today, role, doctorId])

  return (
    <>
      <PageHeader title="Bookings" sub="Every booking in one place, however it came in: phone, desk, doctor or the online page.">
        {can('bookings.edit') && <button className="btn primary" onClick={() => newBooking()}>New booking</button>}
      </PageHeader>
      {requested > 0 && (
        <div className="callout info"><div><strong>{requested} online booking {requested === 1 ? 'request' : 'requests'} to confirm</strong>Filter by status “Requested”, then tap Confirm on each.</div></div>
      )}
      <Card pad={false}>
        <div className="filters">
          <input type="search" placeholder="Search patient or number…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search bookings" />
          <select value={range} onChange={(e) => setRange(e.target.value as Range)} aria-label="Period">
            <option value="upcoming">Today and later</option>
            <option value="week">Next 7 days</option>
            <option value="past">Past</option>
            <option value="all">All dates</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as 'all' | VisitStatus)} aria-label="Status">
            <option value="all">Any status</option>
            {(Object.keys(STATUS_LABEL) as VisitStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <select value={service} onChange={(e) => setService(e.target.value)} aria-label="Service">
            <option value="all">All services</option>
            {config.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <VisitTable visits={rows} showDate empty="No bookings match." />
      </Card>
    </>
  )
}
