import { useMemo, useState } from 'react'
import { useData } from '../core/DataContext.tsx'
import { addDays, ageBucket, collections, daysBetween, peso, shortDate, todayIso, unpaidList } from '../core/logic.ts'
import { Columns, Donut } from '../ui/charts.tsx'
import { Card, PageHeader, Stat, Tabs } from '../ui/kit.tsx'

const METHOD_COLORS: Record<string, string> = { cash: '#0f7c7a', gcash: '#4f46e5', bank: '#c96f12', card: '#7c3aed' }

export default function Reports() {
  const { visits, payments, patients, contacts, config } = useData()
  const today = todayIso()
  const [days, setDays] = useState<'7' | '14' | '30'>('14')
  const from = addDays(today, -(Number(days) - 1))

  const series = useMemo(() => {
    const out: { label: string; value: number }[] = []
    for (let i = Number(days) - 1; i >= 0; i--) {
      const d = addDays(today, -i)
      out.push({ label: shortDate(d).replace(/^\w+ /, ''), value: Math.round(collections(payments, d, d).total) })
    }
    return out
  }, [payments, days, today])

  const range = collections(payments, from, today)
  const methodSlices = Object.entries(range.byMethod).map(([m, v]) => ({ label: config.methods.find((x) => x.id === m)?.label ?? m, value: v, color: METHOD_COLORS[m] ?? '#888' }))

  const inRange = visits.filter((v) => v.date >= from && v.date <= today)
  const noShow = inRange.filter((v) => v.status === 'noshow').length
  const held = inRange.filter((v) => v.status === 'done' || v.status === 'arrived' || v.status === 'noshow').length
  const unpaid = unpaidList({ visits, payments, patients, contacts }, today, config.graceDays)
  const aging = (['0-7', '8-30', '31+'] as const).map((b) => ({ label: b === '31+' ? 'Over 30 days' : `${b} days`, value: Math.round(unpaid.filter((r) => ageBucket(r.daysOwed) === b).reduce((n, r) => n + r.balance, 0)) }))
  const bySvc = config.services.map((s) => ({
    label: s.name, color: s.color,
    value: payments.filter((p) => !p.voided && p.recordedAt.slice(0, 10) >= from && visits.find((v) => v.id === p.visitId)?.serviceId === s.id).reduce((n, p) => n + p.amount, 0),
  }))

  // payment-to-visible time: how quickly after the visit the payment was recorded (demo metric)
  const lags = payments.filter((p) => !p.voided && p.recordedAt.slice(0, 10) >= from).map((p) => {
    const v = visits.find((x) => x.id === p.visitId)
    return v ? Math.max(0, daysBetween(v.date, p.recordedAt.slice(0, 10))) : 0
  })
  const sameDay = lags.length ? Math.round((lags.filter((d) => d === 0).length / lags.length) * 100) : 0
  const bySource = Object.entries(payments.filter((p) => !p.voided && p.recordedAt.slice(0, 10) >= from).reduce<Record<string, number>>((m, p) => { m[p.source] = (m[p.source] ?? 0) + 1; return m }, {}))

  return (
    <>
      <PageHeader title="Reports" sub="The numbers that show whether the system is doing its job.">
        <Tabs<'7' | '14' | '30'> tabs={[{ id: '7', label: '7 days' }, { id: '14', label: '14 days' }, { id: '30', label: '30 days' }]} value={days} onChange={setDays} />
      </PageHeader>
      <div className="stats">
        <Stat label="Collected" value={peso(range.total)} hint={`${range.count} payments`} tone="good" />
        <Stat label="Outstanding now" value={peso(unpaid.reduce((n, r) => n + r.balance, 0))} hint={`${unpaid.length} unpaid visits`} tone="warn" />
        <Stat label="Recorded same day" value={`${sameDay}%`} hint="payments logged on the visit date" tone="good" />
        <Stat label="No-show rate" value={held ? `${Math.round((noShow / held) * 100)}%` : '—'} hint={`${noShow} of ${held} booked visits`} />
      </div>
      <div className="cols">
        <Card title="Collections per day (₱)"><Columns data={series} unit=" ₱" /></Card>
        <Card title="By payment method"><Donut data={methodSlices} center={peso(range.total)} sub="collected" /></Card>
      </div>
      <div className="cols">
        <Card title="Unpaid balances by age (₱)"><Columns data={aging} unit=" ₱" /></Card>
        <Card title="Collected by service"><Donut data={bySvc.filter((x) => x.value > 0)} center={String(bySvc.filter((x) => x.value > 0).length)} sub="services" /></Card>
      </div>
      <Card title="How payments reached the ledger">
        <ul className="plain">
          {bySource.map(([s, n]) => <li key={s} className="row between"><span className="cap-first">{s === 'manual' ? 'Desk entry' : s === 'doctor-tap' ? 'Doctor tap' : s === 'agent-confirmed' ? 'AI match, confirmed by staff' : 'Online (verified)'}</span><strong>{n}</strong></li>)}
        </ul>
      </Card>
    </>
  )
}
