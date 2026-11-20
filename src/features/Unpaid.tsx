import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../core/DataContext.tsx'
import { ageBucket, fullName, peso, prettyDate, reminderText, shortDate, todayIso, unpaidList, type AgeBucket, type UnpaidRow } from '../core/logic.ts'
import type { Contact } from '../core/types.ts'
import { downloadCsv } from '../ui/csv.ts'
import { Card, Empty, Field, Modal, PageHeader, Stat } from '../ui/kit.tsx'
import { RecordPaymentModal } from './PaymentParts.tsx'

type Filter = 'all' | AgeBucket | 'new'

function ContactModal({ row, onClose }: { row: UnpaidRow; onClose(): void }) {
  const { config, logContact, toast } = useData()
  const [channel, setChannel] = useState<Contact['channel']>('sms')
  const [note, setNote] = useState('')
  const [promised, setPromised] = useState('')
  const text = reminderText(config, row)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast('Message copied') } catch { toast('Copy is blocked here. Select the text and copy it.', 'error') }
  }
  const save = () => { logContact({ visitId: row.visit.id, channel, note: note.trim(), promisedDate: promised }); toast('Contact logged'); onClose() }
  return (
    <Modal title={`Reach out: ${fullName(row.patient)}`} onClose={onClose} wide>
      <div className="stack">
        <div className="action-bar">
          <div className="grow"><strong>{peso(row.balance)} owed</strong><div className="muted small">{prettyDate(row.visit.date)} · {row.daysOwed} days ago · {row.patient.phone}</div></div>
        </div>
        <Field label="Drafted reminder (by the follow-up assistant: staff review and send)">
          <textarea rows={4} defaultValue={text} readOnly />
        </Field>
        <div className="row gap">
          <button className="btn" onClick={copy}>Copy message</button>
          <a className="btn" href={`tel:${row.patient.phone}`}>Call</a>
        </div>
        <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
        <h3 style={{ margin: 0 }}>Log what happened</h3>
        <div className="grid">
          <Field label="How did you reach them?">
            <select value={channel} onChange={(e) => setChannel(e.target.value as Contact['channel'])}>
              <option value="sms">Text message</option><option value="viber">Viber / Messenger</option><option value="call">Phone call</option><option value="in-person">In person</option>
            </select>
          </Field>
          <Field label="Promised to pay by (optional)"><input type="date" value={promised} onChange={(e) => setPromised(e.target.value)} /></Field>
          <Field label="Note" span="all"><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Will pay on next visit" /></Field>
        </div>
        <div className="row end gap">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={save}>Save contact</button>
        </div>
      </div>
    </Modal>
  )
}

export default function Unpaid() {
  const { visits, payments, patients, contacts, config, can } = useData()
  const today = todayIso()
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [contact, setContact] = useState<UnpaidRow | null>(null)
  const [pay, setPay] = useState<UnpaidRow | null>(null)

  const all = useMemo(() => unpaidList({ visits, payments, patients, contacts }, today, config.graceDays), [visits, payments, patients, contacts, today, config.graceDays])
  const counts = { all: all.length, '0-7': 0, '8-30': 0, '31+': 0, new: 0 } as Record<Filter, number>
  for (const r of all) { counts[ageBucket(r.daysOwed)]++; if (!r.lastContact) counts.new++ }
  const rows = all.filter((r) => (filter === 'all' ? true : filter === 'new' ? !r.lastContact : ageBucket(r.daysOwed) === filter) && (!q.trim() || `${fullName(r.patient)} ${r.patient.patientNo}`.toLowerCase().includes(q.trim().toLowerCase())))
  const total = all.reduce((n, r) => n + r.balance, 0)
  const promisedDue = all.filter((r) => r.promisedDate && r.promisedDate <= today).length

  const chips: { id: Filter; label: string }[] = [
    { id: 'all', label: 'All' }, { id: 'new', label: 'Not yet contacted' }, { id: '0-7', label: 'Up to 7 days' }, { id: '8-30', label: '8–30 days' }, { id: '31+', label: 'Over 30 days' },
  ]

  return (
    <>
      <PageHeader title="Unpaid list" sub="Built automatically from the ledger. Pay a visit and it drops off the list.">
        <button className="btn" onClick={() => downloadCsv(`unpaid-${today}.csv`, ['Patient', 'Phone', 'Visit date', 'Charge', 'Paid', 'Balance', 'Days owed', 'Last contact', 'Promised date'],
          rows.map((r) => [fullName(r.patient), r.patient.phone, r.visit.date, r.due, r.paid, r.balance, r.daysOwed, r.lastContact ? `${r.lastContact.channel}: ${r.lastContact.note}` : '', r.promisedDate]))}>Export CSV</button>
      </PageHeader>
      <div className="stats">
        <Stat label="Total outstanding" value={peso(total)} tone={total > 0 ? 'bad' : 'good'} />
        <Stat label="Unpaid visits" value={all.length} hint={`${new Set(all.map((r) => r.patient.id)).size} patients`} tone="warn" />
        <Stat label="Oldest balance" value={all[0] ? `${all[0].daysOwed} days` : '—'} hint={all[0] ? fullName(all[0].patient) : 'Nothing owed'} />
        <Stat label="Promised dates due" value={promisedDue} hint="promised to pay by today" tone={promisedDue ? 'warn' : undefined} />
      </div>
      <div className="callout info"><div><strong>Reaching out stays with your staff.</strong>The follow-up assistant only drafts the reminder. Staff review it, send it and log the result.</div></div>
      <Card pad={false}>
        <div className="quick">
          {chips.map((c) => <button key={c.id} className={`chip ${filter === c.id ? 'on' : ''}`} onClick={() => setFilter(c.id)}>{c.label}<b>{counts[c.id]}</b></button>)}
        </div>
        <div className="filters">
          <input type="search" placeholder="Search patient…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search unpaid" />
        </div>
        {rows.length === 0 ? <Empty title={all.length === 0 ? 'Everyone has paid. 🎉' : 'No one matches this filter.'} /> : (
          <div className="table-wrap">
            <table className="table hover">
              <thead>
                <tr><th>Patient</th><th>Visit</th><th className="right">Balance</th><th>Owed for</th><th>Last contact</th><th>Promised</th><th className="right">Actions</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const svc = config.services.find((s) => s.id === r.visit.serviceId)
                  const overdue = r.promisedDate && r.promisedDate < today
                  return (
                    <tr key={r.visit.id}>
                      <td><Link to={`/app/patients/${r.patient.id}`}><strong>{fullName(r.patient)}</strong></Link><div className="muted small">{r.patient.phone}</div></td>
                      <td>{svc?.name}<div className="muted small">{shortDate(r.visit.date)}</div></td>
                      <td className="right"><div className="amount danger-text">{peso(r.balance)}</div>{r.paid > 0 && <div className="muted small">paid {peso(r.paid)} of {peso(r.due)}</div>}</td>
                      <td><span className={`pill ${r.daysOwed > 30 ? 'bad' : r.daysOwed > 7 ? 'warn' : 'good'}`}>{r.daysOwed === 0 ? 'today' : `${r.daysOwed} day${r.daysOwed === 1 ? '' : 's'}`}</span></td>
                      <td>{r.lastContact ? <><span className="cap-first">{r.lastContact.channel}</span> · {shortDate(r.lastContact.at.slice(0, 10))}<div className="muted small">{r.lastContact.note}</div></> : <span className="muted">Not yet</span>}</td>
                      <td>{r.promisedDate ? <span className={overdue ? 'danger-text' : ''}>{shortDate(r.promisedDate)}{overdue ? ' (passed)' : ''}</span> : <span className="muted">—</span>}</td>
                      <td><div className="row-actions">
                        <button className="btn sm" onClick={() => setContact(r)}>Reach out</button>
                        {can('payments.record') && <button className="btn sm good" onClick={() => setPay(r)}>Pay</button>}
                      </div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {contact && <ContactModal row={contact} onClose={() => setContact(null)} />}
      {pay && <RecordPaymentModal visit={pay.visit} onClose={() => setPay(null)} />}
    </>
  )
}
