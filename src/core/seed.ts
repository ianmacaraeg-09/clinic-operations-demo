import { defaultConfig } from '../config/clinic.config.ts'
import { addDays, charge, isoDate, newProposal, pad, round2, todayIso, unpaidList } from './logic.ts'
import type { ClinicConfig, Contact, DataSnapshot, Patient, Payment, PaymentMethod, Visit, VisitStatus } from './types.ts'

/** Small deterministic RNG so the demo looks the same every time it is reset. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST = ['Maria', 'Jose', 'Ana', 'Juan', 'Liza', 'Carlo', 'Grace', 'Mark', 'Joy', 'Paolo', 'Rica', 'Noel', 'Bea', 'Ramon', 'Cathy', 'Dennis', 'Mica', 'Arnel', 'Tina', 'Leo', 'Faith', 'Gabriel', 'Hazel', 'Ian', 'Jessa', 'Kevin', 'Lorna', 'Marvin', 'Nena', 'Oscar', 'Patricia', 'Rey', 'Sheila', 'Tomas', 'Vera', 'Wilma']
const LAST = ['Cruz', 'Reyes', 'Santos', 'Garcia', 'Bautista', 'Mendoza', 'Flores', 'Aquino', 'Villanueva', 'Ramos', 'Castillo', 'Navarro', 'Domingo', 'Pascual', 'Soriano', 'Salazar', 'Mercado', 'Tolentino', 'Dizon', 'Manalo', 'Lacson', 'Evangelista', 'Magno', 'Pineda', 'Valdez', 'Ocampo', 'Padilla', 'Roque', 'Ignacio', 'Aguilar', 'Sison', 'Cabrera', 'Lim', 'Tan', 'Uy', 'Go']
const TIMES = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00']

export function demoSnapshot(config: ClinicConfig = defaultConfig, today = todayIso()): DataSnapshot {
  const r = rng(20261115)
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)]
  const now = new Date()
  const nowHm = `${pad(now.getHours())}:${pad(now.getMinutes())}`

  const patients: Patient[] = FIRST.map((fn, i) => ({
    id: `pat-${i + 1}`,
    patientNo: `P-${String(i + 1).padStart(5, '0')}`,
    firstName: fn,
    lastName: LAST[(i * 7 + 3) % LAST.length],
    phone: `09${String(170000000 + Math.floor(r() * 99999999)).slice(0, 9)}`,
    birthdate: `${1960 + Math.floor(r() * 50)}-${pad(1 + Math.floor(r() * 12))}-${pad(1 + Math.floor(r() * 28))}`,
    createdAt: new Date(Date.now() - (60 - i) * 86_400_000).toISOString(),
  }))

  const visits: Visit[] = []
  const payments: Payment[] = []
  const contacts: Contact[] = []
  let receipt = 0
  let vn = 0

  const methods: PaymentMethod[] = ['cash', 'cash', 'cash', 'cash', 'gcash', 'gcash', 'bank']
  const pay = (v: Visit, amount: number, dateIso: string, hm: string, source: Payment['source'], method: PaymentMethod) => {
    receipt += 1
    const at = new Date(`${dateIso}T${hm}:00`)
    payments.push({
      id: `pay-${receipt}`,
      receiptNo: `OR-${String(receipt).padStart(6, '0')}`,
      visitId: v.id,
      amount: round2(amount),
      method,
      source,
      recordedBy: source === 'doctor-tap' ? config.doctors.find((d) => d.id === v.doctorId)?.name ?? 'Doctor' : 'Front desk',
      recordedAt: at.toISOString(),
      reference: method === 'cash' ? '' : `REF${1000000 + receipt * 37}`,
      voided: false,
      voidReason: '',
    })
  }

  for (let off = -24; off <= 5; off++) {
    const date = addDays(today, off)
    const dow = new Date(date + 'T12:00:00').getDay()
    if (dow === 0) continue // closed Sundays
    const count = off === 0 ? 9 : 4 + Math.floor(r() * 4)
    const taken = new Set<string>()
    for (let k = 0; k < count; k++) {
      const doc = pick(config.doctors)
      const svc = config.services.find((s) => s.id === doc.serviceId) ?? config.services[0]
      let time = pick(TIMES)
      let guard = 0
      while (taken.has(doc.id + time) && guard++ < 20) time = pick(TIMES)
      taken.add(doc.id + time)
      const patient = pick(patients)
      vn += 1
      let status: VisitStatus
      if (off < 0) status = r() < 0.04 ? 'noshow' : r() < 0.05 ? 'cancelled' : 'done'
      else if (off === 0) status = time < nowHm ? (r() < 0.8 ? 'done' : 'arrived') : 'booked'
      else status = 'booked'
      const discount = r() < 0.08 ? Math.round(svc.fee * 0.2) : 0
      const v: Visit = {
        id: `vis-${vn}`, patientId: patient.id, doctorId: doc.id, serviceId: svc.id, date, time, status,
        fee: svc.fee, discount, note: '', bookedVia: pick(['phone', 'phone', 'desk', 'doctor', 'online'] as const),
        createdAt: new Date(new Date(date + 'T08:00:00').getTime() - 2 * 86_400_000).toISOString(),
      }
      visits.push(v)

      if (status === 'done' || status === 'arrived') {
        const due = charge(v)
        const roll = r()
        const hm = `${pad(Math.min(18, parseInt(time) + 1))}:${time.slice(3)}`
        const method = pick(methods)
        const recent = off >= -2
        const unpaidChance = recent ? 0.22 : 0.1
        if (roll < unpaidChance) {
          // unpaid: leave it; older ones get a follow-up note
          if (off <= -3 && r() < 0.6) {
            contacts.push({
              id: `con-${v.id}`, visitId: v.id, at: new Date(new Date(addDays(date, 2) + 'T10:00:00')).toISOString(), by: 'Front desk',
              channel: pick(['call', 'sms', 'viber'] as const), note: pick(['No answer, will retry', 'Says will pay on next visit', 'Promised to pay this week', 'Asked for a reminder message']),
              promisedDate: r() < 0.5 ? addDays(today, 1 + Math.floor(r() * 4)) : '',
            })
          }
        } else if (roll < unpaidChance + 0.06 && due > 100) {
          pay(v, Math.round(due * 0.5), date, hm, 'manual', method === 'bank' ? 'cash' : method)
        } else {
          pay(v, due, date, hm, method === 'cash' && r() < 0.5 ? 'doctor-tap' : 'manual', method)
        }
      }
    }
  }

  const snap: DataSnapshot = {
    patients, visits, payments, contacts, proposals: [], settings: null,
    counters: { patient: patients.length, receipt }, seeded: true,
  }

  // A few messages waiting in the payment-recognition inbox.
  // Pick patients with exactly one unpaid visit so each demo message has one clear answer.
  const owed = unpaidList({ visits, payments, patients, contacts }, today)
  const singles = owed.filter((r) => r.daysOwed >= 1 && r.daysOwed <= 8 && r.paid === 0 && owed.filter((x) => x.patient.id === r.patient.id).length === 1).map((r) => r.visit)
  const msgs: string[] = []
  const u1 = singles[0]; const u2 = singles[1]
  if (u1) {
    const p = patients.find((x) => x.id === u1.patientId)!
    msgs.push(`Good day po, ako si ${p.firstName} ${p.lastName}. Nag-gcash na po ako ₱${charge(u1)}. Ref no. 7740${String(charge(u1)).padStart(4, '0')}1`)
  }
  if (u2) {
    const p = patients.find((x) => x.id === u2.patientId)!
    msgs.push(`${p.lastName} paid ${charge(u2) - 100} via bank transfer, reference BDO55${charge(u2)}22`)
  }
  msgs.push('Sent na po 500 sa gcash, paki-check po')
  snap.proposals = msgs.map((m, i) => ({ ...newProposal(m, i === 2 ? 'screenshot' : 'message', snap, today), receivedAt: new Date(Date.now() - (i + 1) * 3_600_000).toISOString() }))
  return snap
}

export const emptySnapshot = (): DataSnapshot => ({
  patients: [], visits: [], payments: [], contacts: [], proposals: [], settings: null,
  counters: { patient: 0, receipt: 0 }, seeded: false,
})

export { isoDate }
