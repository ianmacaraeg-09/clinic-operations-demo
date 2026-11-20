import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../core/DataContext.tsx'
import { balance, charge, fullName, payStatus, peso, prettyDate, prettyTime, shortDate } from '../core/logic.ts'
import type { Visit, VisitStatus } from '../core/types.ts'
import { Avatar, Empty, PayBadge, StatusChip } from '../ui/kit.tsx'
import { OnlinePayModal, RecordPaymentModal, useVisitInfo } from './PaymentParts.tsx'

/** The shared list of visits: day sheet, bookings and a patient's history all use it. */
export default function VisitTable({ visits, showDate = false, hidePatient = false, empty }: { visits: Visit[]; showDate?: boolean; hidePatient?: boolean; empty?: string }) {
  const { payments, config, can, setVisitStatus, toast } = useData()
  const info = useVisitInfo()
  const [pay, setPay] = useState<Visit | null>(null)
  const [online, setOnline] = useState<Visit | null>(null)

  if (visits.length === 0) return <Empty title={empty ?? 'No visits'} />

  const move = (v: Visit, s: VisitStatus) => { setVisitStatus(v.id, s); toast(`Marked ${s === 'noshow' ? 'no-show' : s}`) }

  return (
    <>
      <div className="table-wrap">
        <table className="table hover">
          <thead>
            <tr>
              <th>{showDate ? 'When' : 'Time'}</th>
              {!hidePatient && <th>Patient</th>}
              <th>Service</th>
              <th>Status</th>
              <th>Payment</th>
              <th className="right">Charge / balance</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visits.map((v) => {
              const i = info(v)
              const st = payStatus(v, payments)
              const left = balance(v, payments)
              const editable = can('bookings.edit')
              return (
                <tr key={v.id} className={v.status === 'cancelled' ? 'voided' : ''}>
                  <td>
                    <strong>{prettyTime(v.time)}</strong>
                    {showDate && <div className="muted small">{shortDate(v.date)}</div>}
                  </td>
                  {!hidePatient && (
                    <td>
                      {i.patient ? (
                        <Link className="who" to={`/app/patients/${i.patient.id}`} style={{ color: 'inherit' }}>
                          <Avatar name={fullName(i.patient)} size={32} />
                          <span><strong>{fullName(i.patient)}</strong><div className="muted small">{i.patient.patientNo}</div></span>
                        </Link>
                      ) : '—'}
                    </td>
                  )}
                  <td>
                    <span className="svc-dot" style={{ background: i.service?.color }} />{i.service?.name}
                    <div className="muted small">{i.doctor?.name}</div>
                  </td>
                  <td><StatusChip status={v.status} /></td>
                  <td>{v.status === 'cancelled' || v.status === 'requested' ? <span className="muted small">—</span> : <PayBadge status={st} />}</td>
                  <td className="right">
                    <div className="amount">{peso(charge(v))}</div>
                    {left > 0 && v.status !== 'cancelled' && v.status !== 'requested' && <div className="small danger-text">owes {peso(left)}</div>}
                  </td>
                  <td>
                    <div className="row-actions">
                      {editable && v.status === 'requested' && <button className="btn sm primary" onClick={() => move(v, 'booked')}>Confirm</button>}
                      {editable && v.status === 'booked' && <button className="btn sm" onClick={() => move(v, 'arrived')}>Arrived</button>}
                      {editable && v.status === 'arrived' && <button className="btn sm" onClick={() => move(v, 'done')}>Done</button>}
                      {can('payments.record') && left > 0 && (v.status === 'booked' || v.status === 'arrived' || v.status === 'done' || v.status === 'noshow') && (
                        <button className="btn sm good" onClick={() => setPay(v)}>Pay</button>
                      )}
                      {can('payments.record') && config.onlinePayments && left > 0 && (v.status === 'arrived' || v.status === 'done') && (
                        <button className="btn sm ghost" onClick={() => setOnline(v)} title="Send an online payment link">Link</button>
                      )}
                      {editable && (v.status === 'booked' || v.status === 'requested') && (
                        <select className="mini" value="" aria-label="More actions" onChange={(e) => e.target.value && move(v, e.target.value as VisitStatus)}>
                          <option value="">More</option>
                          <option value="noshow">No-show</option>
                          <option value="cancelled">Cancel</option>
                        </select>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {pay && <RecordPaymentModal visit={pay} onClose={() => setPay(null)} />}
      {online && <OnlinePayModal visit={online} onClose={() => setOnline(null)} />}
    </>
  )
}

export function dayLabel(iso: string) { return prettyDate(iso) }
