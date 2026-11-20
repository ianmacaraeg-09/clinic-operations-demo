import { describe, expect, it } from 'vitest'
import {
  addDays, ageBucket, balance, collections, confidenceLabel, daysBetween, parseAmount, parseMethod, parseReference, payStatus, peso,
  recognizePayment, slotTaken, unpaidList,
} from './logic.ts'
import type { Contact, Patient, Payment, Visit } from './types.ts'

const TODAY = '2026-11-20'
const patient = (id: string, firstName: string, lastName: string): Patient => ({ id, patientNo: id, firstName, lastName, phone: '09171234567', birthdate: '', createdAt: '' })
const visit = (id: string, patientId: string, date: string, over: Partial<Visit> = {}): Visit => ({
  id, patientId, doctorId: 'd1', serviceId: 's1', date, time: '09:00', status: 'done', fee: 500, discount: 0, note: '', bookedVia: 'desk', createdAt: '', ...over,
})
const pay = (id: string, visitId: string, amount: number, over: Partial<Payment> = {}): Payment => ({
  id, receiptNo: id, visitId, amount, method: 'cash', source: 'manual', recordedBy: 'x', recordedAt: `${TODAY}T10:00:00`, reference: '', voided: false, voidReason: '', ...over,
})
const patients = [patient('p1', 'Maria', 'Cruz'), patient('p2', 'Juan', 'Reyes'), patient('p3', 'Ana', 'Santos')]

describe('ledger: has this patient paid?', () => {
  it('derives unpaid / partial / paid from recorded payments', () => {
    const v = visit('v1', 'p1', TODAY)
    expect(payStatus(v, [])).toBe('unpaid')
    expect(payStatus(v, [pay('a', 'v1', 200)])).toBe('partial')
    expect(payStatus(v, [pay('a', 'v1', 200), pay('b', 'v1', 300)])).toBe('paid')
    expect(balance(v, [pay('a', 'v1', 200)])).toBe(300)
  })
  it('applies discounts and treats a zero charge as no charge', () => {
    expect(payStatus(visit('v1', 'p1', TODAY, { discount: 100 }), [pay('a', 'v1', 400)])).toBe('paid')
    expect(payStatus(visit('v1', 'p1', TODAY, { discount: 500 }), [])).toBe('free')
  })
  it('ignores voided payments', () => {
    const v = visit('v1', 'p1', TODAY)
    expect(payStatus(v, [pay('a', 'v1', 500, { voided: true })])).toBe('unpaid')
  })
  it('does not drift on cents', () => {
    const v = visit('v1', 'p1', TODAY, { fee: 0.3 })
    expect(payStatus(v, [pay('a', 'v1', 0.1), pay('b', 'v1', 0.2)])).toBe('paid')
  })
})

describe('unpaid list', () => {
  const snap = (visits: Visit[], payments: Payment[], contacts: Contact[] = []) => ({ visits, payments, patients, contacts })
  it('lists owed visits oldest first, then largest balance', () => {
    const rows = unpaidList(snap([
      visit('new', 'p1', addDays(TODAY, -1)), visit('old', 'p2', addDays(TODAY, -10)), visit('big', 'p3', addDays(TODAY, -1), { fee: 900 }),
    ], []), TODAY)
    expect(rows.map((r) => r.visit.id)).toEqual(['old', 'big', 'new'])
  })
  it('drops a visit once it is paid and keeps the remainder when part-paid', () => {
    const v = [visit('v1', 'p1', addDays(TODAY, -2)), visit('v2', 'p2', addDays(TODAY, -2))]
    const rows = unpaidList(snap(v, [pay('a', 'v1', 500), pay('b', 'v2', 200)]), TODAY)
    expect(rows).toHaveLength(1)
    expect(rows[0].balance).toBe(300)
    expect(rows[0].paid).toBe(200)
  })
  it('skips future bookings, today\'s not-yet-arrived, cancelled and requested visits', () => {
    const rows = unpaidList(snap([
      visit('f', 'p1', addDays(TODAY, 2), { status: 'booked' }), visit('t', 'p1', TODAY, { status: 'booked' }),
      visit('c', 'p1', addDays(TODAY, -1), { status: 'cancelled' }), visit('r', 'p1', addDays(TODAY, -1), { status: 'requested' }),
    ], []), TODAY)
    expect(rows).toHaveLength(0)
  })
  it('counts a no-show as owed and carries the latest contact and promised date', () => {
    const c: Contact[] = [
      { id: 'c1', visitId: 'v1', at: '2026-11-15T10:00:00Z', by: 'x', channel: 'sms', note: 'first', promisedDate: '' },
      { id: 'c2', visitId: 'v1', at: '2026-11-18T10:00:00Z', by: 'x', channel: 'call', note: 'second', promisedDate: '2026-11-25' },
    ]
    const rows = unpaidList(snap([visit('v1', 'p1', addDays(TODAY, -5), { status: 'noshow' })], [], c), TODAY)
    expect(rows[0].lastContact?.note).toBe('second')
    expect(rows[0].promisedDate).toBe('2026-11-25')
  })
  it('honours grace days', () => {
    const v = [visit('v1', 'p1', addDays(TODAY, -1))]
    expect(unpaidList(snap(v, []), TODAY, 3)).toHaveLength(0)
    expect(unpaidList(snap(v, []), TODAY, 1)).toHaveLength(1)
  })
  it('buckets age', () => {
    expect([ageBucket(0), ageBucket(7), ageBucket(8), ageBucket(30), ageBucket(31)]).toEqual(['0-7', '0-7', '8-30', '8-30', '31+'])
  })
})

describe('payment recognition (proposal only)', () => {
  const visits = [visit('v1', 'p1', addDays(TODAY, -2)), visit('v2', 'p2', addDays(TODAY, -3), { fee: 800 })]
  const s = (payments: Payment[] = []) => ({ visits, payments, patients, contacts: [] })
  it('parses amounts, methods and references from natural messages', () => {
    expect(parseAmount('Nag-gcash na po ako ₱1,500.50')).toBe(1500.5)
    expect(parseAmount('paid 800 via bank')).toBe(800)
    expect(parseAmount('no number here')).toBeNull()
    expect(parseMethod('sent via GCash')).toBe('gcash')
    expect(parseMethod('BDO transfer')).toBe('bank')
    expect(parseReference('Ref no. 7740551232')).toBe('7740551232')
  })
  it('matches name + exact balance with high confidence', () => {
    const m = recognizePayment('Maria Cruz here, paid ₱500 gcash ref 8800112233', s(), TODAY)
    expect(m.patientId).toBe('p1')
    expect(m.visitId).toBe('v1')
    expect(m.amount).toBe(500)
    expect(m.method).toBe('gcash')
    expect(confidenceLabel(m.confidence)).toBe('high')
    expect(m.warnings).toHaveLength(0)
  })
  it('warns when only the surname matches', () => {
    const m = recognizePayment('Mrs Cruz paid 500', s(), TODAY)
    expect(m.patientId).toBe('p1')
    expect(m.warnings.some((w) => w.includes('surname'))).toBe(true)
    expect(confidenceLabel(m.confidence)).not.toBe('high')
  })
  it('warns when the amount differs from the balance', () => {
    const m = recognizePayment('Reyes paid 700 via bank', s(), TODAY)
    expect(m.visitId).toBe('v2')
    expect(m.warnings.some((w) => w.includes('differs'))).toBe(true)
    expect(confidenceLabel(m.confidence)).not.toBe('high')
  })
  it('flags a reference already in the ledger as a possible duplicate', () => {
    const m = recognizePayment('Maria Cruz 500 gcash ref 8800112233', s([pay('a', 'v2', 100, { reference: '8800112233' })]), TODAY)
    expect(m.warnings.some((w) => w.includes('duplicate'))).toBe(true)
  })
  it('falls back to a unique amount, but says to verify and stays low-confidence', () => {
    const m = recognizePayment('Sent na po 800 sa gcash', s(), TODAY)
    expect(m.visitId).toBe('v2')
    expect(m.warnings.some((w) => w.includes('amount only'))).toBe(true)
    expect(confidenceLabel(m.confidence)).not.toBe('high')
  })
  it('returns no match and low confidence for an unknown sender', () => {
    const m = recognizePayment('hello po, sent payment', s(), TODAY)
    expect(m.patientId).toBeNull()
    expect(m.visitId).toBeNull()
    expect(confidenceLabel(m.confidence)).toBe('low')
  })
  it('reports a patient with nothing owed', () => {
    const m = recognizePayment('Ana Santos paid 500', s(), TODAY)
    expect(m.patientId).toBe('p3')
    expect(m.visitId).toBeNull()
    expect(m.warnings.some((w) => w.includes('no unpaid'))).toBe(true)
  })
})

describe('helpers', () => {
  it('formats pesos and counts days', () => {
    expect(peso(1500)).toBe('₱1,500')
    expect(peso(12.5)).toBe('₱12.50')
    expect(daysBetween('2026-11-10', '2026-11-20')).toBe(10)
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
  it('detects a double-booked slot but ignores cancelled bookings and the booking itself', () => {
    const v = [visit('v1', 'p1', TODAY, { time: '10:00' }), visit('v2', 'p2', TODAY, { time: '10:30', status: 'cancelled' })]
    expect(slotTaken(v, 'd1', TODAY, '10:00')).toBe(true)
    expect(slotTaken(v, 'd1', TODAY, '10:00', 'v1')).toBe(false)
    expect(slotTaken(v, 'd1', TODAY, '10:30')).toBe(false)
    expect(slotTaken(v, 'd2', TODAY, '10:00')).toBe(false)
  })
  it('totals collections by method and skips voided payments', () => {
    const c = collections([pay('a', 'v1', 500), pay('b', 'v1', 300, { method: 'gcash' }), pay('c', 'v1', 99, { voided: true })], '2026-11-01', '2026-11-30')
    expect(c.total).toBe(800)
    expect(c.byMethod).toEqual({ cash: 500, gcash: 300 })
  })
})
