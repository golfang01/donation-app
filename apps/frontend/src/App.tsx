import { Routes, Route, Navigate } from 'react-router-dom';
import DonationPage         from './pages/DonationPage';
import OverlayPage          from './pages/OverlayPage';
import MobileUploadPage     from './pages/MobileUploadPage';
import AdminLoginPage       from './pages/admin/AdminLoginPage';
import AdminDashboard       from './pages/admin/AdminDashboard';
import ProtectedRoute       from './components/ProtectedRoute';
import GoalWidget           from './pages/widgets/GoalWidget';
import TimerWidget          from './pages/widgets/TimerWidget';
import TopDonatorsWidget    from './pages/widgets/TopDonatorsWidget';
import AlertWidget from './pages/widgets/AlertWidget';

export default function App() {
  return (
    <Routes>
      {/* ── Public ───────────────────────────────────────────────────── */}
      <Route path="/"              element={<DonationPage />} />
      <Route path="/overlay"       element={<OverlayPage />} />
      <Route path="/mobile-upload" element={<MobileUploadPage />} />

      {/* ── Admin ────────────────────────────────────────────────────── */}
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* ── OBS Widget Browser Sources ───────────────────────────────── */}
      <Route path="/widget/goal"          element={<GoalWidget />} />
      <Route path="/widget/timer"         element={<TimerWidget />} />
      <Route path="/widget/top-donators"  element={<TopDonatorsWidget />} />
      <Route path="/widget/alert" element={<AlertWidget />} />

      {/* ── Catch-all ────────────────────────────────────────────────── */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
