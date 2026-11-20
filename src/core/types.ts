export type Role = 'admin' | 'frontdesk' | 'doctor'
export type Permission =
  | 'dashboard.view'
  | 'bookings.edit'
  | 'payments.record'
  | 'payments.void'
  | 'unpaid.view'
  | 'inbox.confirm'
  | 'patients.view'
  | 'reports.view'
  | 'settings.edit'

export type PaymentMethod = 'cash' | 'gcash' | 'bank' | 'card'
/** How a payment reached the ledger. Only `online` may skip a human tap (provider-verified in the real system). */
export type PaymentSource = 'manual' | 'doctor-tap' | 'agent-confirmed' | 'online'

export type VisitStatus = 'requested' | 'booked' | 'arrived' | 'done' | 'noshow' | 'cancelled'
export type PayStatus = 'unpaid' | 'partial' | 'paid' | 'free'

export interface Service {
  id: string
  name: string
  fee: number
  color: string
}

export interface Doctor {
  id: string
  name: string
  serviceId: string
}

export interface Patient {
  id: string
  patientNo: string
  firstName: string
  lastName: string
  phone: string
  birthdate: string
  createdAt: string
}

export interface Visit {
  id: string
  patientId: string
  doctorId: string
  serviceId: string
  date: string // yyyy-mm-dd
  time: string // HH:mm
  status: VisitStatus
  fee: number
  discount: number
  note: string
  bookedVia: 'phone' | 'desk' | 'doctor' | 'online'
  createdAt: string
}

export interface Payment {
  id: string
  receiptNo: string
  visitId: string
  amount: number
  method: PaymentMethod
  source: PaymentSource
  recordedBy: string
  recordedAt: string
  reference: string
  voided: boolean
  voidReason: string
}

export interface Contact {
  id: string
  visitId: string
  at: string
  by: string
  channel: 'call' | 'sms' | 'viber' | 'in-person'
  note: string
  promisedDate: string
}

export type ProposalStatus = 'pending' | 'confirmed' | 'rejected'
export interface Proposal {
  id: string
  receivedAt: string
  channel: 'message' | 'screenshot'
  raw: string
  amount: number | null
  method: PaymentMethod | null
  reference: string
  patientId: string | null
  visitId: string | null
  confidence: number // 0..1
  reasons: string[]
  warnings: string[]
  status: ProposalStatus
  decidedBy: string
  decidedAt: string
}

export interface ClinicConfig {
  clinic: { name: string; shortName: string; tagline: string; address: string; phone: string }
  services: Service[]
  doctors: Doctor[]
  methods: { id: PaymentMethod; label: string; enabled: boolean }[]
  onlinePayments: boolean
  bookingLink: boolean
  graceDays: number
  storageNamespace: string
  demoMode: boolean
  configVersion: number
}

export interface Counters {
  patient: number
  receipt: number
}

export interface DataSnapshot {
  patients: Patient[]
  visits: Visit[]
  payments: Payment[]
  contacts: Contact[]
  proposals: Proposal[]
  settings: ClinicConfig | null
  counters: Counters
  seeded: boolean
}
