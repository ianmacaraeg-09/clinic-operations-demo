import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useData } from '../core/DataContext.tsx'
import { balance, fullName, owes, peso, sortByTime, unpaidList, todayIso } from '../core/logic.ts'
import { downloadCsv } from '../ui/csv.ts'
import { Avatar, Card, Empty, PageHeader, Stat } from '../ui/kit.tsx'
import { useNewBooking } from '../ui/Layout.tsx'
import VisitTable from './VisitTable.tsx'

export function PatientsList() {
  const { patients, visits, payments, contacts, config, can } = useData()
  const newBooking = useNewBooking()
  const [q, setQ] = useState('')
  const [owing, setOwing] = useState(false)
  const owed = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of unpaidList({ visits, payments, patients, contacts }, todayIso(), config.graceDays)) m.set(r.patient.id, (m.get(r.patient.id) ?? 0) + r.balance)
    return m
  }, [visits, payments, patients, contacts, config.graceDays])
  const rows = patients
    .filter((p) => (!owing || owed.has(p.id)) && (!q.trim() || `${fullName(p)} ${p.patientNo} ${p.phone}`.toLowerCase().includes(q.trim().toLowerCase())))
    .sort((a, b) => a.lastName.localeCompare(b.lastName))
  const lastVisit = (id: string) => visits.filter((v) => v.patientId === id && v.date <= todayIso()).sort((a, b) => b.date.localeCompare(a.date))[0]

  return (
    <>
      <PageHeader title="Patients" sub="Fast lookup. Search by name, patient number or phone.">
        <button className="btn" onClick={() => downloadCsv('patients.csv', ['Patient no', 'Name', 'Phone', 'Birthdate', 'Balance'], rows.map((p) => [p.patientNo, fullName(p), p.phone, p.birthdate, owed.get(p.id) ?? 0]))}>Export CSV</button>
        {can('bookings.edit') && <button className="btn primary" onClick={() => newBooking()}>New booking</button>}
      </PageHeader>
      <Card pad={false}>
        <div className="filters">
          <input type="search" placeholder="Search patients…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search patients" />
          <label className="check-row"><input type="checkbox" checked={owing} onChange={(e) => setOwing(e.target.checked)} /> With a balance</label>
          <span className="muted small grow right">{rows.length} patients</span>
        </div>
        {rows.length === 0 ? <Empty title="No patients match." /> : (
          <div className="table-wrap">
            <table className="table hover">
              <thead><tr><th>Patient</th><th>Phone</th><th>Last visit</th><th className="right">Balance</th></tr></thead>
              <tbody>
                {rows.slice(0, 120).map((p) => {
                  const lv = lastVisit(p.id)
                  const o = owed.get(p.id) ?? 0
                  return (
                    <tr key={p.id}>
                      <td><Link className="who" to={`/app/patients/${p.id}`} style={{ color: 'inherit' }}><Avatar name={fullName(p)} size={34} /><span><strong>{fullName(p)}</strong><div className="muted small">{p.patientNo}</div></span></Link></td>
                      <td>{p.phone}</td>
                      <td>{lv ? lv.date : <span className="muted">None</span>}</td>
                      <td className="right">{o > 0 ? <span className="amount danger-text">{peso(o)}</span> : <span className="muted">—</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}

export function PatientDetail() {
  const { id } = useParams()
  const { patients, visits, payments, can } = useData()
  const newBooking = useNewBooking()
  const p = patients.find((x) => x.id === id)
  if (!p) return <Card title="Patient not found"><Link to="/app/patients">Back to patients</Link></Card>
  const mine = visits.filter((v) => v.patientId === p.id).sort((a, b) => -sortByTime(a, b))
  const owedNow = mine.filter((v) => owes(v) && v.date <= todayIso() && !(v.status === 'booked' && v.date === todayIso())).reduce((n, v) => n + balance(v, payments), 0)
  const paidTotal = payments.filter((x) => !x.voided && mine.some((v) => v.id === x.visitId)).reduce((n, x) => n + x.amount, 0)
  return (
    <>
      <PageHeader title={fullName(p)} sub={`${p.patientNo} · ${p.phone}${p.birthdate ? ` · born ${p.birthdate}` : ''}`} avatar={fullName(p)}>
        <Link className="btn" to="/app/patients">All patients</Link>
        {can('bookings.edit') && <button className="btn primary" onClick={() => newBooking({ patientId: p.id })}>Book a visit</button>}
      </PageHeader>
      <div className="stats">
        <Stat label="Visits" value={mine.filter((v) => v.status === 'done' || v.status === 'arrived').length} />
        <Stat label="Total paid" value={peso(paidTotal)} tone="good" />
        <Stat label="Balance now" value={peso(owedNow)} tone={owedNow > 0 ? 'bad' : 'good'} />
      </div>
      <Card title="Visit history" pad={false}><VisitTable visits={mine} showDate hidePatient empty="No visits yet." /></Card>
    </>
  )
}
