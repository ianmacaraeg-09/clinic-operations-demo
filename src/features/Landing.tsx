import { Link } from 'react-router-dom'
import { useData } from '../core/DataContext.tsx'
import { Logo } from '../ui/Layout.tsx'

/** Demo front door: three ways in, one for each person who touches the system. */
export default function Landing() {
  const { config, setRole } = useData()
  return (
    <div className="landing">
      <Logo size={64} />
      <div>
        <h1>Know who has paid. Instantly.</h1>
        <p className="tag">{config.clinic.name}: one shared place for every booking and every payment, with payment follow-up that runs itself. This is a click-through demo with sample data.</p>
      </div>
      <div className="entry-grid">
        <Link className="entry" to="/app" onClick={() => setRole('frontdesk')}>
          <h2>Front desk</h2>
          <p className="muted">The live day sheet, unpaid list, payment inbox and ledger.</p>
          <span className="go">Open staff system →</span>
        </Link>
        <Link className="entry" to="/app/quick" onClick={() => setRole('doctor')}>
          <h2>Doctor on a phone</h2>
          <p className="muted">Five-second actions: mark arrived, tap “Paid ₱ cash ✓”, add a booking.</p>
          <span className="go">Open doctor view →</span>
        </Link>
        {config.bookingLink && (
          <Link className="entry" to="/book">
            <h2>Patient booking page</h2>
            <p className="muted">Patients request a slot online. Staff confirm it in Bookings.</p>
            <span className="go">Open booking page →</span>
          </Link>
        )}
        <Link className="entry" to="/app" onClick={() => setRole('admin')}>
          <h2>Administrator</h2>
          <p className="muted">Everything, plus voiding payments, reports and settings.</p>
          <span className="go">Open as admin →</span>
        </Link>
      </div>
      <p className="muted small">All names, numbers and amounts are fictional. Data stays in your browser.</p>
    </div>
  )
}
