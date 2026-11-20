import { useState } from 'react'
import { useData } from '../core/DataContext.tsx'
import { addDays, fullName, peso, prettyDate, prettyTime, todayIso } from '../core/logic.ts'
import { Card, Field } from '../ui/kit.tsx'

const TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00']

/** Optional patient-facing page. A request lands in Bookings as "Requested" for staff to confirm. */
export default function PublicBook() {
  const { config, patients, addPatient, createVisit } = useData()
  const [f, setF] = useState({ firstName: '', lastName: '', phone: '', serviceId: config.services[0]?.id ?? '', date: addDays(todayIso(), 1), time: '09:00', note: '' })
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ when: string; ref: string } | null>(null)
  const service = config.services.find((s) => s.id === f.serviceId)
  const doctor = config.doctors.find((d) => d.serviceId === f.serviceId) ?? config.doctors[0]

  const submit = () => {
    setError('')
    if (!f.firstName.trim() || !f.lastName.trim()) return setError('Please enter your first and last name.')
    if (!/^[0-9+\-\s()]{7,}$/.test(f.phone)) return setError('Please enter a mobile number we can reach you on.')
    if (f.date < todayIso()) return setError('Please choose today or a later date.')
    const phone = f.phone.trim()
    const existing = patients.find((p) => p.phone === phone && p.lastName.toLowerCase() === f.lastName.trim().toLowerCase())
    const patient = existing ?? addPatient({ firstName: f.firstName.trim(), lastName: f.lastName.trim(), phone, birthdate: '' })
    const res = createVisit({ patientId: patient.id, doctorId: doctor.id, serviceId: f.serviceId, date: f.date, time: f.time, note: f.note, bookedVia: 'online', status: 'requested' })
    if (!res.ok) return setError(res.error)
    setDone({ when: `${prettyDate(f.date)} at ${prettyTime(f.time)}`, ref: res.value.id.slice(-6).toUpperCase() })
  }

  if (done) {
    return (
      <div className="narrow">
        <Card>
          <div className="success">
            <div className="check-big">✓</div>
            <h1>Request received</h1>
            <p>We will confirm your booking for <strong>{done.when}</strong> by message.</p>
            <div className="refno">{done.ref}</div>
            <button className="btn" onClick={() => setDone(null)}>Make another request</button>
          </div>
        </Card>
      </div>
    )
  }
  return (
    <div className="narrow">
      <Card title="Request an appointment">
        <div className="stack">
          <p className="muted">Choose a service and a time. The clinic will confirm your request. You pay at the clinic, or by link if you prefer.</p>
          <div className="grid">
            <Field label="First name"><input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></Field>
            <Field label="Last name"><input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></Field>
            <Field label="Mobile number"><input value={f.phone} inputMode="tel" onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Service" hint={service ? `Fee ${peso(service.fee)} · ${doctor?.name}` : undefined}>
              <select value={f.serviceId} onChange={(e) => setF({ ...f, serviceId: e.target.value })}>{config.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            </Field>
            <Field label="Preferred date"><input type="date" min={todayIso()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="Preferred time"><select value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })}>{TIMES.map((t) => <option key={t} value={t}>{prettyTime(t)}</option>)}</select></Field>
            <Field label="Anything we should know? (optional)" span="all"><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
          </div>
          {error && <div className="alert error">{error}</div>}
          <div className="row end"><button className="btn primary" onClick={submit}>Send request</button></div>
          <p className="muted small">Demo: this request appears in the staff system under Bookings as “Requested”{patients[0] ? `, for example alongside ${fullName(patients[0])}'s sample record` : ''}.</p>
        </div>
      </Card>
    </div>
  )
}
