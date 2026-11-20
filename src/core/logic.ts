import type {
  ClinicConfig, Contact, DataSnapshot, Patient, PayStatus, Payment, PaymentMethod, Proposal, Visit, VisitStatus,
} from './types.ts'

/* ---------- money & dates ---------- */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
export const peso = (n: number) =>
  '₱' + round2(n).toLocaleString('en-PH', { minimumFractionDigits: Number.isInteger(round2(n)) ? 0 : 2, maximumFractionDigits: 2 })

export const pad = (n: number) => String(n).padStart(2, '0')
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayIso = () => isoDate(new Date())
export const addDays = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  return isoDate(new Date(y, m - 1, d + days))
}
/** Whole days from `from` to `to` (to - from). */
export const daysBetween = (from: string, to: string) => {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}
export const prettyDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}
export const shortDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}
export const prettyTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`
}
export const stamp = (d = new Date()) => d.toISOString()
export const dateOfStamp = (s: string) => isoDate(new Date(s))

export const fullName = (p: Pick<Patient, 'firstName' | 'lastName'>) => `${p.firstName} ${p.lastName}`.trim()
export const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`

/* ---------- ledger: one source of truth for "has this patient paid?" ---------- */
export const charge = (v: Pick<Visit, 'fee' | 'discount'>) => Math.max(0, round2(v.fee - v.discount))

export function paidAmount(visitId: string, payments: Payment[]): number {
  return round2(payments.filter((p) => p.visitId === visitId && !p.voided).reduce((n, p) => n + p.amount, 0))
}

export function balance(v: Visit, payments: Payment[]): number {
  return Math.max(0, round2(charge(v) - paidAmount(v.id, payments)))
}

export function payStatus(v: Visit, payments: Payment[]): PayStatus {
  const due = charge(v)
  if (due === 0) return 'free'
  const paid = paidAmount(v.id, payments)
  if (paid <= 0) return 'unpaid'
  return paid + 0.004 >= due ? 'paid' : 'partial'
}

/** Visits that count as owed money: held, happened or no-show are chargeable; cancelled/requested are not. */
export const owes = (v: Visit) => v.status === 'arrived' || v.status === 'done' || v.status === 'noshow' || v.status === 'booked'

export interface UnpaidRow {
  visit: Visit
  patient: Patient
  due: number
  paid: number
  balance: number
  daysOwed: number
  lastContact: Contact | null
  promisedDate: string
  status: PayStatus
}

/**
 * The automatic list of unpaid patients. Only visits whose date has been reached (today or earlier)
 * count; future bookings are not "owed" yet. Sorted: oldest first, then largest balance.
 */
export function unpaidList(s: Pick<DataSnapshot, 'visits' | 'payments' | 'patients' | 'contacts'>, today: string, graceDays = 0): UnpaidRow[] {
  const byPatient = new Map(s.patients.map((p) => [p.id, p]))
  const rows: UnpaidRow[] = []
  for (const v of s.visits) {
    if (!owes(v) || v.date > today) continue
    if (v.status === 'booked' && v.date === today) continue // still to come today
    const patient = byPatient.get(v.patientId)
    if (!patient) continue
    const st = payStatus(v, s.payments)
    if (st === 'paid' || st === 'free') continue
    const daysOwed = Math.max(0, daysBetween(v.date, today))
    if (daysOwed < graceDays) continue
    const contacts = s.contacts.filter((c) => c.visitId === v.id).sort((a, b) => b.at.localeCompare(a.at))
    const lastContact = contacts[0] ?? null
    rows.push({
      visit: v, patient, due: charge(v), paid: paidAmount(v.id, s.payments), balance: balance(v, s.payments),
      daysOwed, lastContact, promisedDate: lastContact?.promisedDate ?? '', status: st,
    })
  }
  return rows.sort((a, b) => b.daysOwed - a.daysOwed || b.balance - a.balance)
}

export type AgeBucket = '0-7' | '8-30' | '31+'
export const ageBucket = (days: number): AgeBucket => (days <= 7 ? '0-7' : days <= 30 ? '8-30' : '31+')

export function reminderText(cfg: ClinicConfig, r: UnpaidRow): string {
  const svc = cfg.services.find((s) => s.id === r.visit.serviceId)?.name ?? 'your visit'
  return `Hello ${r.patient.firstName}, this is ${cfg.clinic.shortName}. Our records show a balance of ${peso(r.balance)} for ${svc} on ${shortDate(r.visit.date)}. You may pay at the clinic or reply here if you already paid. Thank you!`
}

/* ---------- payment recognition (demo heuristics; the real system uses a DOVA payments agent) ---------- */
const METHOD_WORDS: [PaymentMethod, RegExp][] = [
  ['gcash', /\b(gcash|g-cash|maya|paymaya|e-?wallet)\b/i],
  ['bank', /\b(bank|bdo|bpi|metrobank|instapay|pesonet|transfer|unionbank)\b/i],
  ['card', /\b(card|visa|mastercard|credit|debit)\b/i],
  ['cash', /\b(cash|nag-?bayad ng cash|paid in cash)\b/i],
]
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

export function parseAmount(text: string): number | null {
  const m = text.match(/(?:₱|php|p\s?|amount[: ]*|paid[: ]*)\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.([0-9]{1,2}))?/i)
  const g = m ?? text.match(/\b([0-9]{2,6})(?:\.([0-9]{1,2}))?\b/)
  if (!g) return null
  const v = Number(`${g[1].replace(/,/g, '')}${g[2] ? '.' + g[2] : ''}`)
  return Number.isFinite(v) && v > 0 ? v : null
}

export function parseReference(text: string): string {
  const m = text.match(/\b(?:ref(?:erence)?(?:\s*(?:no|#|number))?[.:#\s]*)([A-Z0-9]{6,})\b/i)
  return m ? m[1].toUpperCase() : ''
}

export function parseMethod(text: string): PaymentMethod | null {
  for (const [id, re] of METHOD_WORDS) if (re.test(text)) return id
  return null
}

export interface MatchResult {
  amount: number | null
  method: PaymentMethod | null
  reference: string
  patientId: string | null
  visitId: string | null
  confidence: number
  reasons: string[]
  warnings: string[]
}

/** Propose (never apply) a match between a payment message and an unpaid visit. */
export function recognizePayment(
  raw: string,
  s: Pick<DataSnapshot, 'visits' | 'payments' | 'patients' | 'contacts'>,
  today: string,
): MatchResult {
  const text = norm(raw)
  const amount = parseAmount(raw)
  const method = parseMethod(raw)
  const reference = parseReference(raw)
  const reasons: string[] = []
  const warnings: string[] = []

  // 1. patient by name tokens (last name weighs more than first)
  const scored = s.patients.map((p) => {
    const last = norm(p.lastName)
    const first = norm(p.firstName)
    const lastHit = !!last && text.includes(last)
    const firstHit = !!first && text.includes(first)
    let score = 0
    if (lastHit) score += 2
    if (firstHit) score += 1.5
    for (const part of first.split(' ')) if (part.length > 3 && text.includes(part)) score += 0.25
    return { p, score, lastHit, firstHit }
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score)

  const top = scored[0]
  const tied = top && scored[1] && scored[1].score >= top.score
  let patientId: string | null = top ? top.p.id : null
  if (top) {
    if (top.lastHit && top.firstHit) reasons.push(`Name “${fullName(top.p)}” found in the message`)
    else if (top.lastHit) {
      reasons.push(`Surname “${top.p.lastName}” matches ${fullName(top.p)}`)
      warnings.push('Only the surname matched: please verify it is the right patient')
    } else {
      reasons.push(`First name “${top.p.firstName}” matches ${fullName(top.p)}`)
      warnings.push('Only the first name matched: please verify it is the right patient')
    }
  } else warnings.push('No patient name recognised')
  if (tied) warnings.push(`More than one patient could match (${scored.slice(0, 3).map((x) => fullName(x.p)).join(', ')})`)

  // 2. visit: the patient's chargeable visits with a balance, preferring amount match then recency
  let visitId: string | null = null
  let candidates: Visit[] = []
  if (patientId) {
    candidates = s.visits.filter((v) => v.patientId === patientId && owes(v) && v.date <= addDays(today, 1) && balance(v, s.payments) > 0)
    candidates.sort((a, b) => b.date.localeCompare(a.date))
    const exact = amount != null ? candidates.find((v) => Math.abs(balance(v, s.payments) - amount) < 0.01) : undefined
    const pick = exact ?? candidates[0]
    if (pick) {
      visitId = pick.id
      reasons.push(`Visit on ${shortDate(pick.date)} has ${peso(balance(pick, s.payments))} outstanding`)
      if (exact) reasons.push('Amount equals the balance exactly')
      else if (amount != null) warnings.push(`Amount ${peso(amount)} differs from the balance ${peso(balance(pick, s.payments))}`)
      if (amount != null && amount > balance(pick, s.payments) + 0.01) warnings.push('Amount is more than the balance (overpayment?)')
      if (candidates.length > 1 && !exact) warnings.push(`${candidates.length} unpaid visits for this patient: check the right one`)
    } else {
      warnings.push('This patient has no unpaid visit')
    }
  }

  // 3. amount-only fallback: a single unpaid visit with exactly this balance
  if (!patientId && amount != null) {
    const same = unpaidList(s, today).filter((r) => Math.abs(r.balance - amount) < 0.01)
    if (same.length === 1) {
      patientId = same[0].patient.id
      visitId = same[0].visit.id
      reasons.push(`Only one unpaid visit has a balance of ${peso(amount)} (${fullName(same[0].patient)})`)
      warnings.push('Matched by amount only: please verify the patient')
    } else if (same.length > 1) warnings.push(`${same.length} unpaid visits have a balance of ${peso(amount)}`)
  }

  // 4. duplicate guard
  if (reference) {
    if (s.payments.some((p) => !p.voided && p.reference && p.reference === reference)) warnings.push(`Reference ${reference} is already in the ledger (possible duplicate)`)
    else reasons.push(`Reference ${reference} is new`)
  }
  if (amount == null) warnings.push('No amount found')
  if (!method) warnings.push('Payment method not stated, assumed cash')

  let confidence = 0
  if (patientId) confidence += top && !tied ? 0.4 : 0.2
  if (visitId) confidence += 0.25
  if (amount != null) confidence += 0.15
  if (visitId && amount != null && reasons.some((r) => r.startsWith('Amount equals'))) confidence += 0.15
  if (method) confidence += 0.05
  confidence -= 0.1 * Math.min(3, warnings.filter((w) => !w.startsWith('Payment method')).length)
  // A partial name match is never "high", however well the amount fits: a person must look.
  if (top && patientId === top.p.id && !(top.lastHit && top.firstHit)) confidence = Math.min(confidence, 0.74)
  confidence = Math.max(0.05, Math.min(0.99, Math.round(confidence * 100) / 100))

  return { amount, method: method ?? (amount != null ? 'cash' : null), reference, patientId, visitId, confidence, reasons, warnings }
}

export const confidenceLabel = (c: number): 'high' | 'medium' | 'low' => (c >= 0.8 ? 'high' : c >= 0.5 ? 'medium' : 'low')

export function newProposal(raw: string, channel: Proposal['channel'], s: Pick<DataSnapshot, 'visits' | 'payments' | 'patients' | 'contacts'>, today: string): Proposal {
  const m = recognizePayment(raw, s, today)
  return {
    id: uid('prop'), receivedAt: stamp(), channel, raw, amount: m.amount, method: m.method, reference: m.reference,
    patientId: m.patientId, visitId: m.visitId, confidence: m.confidence, reasons: m.reasons, warnings: m.warnings,
    status: 'pending', decidedBy: '', decidedAt: '',
  }
}

/* ---------- bookings ---------- */
export const STATUS_LABEL: Record<VisitStatus, string> = {
  requested: 'Requested', booked: 'Booked', arrived: 'Arrived', done: 'Done', noshow: 'No-show', cancelled: 'Cancelled',
}
export const PAY_LABEL: Record<PayStatus, string> = { unpaid: 'Unpaid', partial: 'Partial', paid: 'Paid', free: 'No charge' }

export const sortByTime = (a: Visit, b: Visit) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)

/** Does a slot already hold a booking for this doctor? (warn, don't block) */
export function slotTaken(visits: Visit[], doctorId: string, date: string, time: string, ignoreId?: string): boolean {
  return visits.some((v) => v.id !== ignoreId && v.doctorId === doctorId && v.date === date && v.time === time && v.status !== 'cancelled' && v.status !== 'noshow')
}

export function collections(payments: Payment[], from: string, to: string) {
  const inRange = payments.filter((p) => !p.voided && dateOfStamp(p.recordedAt) >= from && dateOfStamp(p.recordedAt) <= to)
  const byMethod: Record<string, number> = {}
  for (const p of inRange) byMethod[p.method] = round2((byMethod[p.method] ?? 0) + p.amount)
  return { total: round2(inRange.reduce((n, p) => n + p.amount, 0)), count: inRange.length, byMethod }
}
