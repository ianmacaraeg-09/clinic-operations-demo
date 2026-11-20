import type { ClinicConfig, Permission, Role } from '../core/types.ts'

/**
 * Client defaults. Every name below is a placeholder: edit here (or in Settings) per clinic.
 * Saved settings are merged over these defaults, so bump `configVersion` when a release adds fields.
 */
export const defaultConfig: ClinicConfig = {
  clinic: {
    name: 'Sample Clinic Group',
    shortName: 'Sample Clinic',
    tagline: 'Care you can count on',
    address: '[Clinic address]',
    phone: '[Clinic phone]',
  },
  services: [
    { id: 'svc-a', name: 'Service A', fee: 500, color: '#0f7c7a' },
    { id: 'svc-b', name: 'Service B', fee: 800, color: '#c96f12' },
    { id: 'svc-c', name: 'Service C', fee: 350, color: '#4f46e5' },
  ],
  doctors: [
    { id: 'doc-1', name: 'Dr. Reyes', serviceId: 'svc-a' },
    { id: 'doc-2', name: 'Dr. Santos', serviceId: 'svc-b' },
    { id: 'doc-3', name: 'Dr. Dela Cruz', serviceId: 'svc-c' },
  ],
  methods: [
    { id: 'cash', label: 'Cash', enabled: true },
    { id: 'gcash', label: 'E-wallet', enabled: true },
    { id: 'bank', label: 'Bank transfer', enabled: true },
    { id: 'card', label: 'Card', enabled: false },
  ],
  onlinePayments: true,
  bookingLink: true,
  graceDays: 0,
  storageNamespace: 'clinic-demo',
  demoMode: true,
  configVersion: 1,
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  frontdesk: 'Front desk',
  doctor: 'Doctor',
}

export const ROLE_PERMS: Record<Role, Permission[]> = {
  admin: ['dashboard.view', 'bookings.edit', 'payments.record', 'payments.void', 'unpaid.view', 'inbox.confirm', 'patients.view', 'reports.view', 'settings.edit'],
  frontdesk: ['dashboard.view', 'bookings.edit', 'payments.record', 'unpaid.view', 'inbox.confirm', 'patients.view', 'reports.view'],
  doctor: ['dashboard.view', 'bookings.edit', 'payments.record', 'patients.view'],
}

/** The demo doctor account used by the "signed in as Doctor" view. */
export const DEMO_DOCTOR_ID = 'doc-1'
