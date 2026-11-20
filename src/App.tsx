import { Navigate, Route, Routes } from 'react-router-dom'
import { useData } from './core/DataContext.tsx'
import Bookings from './features/Bookings.tsx'
import DaySheet from './features/DaySheet.tsx'
import Inbox from './features/Inbox.tsx'
import Landing from './features/Landing.tsx'
import { PatientDetail, PatientsList } from './features/Patients.tsx'
import PaymentsLedger from './features/PaymentsLedger.tsx'
import PublicBook from './features/PublicBook.tsx'
import Quick from './features/Quick.tsx'
import Reports from './features/Reports.tsx'
import Settings from './features/Settings.tsx'
import Unpaid from './features/Unpaid.tsx'
import { AdminLayout, Guard, PublicLayout } from './ui/Layout.tsx'

export default function App() {
  const { ready, config } = useData()
  if (!ready) return <div className="boot">Loading…</div>
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<PublicLayout />}>
        <Route path="/book" element={config.bookingLink ? <PublicBook /> : <Navigate to="/" replace />} />
      </Route>
      <Route path="/app" element={<AdminLayout />}>
        <Route index element={<Guard perm="dashboard.view"><DaySheet /></Guard>} />
        <Route path="quick" element={<Guard perm="dashboard.view"><Quick /></Guard>} />
        <Route path="bookings" element={<Guard perm="dashboard.view"><Bookings /></Guard>} />
        <Route path="unpaid" element={<Guard perm="unpaid.view"><Unpaid /></Guard>} />
        <Route path="inbox" element={<Guard perm="inbox.confirm"><Inbox /></Guard>} />
        <Route path="payments" element={<Guard perm="unpaid.view"><PaymentsLedger /></Guard>} />
        <Route path="patients" element={<Guard perm="patients.view"><PatientsList /></Guard>} />
        <Route path="patients/:id" element={<Guard perm="patients.view"><PatientDetail /></Guard>} />
        <Route path="reports" element={<Guard perm="reports.view"><Reports /></Guard>} />
        <Route path="settings" element={<Guard perm="settings.edit"><Settings /></Guard>} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
