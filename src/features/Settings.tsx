import { useRef, useState } from 'react'
import { useData } from '../core/DataContext.tsx'
import type { ClinicConfig, DataSnapshot } from '../core/types.ts'
import { download } from '../ui/csv.ts'
import { Card, Field, Modal, PageHeader, Tabs } from '../ui/kit.tsx'

type Tab = 'clinic' | 'services' | 'payments' | 'data'

export default function Settings() {
  const { config, saveConfig, toast, resetDemo, clearAll, snapshot, importSnapshot } = useData()
  const [tab, setTab] = useState<Tab>('clinic')
  const [d, setD] = useState<ClinicConfig>(structuredClone(config))
  const [confirm, setConfirm] = useState<'reset' | 'clear' | null>(null)
  const file = useRef<HTMLInputElement>(null)
  const dirty = JSON.stringify(d) !== JSON.stringify(config)
  const save = () => { saveConfig(d); toast('Settings saved') }

  const backup = () => download(`clinic-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(snapshot(), null, 2), 'application/json')
  const restore = async (f?: File) => {
    if (!f) return
    try {
      const s = JSON.parse(await f.text()) as DataSnapshot
      if (!Array.isArray(s.patients) || !Array.isArray(s.visits) || !Array.isArray(s.payments)) throw new Error('shape')
      importSnapshot(s)
      toast('Backup restored')
    } catch { toast('That file is not a valid backup.', 'error') }
  }

  return (
    <>
      <PageHeader title="Settings" sub="Every name, fee and rule here is data: change it per clinic with no code changes.">
        {dirty && <button className="btn primary" onClick={save}>Save changes</button>}
      </PageHeader>
      <Tabs<Tab> tabs={[{ id: 'clinic', label: 'Clinic' }, { id: 'services', label: 'Services & doctors' }, { id: 'payments', label: 'Payments & features' }, { id: 'data', label: 'Data' }]} value={tab} onChange={setTab} />

      {tab === 'clinic' && (
        <Card title="Clinic profile">
          <div className="grid">
            <Field label="Clinic name"><input value={d.clinic.name} onChange={(e) => setD({ ...d, clinic: { ...d.clinic, name: e.target.value } })} /></Field>
            <Field label="Short name"><input value={d.clinic.shortName} onChange={(e) => setD({ ...d, clinic: { ...d.clinic, shortName: e.target.value } })} /></Field>
            <Field label="Tagline" span="all"><input value={d.clinic.tagline} onChange={(e) => setD({ ...d, clinic: { ...d.clinic, tagline: e.target.value } })} /></Field>
            <Field label="Address"><input value={d.clinic.address} onChange={(e) => setD({ ...d, clinic: { ...d.clinic, address: e.target.value } })} /></Field>
            <Field label="Phone"><input value={d.clinic.phone} onChange={(e) => setD({ ...d, clinic: { ...d.clinic, phone: e.target.value } })} /></Field>
          </div>
        </Card>
      )}

      {tab === 'services' && (
        <>
          <Card title="Services" actions={<button className="btn sm" onClick={() => setD({ ...d, services: [...d.services, { id: `svc-${Date.now().toString(36)}`, name: 'New service', fee: 0, color: '#0f7c7a' }] })}>Add service</button>}>
            <div className="stack">
              {d.services.map((s, i) => (
                <div key={s.id} className="edit-row">
                  <div className="grid">
                    <Field label="Name"><input value={s.name} onChange={(e) => setD({ ...d, services: d.services.map((x, n) => (n === i ? { ...x, name: e.target.value } : x)) })} /></Field>
                    <Field label="Default fee (₱)"><input type="number" min="0" value={s.fee} onChange={(e) => setD({ ...d, services: d.services.map((x, n) => (n === i ? { ...x, fee: Number(e.target.value) } : x)) })} /></Field>
                    <Field label="Colour"><input type="color" value={s.color} onChange={(e) => setD({ ...d, services: d.services.map((x, n) => (n === i ? { ...x, color: e.target.value } : x)) })} /></Field>
                  </div>
                  {d.services.length > 1 && <div className="row end"><button className="btn sm danger" onClick={() => setD({ ...d, services: d.services.filter((_, n) => n !== i) })}>Remove</button></div>}
                </div>
              ))}
            </div>
          </Card>
          <Card title="Doctors" actions={<button className="btn sm" onClick={() => setD({ ...d, doctors: [...d.doctors, { id: `doc-${Date.now().toString(36)}`, name: 'Dr. New', serviceId: d.services[0].id }] })}>Add doctor</button>}>
            <div className="stack">
              {d.doctors.map((x, i) => (
                <div key={x.id} className="edit-row">
                  <div className="grid">
                    <Field label="Name"><input value={x.name} onChange={(e) => setD({ ...d, doctors: d.doctors.map((y, n) => (n === i ? { ...y, name: e.target.value } : y)) })} /></Field>
                    <Field label="Main service">
                      <select value={x.serviceId} onChange={(e) => setD({ ...d, doctors: d.doctors.map((y, n) => (n === i ? { ...y, serviceId: e.target.value } : y)) })}>
                        {d.services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </Field>
                  </div>
                  {d.doctors.length > 1 && <div className="row end"><button className="btn sm danger" onClick={() => setD({ ...d, doctors: d.doctors.filter((_, n) => n !== i) })}>Remove</button></div>}
                </div>
              ))}
            </div>
            <p className="muted small">Removing a service or doctor keeps old bookings; they just show a blank name.</p>
          </Card>
        </>
      )}

      {tab === 'payments' && (
        <Card title="Payments and optional features">
          <div className="stack">
            <h3 style={{ margin: 0 }}>Payment methods</h3>
            <div className="chips">
              {d.methods.map((m) => (
                <label key={m.id} className="check-row">
                  <input type="checkbox" checked={m.enabled} disabled={m.id === 'cash'} onChange={(e) => setD({ ...d, methods: d.methods.map((x) => (x.id === m.id ? { ...x, enabled: e.target.checked } : x)) })} /> {m.label}
                </label>
              ))}
            </div>
            <label className="check-row"><input type="checkbox" checked={d.onlinePayments} onChange={(e) => setD({ ...d, onlinePayments: e.target.checked })} /> Offer online payment links (optional upgrade; cash always works)</label>
            <label className="check-row"><input type="checkbox" checked={d.bookingLink} onChange={(e) => setD({ ...d, bookingLink: e.target.checked })} /> Patient booking page (patients request a slot online, staff confirm)</label>
            <Field label="Grace days before a visit counts as unpaid" hint="0 means unpaid as soon as the visit has happened."><input type="number" min="0" max="30" value={d.graceDays} onChange={(e) => setD({ ...d, graceDays: Math.max(0, Number(e.target.value)) })} style={{ maxWidth: 140 }} /></Field>
          </div>
        </Card>
      )}

      {tab === 'data' && (
        <Card title="Data">
          <div className="stack">
            <p className="muted">Demo data lives in this browser only. In the real system it is stored in a protected database with an audit trail and nightly backups.</p>
            <div className="row gap wrap">
              <button className="btn" onClick={backup}>Download backup (JSON)</button>
              <button className="btn" onClick={() => file.current?.click()}>Restore from backup</button>
              <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => { restore(e.target.files?.[0]); e.target.value = '' }} />
              <button className="btn" onClick={() => setConfirm('reset')}>Reset demo data</button>
              <button className="btn danger" onClick={() => setConfirm('clear')}>Clear all data</button>
            </div>
          </div>
        </Card>
      )}

      {confirm && (
        <Modal title={confirm === 'reset' ? 'Reset demo data?' : 'Clear all data?'} onClose={() => setConfirm(null)}>
          <div className="stack">
            <p>{confirm === 'reset' ? 'This replaces everything with fresh sample data.' : 'This removes every patient, booking and payment from this browser. It cannot be undone (download a backup first).'}</p>
            <div className="row end gap">
              <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
              <button className="btn danger" onClick={() => { if (confirm === 'reset') resetDemo(); else clearAll(); setConfirm(null) }}>{confirm === 'reset' ? 'Reset' : 'Clear everything'}</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
