import { useMemo, useState } from 'react'
import { useData } from '../core/DataContext.tsx'
import { addDays, collections, dateOfStamp, fullName, peso, prettyDate, todayIso } from '../core/logic.ts'
import type { Payment } from '../core/types.ts'
import { downloadCsv } from '../ui/csv.ts'
import { Card, Empty, Field, Modal, PageHeader, SourceTag, Stat } from '../ui/kit.tsx'
import { ReceiptModal } from './PaymentParts.tsx'

function VoidModal({ payment, onClose }: { payment: Payment; onClose(): void }) {
  const { voidPayment, toast } = useData()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const go = () => {
    const res = voidPayment(payment.id, reason)
    if (!res.ok) return setError(res.error)
    toast(`${payment.receiptNo} voided`)
    onClose()
  }
  return (
    <Modal title={`Void ${payment.receiptNo}`} onClose={onClose}>
      <div className="stack">
        <p>This removes <strong>{peso(payment.amount)}</strong> from the visit’s paid total. The record stays in the ledger as voided.</p>
        <Field label="Reason (required)" error={error || undefined}><input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
        <div className="row end gap"><button className="btn" onClick={onClose}>Cancel</button><button className="btn danger" onClick={go}>Void payment</button></div>
      </div>
    </Modal>
  )
}

export default function PaymentsLedger() {
  const { payments, visits, patients, config, can } = useData()
  const today = todayIso()
  const [from, setFrom] = useState(addDays(today, -6))
  const [to, setTo] = useState(today)
  const [method, setMethod] = useState('all')
  const [source, setSource] = useState('all')
  const [receipt, setReceipt] = useState<Payment | null>(null)
  const [voiding, setVoiding] = useState<Payment | null>(null)

  const rows = useMemo(
    () => payments.filter((p) => dateOfStamp(p.recordedAt) >= from && dateOfStamp(p.recordedAt) <= to && (method === 'all' || p.method === method) && (source === 'all' || p.source === source))
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
    [payments, from, to, method, source],
  )
  const live = rows.filter((p) => !p.voided)
  const todayTotal = collections(payments, today, today)
  const range = collections(payments, from, to)
  const who = (p: Payment) => {
    const v = visits.find((x) => x.id === p.visitId)
    const pat = patients.find((x) => x.id === v?.patientId)
    return { visit: v, patient: pat, service: config.services.find((s) => s.id === v?.serviceId) }
  }
  const label = (id: string) => config.methods.find((m) => m.id === id)?.label ?? id

  return (
    <>
      <PageHeader title="Payments" sub="Every peso, recorded once with who took it and how. Today’s close-out is below.">
        <button className="btn" onClick={() => downloadCsv(`payments-${from}-to-${to}.csv`, ['Receipt', 'Date', 'Patient', 'Service', 'Amount', 'Method', 'Reference', 'Source', 'Recorded by', 'Void'],
          rows.map((p) => { const w = who(p); return [p.receiptNo, p.recordedAt, w.patient ? fullName(w.patient) : '', w.service?.name ?? '', p.amount, p.method, p.reference, p.source, p.recordedBy, p.voided ? p.voidReason : ''] }))}>Export CSV</button>
      </PageHeader>
      <div className="stats">
        <Stat label="Collected today" value={peso(todayTotal.total)} hint={`${todayTotal.count} payments`} tone="good" />
        {Object.entries(todayTotal.byMethod).map(([m, amt]) => <Stat key={m} label={`Today: ${label(m)}`} value={peso(amt)} />)}
      </div>
      <Card pad={false}>
        <div className="filters">
          <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Method">
            <option value="all">Any method</option>
            {config.methods.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
            <option value="all">Any source</option>
            <option value="manual">Desk entry</option><option value="doctor-tap">Doctor tap</option><option value="agent-confirmed">AI match, confirmed</option><option value="online">Online (verified)</option>
          </select>
          <span className="muted small grow right">{live.length} payments · <strong>{peso(range.total)}</strong> in this range</span>
        </div>
        {rows.length === 0 ? <Empty title="No payments in this range." /> : (
          <div className="table-wrap">
            <table className="table hover compact">
              <thead><tr><th>Receipt</th><th>When</th><th>Patient</th><th className="right">Amount</th><th>Method</th><th>Source</th><th>Recorded by</th><th className="right">Actions</th></tr></thead>
              <tbody>
                {rows.slice(0, 200).map((p) => {
                  const w = who(p)
                  return (
                    <tr key={p.id} className={p.voided ? 'voided' : ''}>
                      <td><strong>{p.receiptNo}</strong></td>
                      <td>{prettyDate(dateOfStamp(p.recordedAt))}<div className="muted small">{new Date(p.recordedAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}</div></td>
                      <td>{w.patient ? fullName(w.patient) : '—'}<div className="muted small">{w.service?.name}</div></td>
                      <td className="right amount">{peso(p.amount)}</td>
                      <td className="cap-first">{label(p.method)}{p.reference && <div className="muted small">{p.reference}</div>}</td>
                      <td><SourceTag source={p.source} /></td>
                      <td>{p.recordedBy}{p.voided && <div className="small danger-text">Voided: {p.voidReason}</div>}</td>
                      <td><div className="row-actions">
                        <button className="btn sm ghost" onClick={() => setReceipt(p)}>Receipt</button>
                        {can('payments.void') && !p.voided && <button className="btn sm danger" onClick={() => setVoiding(p)}>Void</button>}
                      </div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {receipt && <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />}
      {voiding && <VoidModal payment={voiding} onClose={() => setVoiding(null)} />}
    </>
  )
}
