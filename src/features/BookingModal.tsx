import { useMemo, useState } from 'react'
import { useData } from '../core/DataContext.tsx'
import { fullName, peso, prettyTime, slotTaken, todayIso } from '../core/logic.ts'
import { Avatar, Field, Modal } from '../ui/kit.tsx'

export interface Prefill { patientId?: string; doctorId?: string; date?: string }

const TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30']

export default function BookingModal({ prefill, onClose }: { prefill: Prefill; onClose(): void }) {
  const { config, patients, visits, role, doctorId: demoDoctor, addPatient, createVisit, toast } = useData()
  const defaultDoctor = prefill.doctorId ?? (role === 'doctor' ? demoDoctor : config.doctors[0]?.id ?? '')
  const [q, setQ] = useState('')
  const [patientId, setPatientId] = useState(prefill.patientId ?? '')
  const [isNew, setIsNew] = useState(false)
  const [np, setNp] = useState({ firstName: '', lastName: '', phone: '', birthdate: '' })
  const [doctorId, setDoctorId] = useState(defaultDoctor)
  const doctor = config.doctors.find((d) => d.id === doctorId)
  const [serviceId, setServiceId] = useState(doctor?.serviceId ?? config.services[0]?.id ?? '')
  const [date, setDate] = useState(prefill.date ?? todayIso())
  const [time, setTime] = useState('09:00')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const service = config.services.find((s) => s.id === serviceId)

  const matches = useMemo(() => {
    const n = q.trim().toLowerCase()
    if (!n) return []
    return patients.filter((p) => `${p.firstName} ${p.lastName} ${p.patientNo} ${p.phone}`.toLowerCase().includes(n)).slice(0, 5)
  }, [q, patients])
  const chosen = patients.find((p) => p.id === patientId)
  const taken = slotTaken(visits, doctorId, date, time)

  const save = () => {
    setError('')
    let pid = patientId
    if (isNew) {
      if (!np.firstName.trim() || !np.lastName.trim()) return setError('Enter the patient’s first and last name.')
      if (np.phone && !/^[0-9+\-\s()]{7,}$/.test(np.phone)) return setError('Phone number looks incomplete.')
      pid = addPatient({ ...np, firstName: np.firstName.trim(), lastName: np.lastName.trim() }).id
    }
    const res = createVisit({ patientId: pid, doctorId, serviceId, date, time, note, bookedVia: role === 'doctor' ? 'doctor' : 'desk' })
    if (!res.ok) return setError(res.error)
    toast(`Booked for ${prettyTime(time)}`)
    onClose()
  }

  return (
    <Modal title="New booking" onClose={onClose} wide>
      <div className="stack">
        <div className="chips">
          <button type="button" className={`chip ${!isNew ? 'on' : ''}`} onClick={() => setIsNew(false)}>Existing patient</button>
          <button type="button" className={`chip ${isNew ? 'on' : ''}`} onClick={() => setIsNew(true)}>New patient</button>
        </div>

        {!isNew ? (
          <div className="stack tight">
            {chosen ? (
              <div className="row gap action-bar">
                <Avatar name={fullName(chosen)} size={36} />
                <div className="grow"><strong>{fullName(chosen)}</strong><div className="muted small">{chosen.patientNo} · {chosen.phone}</div></div>
                <button className="btn sm ghost" onClick={() => setPatientId('')}>Change</button>
              </div>
            ) : (
              <>
                <Field label="Find the patient"><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, patient number or phone" /></Field>
                {matches.map((p) => (
                  <button key={p.id} type="button" className="action-bar" style={{ cursor: 'pointer', textAlign: 'left' }} onClick={() => setPatientId(p.id)}>
                    <Avatar name={fullName(p)} size={30} /><strong>{fullName(p)}</strong><span className="muted small">{p.patientNo} · {p.phone}</span>
                  </button>
                ))}
                {q.trim() && matches.length === 0 && <p className="muted small">No match. Use “New patient” to add them.</p>}
              </>
            )}
          </div>
        ) : (
          <div className="grid">
            <Field label="First name"><input value={np.firstName} onChange={(e) => setNp({ ...np, firstName: e.target.value })} autoFocus /></Field>
            <Field label="Last name"><input value={np.lastName} onChange={(e) => setNp({ ...np, lastName: e.target.value })} /></Field>
            <Field label="Mobile number"><input value={np.phone} onChange={(e) => setNp({ ...np, phone: e.target.value })} inputMode="tel" /></Field>
            <Field label="Birthdate"><input type="date" value={np.birthdate} onChange={(e) => setNp({ ...np, birthdate: e.target.value })} /></Field>
          </div>
        )}

        <div className="grid">
          <Field label="Doctor">
            <select value={doctorId} onChange={(e) => { setDoctorId(e.target.value); const d = config.doctors.find((x) => x.id === e.target.value); if (d) setServiceId(d.serviceId) }}>
              {config.doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Service" hint={service ? `Fee ${peso(service.fee)}` : undefined}>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              {config.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
          <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Time" error={taken ? 'This doctor already has a booking at this time.' : undefined}>
            <select value={time} onChange={(e) => setTime(e.target.value)}>
              {TIMES.map((t) => <option key={t} value={t}>{prettyTime(t)}</option>)}
            </select>
          </Field>
          <Field label="Note (optional)" span="all"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything staff should know" /></Field>
        </div>
        {error && <div className="alert error">{error}</div>}
        <div className="row end gap">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!isNew && !patientId} onClick={save}>{taken ? 'Book anyway' : 'Save booking'}</button>
        </div>
      </div>
    </Modal>
  )
}
