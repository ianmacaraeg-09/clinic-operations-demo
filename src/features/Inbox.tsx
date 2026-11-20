import { useMemo, useState } from 'react'
import { useData } from '../core/DataContext.tsx'
import { balance, confidenceLabel, fullName, peso, prettyDate, todayIso, unpaidList } from '../core/logic.ts'
import type { PaymentMethod, Proposal } from '../core/types.ts'
import { Card, Field, PageHeader, Tabs } from '../ui/kit.tsx'

function ProposalCard({ p }: { p: Proposal }) {
  const { patients, visits, payments, contacts, config, confirmProposal, rejectProposal, toast } = useData()
  const today = todayIso()
  const patient = patients.find((x) => x.id === p.patientId)
  // The reviewer may correct the visit, amount and method before confirming.
  const open = useMemo(() => unpaidList({ visits, payments, patients, contacts }, today), [visits, payments, patients, contacts, today])
  const [visitId, setVisitId] = useState(p.visitId ?? '')
  const [amount, setAmount] = useState(String(p.amount ?? ''))
  const [method, setMethod] = useState<PaymentMethod>(p.method ?? 'cash')
  const [error, setError] = useState('')
  const visit = visits.find((v) => v.id === visitId)
  const lvl = confidenceLabel(p.confidence)
  const pending = p.status === 'pending'

  const options = open.filter((r) => !patient || r.patient.id === patient.id || r.visit.id === visitId)
  const confirm = () => {
    setError('')
    if (!visitId) return setError('Choose which visit this payment is for.')
    const res = confirmProposal(p.id, { visitId, amount: Number(amount), method, reference: p.reference })
    if (!res.ok) return setError(res.error)
    toast(`Confirmed. ${peso(res.value.amount)} recorded (${res.value.receiptNo}).`)
  }

  return (
    <div className={`proposal ${pending ? '' : 'done'}`}>
      <div className="proposal-msg">
        <span className="pill warn" style={{ background: '#ece8ff', color: '#4338ca' }}>{p.channel === 'screenshot' ? 'Screenshot' : 'Message'}</span>
        <q>{p.raw}</q>
        <span className="muted small">{new Date(p.receivedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</span>
      </div>
      <div className="proposal-body">
        <div>
          <strong>What the assistant understood</strong>
          <div className={`conf ${lvl}`}>
            <div className="bar"><span className={lvl === 'high' ? 'good' : lvl === 'medium' ? 'warn' : 'bad'} style={{ width: `${p.confidence * 100}%` }} /></div>
            {Math.round(p.confidence * 100)}% sure ({lvl})
          </div>
          {p.reasons.length > 0 && <ul className="reasons">{p.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
          {p.warnings.length > 0 && <ul className="reasons warn">{p.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
        </div>
        <div>
          {pending ? (
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Field label="For which visit?" span="all">
                <select value={visitId} onChange={(e) => { setVisitId(e.target.value); const v = visits.find((x) => x.id === e.target.value); if (v && !p.amount) setAmount(String(balance(v, payments))) }}>
                  <option value="">— choose —</option>
                  {options.map((r) => <option key={r.visit.id} value={r.visit.id}>{fullName(r.patient)} · {prettyDate(r.visit.date)} · owes {peso(r.balance)}</option>)}
                  {visit && !options.some((r) => r.visit.id === visit.id) && <option value={visit.id}>{prettyDate(visit.date)}</option>}
                </select>
              </Field>
              <Field label="Amount (₱)"><input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
              <Field label="Paid by">
                <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  {config.methods.filter((m) => m.enabled).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </Field>
              {p.reference && <p className="muted small span-all">Reference: {p.reference}</p>}
              {error && <div className="alert error span-all">{error}</div>}
            </div>
          ) : (
            <p><strong>{p.status === 'confirmed' ? 'Confirmed' : 'Rejected'}</strong> by {p.decidedBy}. {patient && p.status === 'confirmed' ? `Recorded for ${fullName(patient)}.` : ''}</p>
          )}
        </div>
      </div>
      {pending && (
        <div className="proposal-actions">
          <button className="btn good" onClick={confirm}>Confirm and record payment</button>
          <button className="btn" onClick={() => { rejectProposal(p.id); toast('Rejected: nothing was recorded') }}>Reject</button>
          <span className="muted small">Nothing is recorded until you confirm.</span>
        </div>
      )}
    </div>
  )
}

export default function Inbox() {
  const { proposals, submitMessage, toast, visits, payments, patients, contacts } = useData()
  // Example messages are built from real unpaid visits so the demo always has an answer to find.
  const examples = useMemo(() => {
    const rows = unpaidList({ visits, payments, patients, contacts }, todayIso())
    const single = rows.filter((r) => rows.filter((x) => x.patient.id === r.patient.id).length === 1)
    const out: string[] = []
    if (single[2]) out.push(`Good day po, ${single[2].patient.firstName} ${single[2].patient.lastName} here. Nag-gcash na po ako ₱${single[2].balance}. Ref no. 7741${single[2].balance}09`)
    if (single[3]) out.push(`${single[3].patient.lastName} paid ${single[3].balance} via bank transfer, reference BDO5598123`)
    if (single[4]) out.push(`Sent na po ${single[4].balance} sa gcash, paki-check po`)
    return out.length ? out : ['Good day po, [patient name] here. Nag-gcash na po ako ₱500. Ref no. 7741000001']
  }, [visits, payments, patients, contacts])
  const [tab, setTab] = useState<'pending' | 'done'>('pending')
  const [raw, setRaw] = useState('')
  const pending = proposals.filter((p) => p.status === 'pending')
  const done = proposals.filter((p) => p.status !== 'pending')
  const shown = tab === 'pending' ? pending : done

  const send = (channel: Proposal['channel']) => {
    if (!raw.trim()) return toast('Paste a payment message first.', 'error')
    submitMessage(raw.trim(), channel)
    setRaw('')
    setTab('pending')
    toast('Message read: review the proposal below')
  }

  return (
    <>
      <PageHeader title="Payment inbox" sub="The payments assistant reads incoming payment messages and proposes a match. A person confirms." />
      <div className="callout info">
        <div><strong>Demo: simulated recognition</strong>This demo uses simple built-in matching to show the flow. In the real system a DOVA payments agent reads messages and receipt photos. Either way it only proposes; it never records a payment by itself.</div>
      </div>
      <Card title="Simulate an incoming payment message">
        <div className="stack">
          <Field label="Paste or type a message a patient might send">
            <textarea rows={3} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="Paste a message, or tap one of the examples below" />
          </Field>
          <div className="chips">
            <span className="muted small">Try an example:</span>
            {examples.map((x) => <button key={x} className="chip" onClick={() => setRaw(x)}>{x.slice(0, 42)}…</button>)}
          </div>
          <div className="row gap">
            <button className="btn primary" onClick={() => send('message')}>Read as a message</button>
            <button className="btn" onClick={() => send('screenshot')}>Read as a receipt photo</button>
          </div>
        </div>
      </Card>
      <Tabs<'pending' | 'done'> tabs={[{ id: 'pending', label: `Waiting (${pending.length})` }, { id: 'done', label: `Handled (${done.length})` }]} value={tab} onChange={setTab} />
      <div className="inbox">
        {shown.length === 0 && <Card><p className="muted center">{tab === 'pending' ? 'Nothing waiting. Simulate a message above.' : 'Nothing handled yet.'}</p></Card>}
        {shown.map((p) => <ProposalCard key={p.id} p={p} />)}
      </div>
    </>
  )
}
