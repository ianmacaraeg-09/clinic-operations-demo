import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DEMO_DOCTOR_ID, ROLE_LABEL, ROLE_PERMS, defaultConfig } from '../config/clinic.config.ts'
import { balance, newProposal, round2, stamp, todayIso, uid } from './logic.ts'
import { demoSnapshot, emptySnapshot } from './seed.ts'
import { backendKind, repository } from './storage.ts'
import type {
  ClinicConfig, Contact, DataSnapshot, Patient, Payment, PaymentMethod, PaymentSource, Permission, Proposal, Role, Visit, VisitStatus,
} from './types.ts'

export interface Toast { id: number; text: string; kind: 'ok' | 'error' }
export type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string }
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const fail = (error: string): Result<never> => ({ ok: false, error })

export interface NewVisitInput {
  patientId: string; doctorId: string; serviceId: string; date: string; time: string
  fee?: number; discount?: number; note?: string; bookedVia: Visit['bookedVia']; status?: VisitStatus
}
export interface PaymentInput {
  visitId: string; amount: number; method: PaymentMethod; source?: PaymentSource; reference?: string
}

interface Ctx extends DataSnapshot {
  ready: boolean
  config: ClinicConfig
  backend: 'local' | 'supabase'
  role: Role
  roleLabel: string
  setRole(r: Role): void
  doctorId: string
  can(p: Permission): boolean
  toasts: Toast[]
  toast(text: string, kind?: Toast['kind']): void

  addPatient(p: Pick<Patient, 'firstName' | 'lastName' | 'phone' | 'birthdate'>): Patient
  createVisit(i: NewVisitInput): Result<Visit>
  updateVisit(id: string, patch: Partial<Visit>): void
  setVisitStatus(id: string, status: VisitStatus): void
  recordPayment(i: PaymentInput): Result<Payment>
  voidPayment(id: string, reason: string): Result
  logContact(c: Omit<Contact, 'id' | 'at' | 'by'>): void
  submitMessage(raw: string, channel: Proposal['channel']): Proposal
  confirmProposal(id: string, o: { visitId: string; amount: number; method: PaymentMethod; reference: string }): Result<Payment>
  rejectProposal(id: string): void
  payOnline(visitId: string): Result<Payment>
  saveConfig(c: ClinicConfig): void
  resetDemo(): void
  clearAll(): void
  importSnapshot(s: DataSnapshot): void
  snapshot(): DataSnapshot
}

const DataCtx = createContext<Ctx | null>(null)
export const useData = () => {
  const c = useContext(DataCtx)
  if (!c) throw new Error('useData outside DataProvider')
  return c
}

const ROLE_KEY = 'clinic-ops:role'
const readRole = (): Role => {
  try {
    const v = localStorage.getItem(ROLE_KEY)
    if (v === 'admin' || v === 'frontdesk' || v === 'doctor') return v
  } catch { /* ignore */ }
  return 'admin'
}

/** Saved settings are merged over the defaults so older saved settings pick up new fields. */
export function mergeConfig(saved: ClinicConfig | null): ClinicConfig {
  if (!saved) return defaultConfig
  return {
    ...defaultConfig, ...saved,
    clinic: { ...defaultConfig.clinic, ...saved.clinic },
    methods: defaultConfig.methods.map((m) => saved.methods?.find((x) => x.id === m.id) ?? m),
    storageNamespace: defaultConfig.storageNamespace,
    configVersion: defaultConfig.configVersion,
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [snap, setSnap] = useState<DataSnapshot>(emptySnapshot)
  const [ready, setReady] = useState(false)
  const [role, setRoleState] = useState<Role>(readRole)
  const [toasts, setToasts] = useState<Toast[]>([])
  const live = useRef(snap)
  const tid = useRef(0)

  useEffect(() => {
    let s = repository.load()
    if (!s || (!s.seeded && defaultConfig.demoMode && s.patients.length === 0 && s.visits.length === 0)) {
      s = defaultConfig.demoMode ? demoSnapshot(mergeConfig(s?.settings ?? null)) : emptySnapshot()
      repository.save(s)
    }
    live.current = s
    setSnap(s)
    setReady(true)
  }, [])

  const config = useMemo(() => mergeConfig(snap.settings), [snap.settings])

  /** Apply a change to the latest snapshot, then persist it. */
  const commit = useCallback((fn: (s: DataSnapshot) => DataSnapshot) => {
    const next = fn(live.current)
    live.current = next
    setSnap(next)
    repository.save(next)
  }, [])

  const toast = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = ++tid.current
    setToasts((t) => [...t, { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800)
  }, [])

  const setRole = useCallback((r: Role) => {
    setRoleState(r)
    try { localStorage.setItem(ROLE_KEY, r) } catch { /* ignore */ }
  }, [])
  const can = useCallback((p: Permission) => ROLE_PERMS[role].includes(p), [role])
  const actor = role === 'doctor' ? (config.doctors.find((d) => d.id === DEMO_DOCTOR_ID)?.name ?? 'Doctor') : ROLE_LABEL[role]

  const addPatient: Ctx['addPatient'] = (p) => {
    const n = live.current.counters.patient + 1
    const patient: Patient = { id: uid('pat'), patientNo: `P-${String(n).padStart(5, '0')}`, createdAt: stamp(), ...p }
    commit((s) => ({ ...s, patients: [...s.patients, patient], counters: { ...s.counters, patient: n } }))
    return patient
  }

  const createVisit: Ctx['createVisit'] = (i) => {
    const svc = config.services.find((s) => s.id === i.serviceId)
    if (!svc) return fail('Pick a service.')
    if (!i.patientId) return fail('Pick a patient.')
    if (!i.date || !i.time) return fail('Pick a date and time.')
    const visit: Visit = {
      id: uid('vis'), patientId: i.patientId, doctorId: i.doctorId, serviceId: i.serviceId, date: i.date, time: i.time,
      status: i.status ?? 'booked', fee: i.fee ?? svc.fee, discount: i.discount ?? 0, note: i.note ?? '', bookedVia: i.bookedVia, createdAt: stamp(),
    }
    commit((s) => ({ ...s, visits: [...s.visits, visit] }))
    return ok(visit)
  }

  const updateVisit: Ctx['updateVisit'] = (id, patch) => commit((s) => ({ ...s, visits: s.visits.map((v) => (v.id === id ? { ...v, ...patch } : v)) }))
  const setVisitStatus: Ctx['setVisitStatus'] = (id, status) => updateVisit(id, { status })

  const record = (i: PaymentInput, source: PaymentSource, by: string): Result<Payment> => {
    const s = live.current
    const visit = s.visits.find((v) => v.id === i.visitId)
    if (!visit) return fail('Visit not found.')
    const amount = round2(Number(i.amount))
    if (!(amount > 0)) return fail('Enter an amount above zero.')
    const left = balance(visit, s.payments)
    if (amount > left + 0.004) return fail(`That is more than the balance (${left}). Record up to the balance.`)
    const ref = (i.reference ?? '').trim()
    if (ref && s.payments.some((p) => !p.voided && p.reference === ref)) return fail(`Reference ${ref} is already in the ledger.`)
    const n = s.counters.receipt + 1
    const payment: Payment = {
      id: uid('pay'), receiptNo: `OR-${String(n).padStart(6, '0')}`, visitId: i.visitId, amount, method: i.method, source,
      recordedBy: by, recordedAt: stamp(), reference: ref, voided: false, voidReason: '',
    }
    commit((x) => ({
      ...x, payments: [...x.payments, payment], counters: { ...x.counters, receipt: n },
      visits: x.visits.map((v) => (v.id === i.visitId && (v.status === 'booked' || v.status === 'requested') ? { ...v, status: 'arrived' } : v)),
    }))
    return ok(payment)
  }
  const recordPayment: Ctx['recordPayment'] = (i) => record(i, i.source ?? (role === 'doctor' ? 'doctor-tap' : 'manual'), actor)

  const voidPayment: Ctx['voidPayment'] = (id, reason) => {
    if (!can('payments.void')) return fail('Only an administrator can void a payment.')
    if (!reason.trim()) return fail('Give a reason for voiding.')
    commit((s) => ({ ...s, payments: s.payments.map((p) => (p.id === id ? { ...p, voided: true, voidReason: reason.trim() } : p)) }))
    return ok(undefined)
  }

  const logContact: Ctx['logContact'] = (c) => commit((s) => ({ ...s, contacts: [...s.contacts, { ...c, id: uid('con'), at: stamp(), by: actor }] }))

  const submitMessage: Ctx['submitMessage'] = (raw, channel) => {
    const p = newProposal(raw, channel, live.current, todayIso())
    commit((s) => ({ ...s, proposals: [p, ...s.proposals] }))
    return p
  }

  const confirmProposal: Ctx['confirmProposal'] = (id, o) => {
    if (!can('inbox.confirm')) return fail('Your role cannot confirm payments.')
    const prop = live.current.proposals.find((p) => p.id === id)
    if (!prop || prop.status !== 'pending') return fail('This proposal was already handled.')
    const res = record({ visitId: o.visitId, amount: o.amount, method: o.method, reference: o.reference, source: 'agent-confirmed' }, 'agent-confirmed', `${actor} (confirmed AI match)`)
    if (!res.ok) return res
    commit((s) => ({ ...s, proposals: s.proposals.map((p) => (p.id === id ? { ...p, status: 'confirmed', decidedBy: actor, decidedAt: stamp() } : p)) }))
    return res
  }

  const rejectProposal: Ctx['rejectProposal'] = (id) =>
    commit((s) => ({ ...s, proposals: s.proposals.map((p) => (p.id === id && p.status === 'pending' ? { ...p, status: 'rejected', decidedBy: actor, decidedAt: stamp() } : p)) }))

  /** Demo of provider-verified online payment: in production this comes from a signed webhook, never from the browser. */
  const payOnline: Ctx['payOnline'] = (visitId) => {
    const v = live.current.visits.find((x) => x.id === visitId)
    if (!v) return fail('Visit not found.')
    const left = balance(v, live.current.payments)
    if (left <= 0) return fail('Nothing left to pay.')
    return record({ visitId, amount: left, method: 'gcash', reference: `ONL${Date.now().toString(36).toUpperCase()}`, source: 'online' }, 'online', 'Online payment (verified)')
  }

  const saveConfig = (c: ClinicConfig) => commit((s) => ({ ...s, settings: c }))
  const resetDemo = () => { commit(() => demoSnapshot(config)); toast('Demo data reset') }
  const clearAll = () => { commit((s) => ({ ...emptySnapshot(), seeded: true, settings: s.settings })); toast('All data cleared') }
  const importSnapshot = (s: DataSnapshot) => commit(() => ({ ...emptySnapshot(), ...s, seeded: true }))

  const value: Ctx = {
    ...snap, ready, config, backend: backendKind, role, roleLabel: ROLE_LABEL[role], setRole, doctorId: DEMO_DOCTOR_ID, can, toasts, toast,
    addPatient, createVisit, updateVisit, setVisitStatus, recordPayment, voidPayment, logContact, submitMessage, confirmProposal, rejectProposal,
    payOnline, saveConfig, resetDemo, clearAll, importSnapshot, snapshot: () => live.current,
  }
  return <DataCtx.Provider value={value}>{children}</DataCtx.Provider>
}
