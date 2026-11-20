import { useState } from 'react'
import { useData } from '../core/DataContext.tsx'
import { balance, charge, fullName, payStatus, peso, prettyDate, prettyTime, sortByTime, todayIso } from '../core/logic.ts'
import type { Visit } from '../core/types.ts'
import { Avatar, PageHeader, PayBadge, StatusChip } from '../ui/kit.tsx'
import { useNewBooking } from '../ui/Layout.tsx'
import { RecordPaymentModal, useVisitInfo } from './PaymentParts.tsx'

/** Phone-first view: the five-second actions a doctor needs, so nobody has to relay anything. */
export default function Quick() {
  const { visits, payments, config, role, doctorId, can, recordPayment, setVisitStatus, toast } = useData()
  const newBooking = useNewBooking()
  const info = useVisitInfo()
  const today = todayIso()
  const [doctor, setDoctor] = useState(role === 'doctor' ? doctorId : config.doctors[0]?.id ?? '')
  const effective = role === 'doctor' ? doctorId : doctor
  const [confirming, setConfirming] = useState('')
  const [other, setOther] = useState<Visit | null>(null)

  const list = visits.filter((v) => v.date === today && v.doctorId === effective && v.status !== 'cancelled').sort(sortByTime)
  const docName = config.doctors.find((d) => d.id === effective)?.name

  const cash = (v: Visit) => {
    const res = recordPayment({ visitId: v.id, amount: balance(v, payments), method: 'cash' })
    setConfirming('')
    if (!res.ok) return toast(res.error, 'error')
    toast(`${peso(res.value.amount)} cash recorded. Staff can see it now.`)
  }

  return (
    <div className="quick-wrap">
      <PageHeader title={role === 'doctor' ? 'My patients today' : 'Doctor quick view'} sub={`${docName ?? ''} · ${prettyDate(today)}`} />
      {role !== 'doctor' && (
        <select value={doctor} onChange={(e) => setDoctor(e.target.value)} aria-label="Doctor">
          {config.doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      )}
      {can('bookings.edit') && (
        <div className="quick-add">
          <button className="btn primary" onClick={() => newBooking({ doctorId: effective, date: today })}>+ Add a booking</button>
          <button className="btn" onClick={() => newBooking({ doctorId: effective, date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) })}>+ Book for tomorrow</button>
        </div>
      )}
      {list.length === 0 && <div className="qcard"><p className="muted center">No patients booked for today.</p></div>}
      {list.map((v) => {
        const i = info(v)
        const left = balance(v, payments)
        const st = payStatus(v, payments)
        return (
          <div className="qcard" key={v.id}>
            <div className="qtop">
              <span className="qtime">{prettyTime(v.time)}</span>
              {i.patient && <Avatar name={fullName(i.patient)} size={40} />}
              <div className="grow">
                <strong>{i.patient ? fullName(i.patient) : ''}</strong>
                <div className="muted small">{i.service?.name} · {peso(charge(v))}</div>
              </div>
            </div>
            <div className="row gap wrap"><StatusChip status={v.status} /><PayBadge status={st} />{left > 0 && st !== 'unpaid' && <span className="small danger-text">owes {peso(left)}</span>}</div>
            <div className="qbtns">
              {v.status === 'booked' && <button className="btn" onClick={() => { setVisitStatus(v.id, 'arrived'); toast('Marked arrived') }}>Arrived</button>}
              {v.status === 'arrived' && <button className="btn" onClick={() => { setVisitStatus(v.id, 'done'); toast('Marked done') }}>Done</button>}
              {left > 0 && can('payments.record') && (confirming === v.id ? (
                <button className="btn good" onClick={() => cash(v)}>Confirm {peso(left)} cash ✓</button>
              ) : (
                <button className="btn good" onClick={() => setConfirming(v.id)}>Paid {peso(left)} cash ✓</button>
              ))}
              {left > 0 && can('payments.record') && confirming !== v.id && <button className="btn" onClick={() => setOther(v)}>Other amount / e-wallet</button>}
              {confirming === v.id && <button className="btn" onClick={() => setConfirming('')}>Cancel</button>}
            </div>
          </div>
        )
      })}
      {other && <RecordPaymentModal visit={other} onClose={() => setOther(null)} />}
    </div>
  )
}
