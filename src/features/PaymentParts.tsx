import { useState } from 'react'
import { useData } from '../core/DataContext.tsx'
import { balance, charge, fullName, peso, prettyDate, prettyTime } from '../core/logic.ts'
import type { Payment, PaymentMethod, Visit } from '../core/types.ts'
import { Field, Modal, SourceTag } from '../ui/kit.tsx'

export function useVisitInfo() {
  const { patients, config } = useData()
  return (v: Visit) => ({
    patient: patients.find((p) => p.id === v.patientId),
    service: config.services.find((s) => s.id === v.serviceId),
    doctor: config.doctors.find((d) => d.id === v.doctorId),
  })
}

/** One form for "money received": used from the day sheet, unpaid list, patient page and the doctor's quick view. */
export function RecordPaymentModal({ visit, onClose, defaultMethod = 'cash' }: { visit: Visit; onClose(): void; defaultMethod?: PaymentMethod }) {
  const { config, payments, recordPayment, toast } = useData()
  const info = useVisitInfo()(visit)
  const left = balance(visit, payments)
  const [amount, setAmount] = useState(String(left))
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod)
  const [reference, setReference] = useState('')
  const [error, setError] = useState('')
  const enabled = config.methods.filter((m) => m.enabled)

  const save = () => {
    setError('')
    const res = recordPayment({ visitId: visit.id, amount: Number(amount), method, reference: method === 'cash' ? '' : reference })
    if (!res.ok) return setError(res.error)
    toast(`${peso(res.value.amount)} recorded (${res.value.receiptNo})`)
    onClose()
  }
  return (
    <Modal title="Record payment" onClose={onClose}>
      <div className="stack">
        <div className="action-bar">
          <div className="grow">
            <strong>{info.patient ? fullName(info.patient) : 'Patient'}</strong>
            <div className="muted small">{info.service?.name} · {prettyDate(visit.date)} · {prettyTime(visit.time)}</div>
          </div>
          <div className="right"><div className="muted small">Balance</div><strong className="amount">{peso(left)}</strong></div>
        </div>
        <div className="grid">
          <Field label="Amount received (₱)" error={error || undefined}>
            <input type="number" min="0" step="0.01" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </Field>
          <Field label="Paid by">
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {enabled.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </Field>
          {method !== 'cash' && <Field label="Reference number" span="all" hint="From the payment confirmation. Used to catch duplicates."><input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>}
        </div>
        <div className="row end gap">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn good" disabled={left <= 0} onClick={save}>Record payment</button>
        </div>
      </div>
    </Modal>
  )
}

/** Demo of the optional online-payment upgrade. In production the "paid" signal comes from the provider, verified. */
export function OnlinePayModal({ visit, onClose }: { visit: Visit; onClose(): void }) {
  const { payments, payOnline, toast } = useData()
  const info = useVisitInfo()(visit)
  const left = balance(visit, payments)
  const link = `https://pay.example-clinic.test/${visit.id}`
  const simulate = () => {
    const res = payOnline(visit.id)
    if (!res.ok) return toast(res.error, 'error')
    toast(`Online payment received (${res.value.receiptNo}). Marked Paid automatically.`)
    onClose()
  }
  return (
    <Modal title="Online payment link" onClose={onClose}>
      <div className="stack">
        <p>Send this link or QR code to <strong>{info.patient ? fullName(info.patient) : 'the patient'}</strong>. When they pay, the visit marks itself <strong>Paid</strong>: no matching and no relay.</p>
        <div className="qr" role="img" aria-label="Sample QR code" />
        <div className="paylink">{link}</div>
        <p className="amount" style={{ textAlign: 'center', fontSize: '1.4rem' }}>{peso(left)}</p>
        <div className="callout info"><div><strong>Demo only</strong>In the real system the payment provider confirms the payment to the server with a signed message. The button below stands in for that.</div></div>
        <div className="row end gap">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" disabled={left <= 0} onClick={simulate}>Simulate: patient paid online</button>
        </div>
      </div>
    </Modal>
  )
}

export function ReceiptModal({ payment, onClose }: { payment: Payment; onClose(): void }) {
  const { config, visits, patients, payments } = useData()
  const visit = visits.find((v) => v.id === payment.visitId)
  const patient = patients.find((p) => p.id === visit?.patientId)
  const service = config.services.find((s) => s.id === visit?.serviceId)
  return (
    <Modal title={`Receipt ${payment.receiptNo}`} onClose={onClose}>
      <div className="receipt print-area">
        <div className="receipt-head">
          <strong className="big">{config.clinic.name}</strong>
          <span className="muted">{config.clinic.address} · {config.clinic.phone}</span>
          <span>Acknowledgement receipt (sample, not an official receipt) {payment.voided && <span className="void-tag">VOID</span>}</span>
        </div>
        <dl className="kv two">
          <dt>Receipt no.</dt><dd>{payment.receiptNo}</dd>
          <dt>Date</dt><dd>{new Date(payment.recordedAt).toLocaleString('en-PH')}</dd>
          <dt>Patient</dt><dd>{patient ? fullName(patient) : ''}</dd>
          <dt>Service</dt><dd>{service?.name}</dd>
          <dt>Visit charge</dt><dd>{visit ? peso(charge(visit)) : ''}</dd>
          <dt>Amount paid</dt><dd><strong>{peso(payment.amount)}</strong></dd>
          <dt>Method</dt><dd className="cap-first">{payment.method}{payment.reference ? ` · ${payment.reference}` : ''}</dd>
          <dt>Recorded by</dt><dd>{payment.recordedBy} <SourceTag source={payment.source} /></dd>
          {visit && <><dt>Balance now</dt><dd>{peso(balance(visit, payments))}</dd></>}
        </dl>
      </div>
      <div className="row end gap no-print">
        <button className="btn" onClick={onClose}>Close</button>
        <button className="btn primary" onClick={() => window.print()}>Print</button>
      </div>
    </Modal>
  )
}
