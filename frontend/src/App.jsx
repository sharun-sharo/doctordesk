import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

const PAGE_TITLES = {
  '/': 'Dashboard',
  '/login': 'Sign in',
  '/forgot-password': 'Reset password',
  '/reset-password': 'Set new password',
  '/doctors': 'Doctors',
  '/receptionists': 'Receptionists',
  '/patients': 'Patients',
  '/patients/new': 'Add Patient',
  '/appointments': 'Appointments',
  '/appointments/new': 'New Appointment',
  '/invoices': 'Billing',
  '/invoices/new': 'New Invoice',
  '/prescriptions': 'Prescriptions',
  '/prescriptions/new': 'New Prescription',
  '/medicines': 'Inventory',
  '/medicines/new': 'Add Medicine',
  '/reports': 'AI Insights',
  '/reports/detailed': 'Reports',
  '/revenue': 'Revenue',
  '/users': 'Users',
  '/users/new': 'Add User',
  '/activity/logs': 'Activity Logs',
  '/activity/login-history': 'Login History',
  '/profile': 'Profile',
  '/settings': 'Settings',
};

function getDocumentTitle(pathname) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith('/patients/')) return pathname.endsWith('/edit') ? 'Edit Patient' : 'Patient';
  if (pathname.startsWith('/appointments/')) return pathname.endsWith('/edit') ? 'Edit Appointment' : 'Appointment';
  if (pathname.startsWith('/invoices/')) return 'Invoice';
  if (pathname.startsWith('/prescriptions/')) return pathname.endsWith('/edit') ? 'Edit Prescription' : 'Prescription';
  if (pathname.startsWith('/medicines/')) return pathname.endsWith('/edit') ? 'Edit Medicine' : 'Medicine';
  if (pathname.startsWith('/users/')) return pathname.endsWith('/edit') ? 'Edit User' : 'User';
  return 'DoctorDesk.me';
}
import Layout from './layout/Layout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientForm from './pages/PatientForm';
import PatientView from './pages/PatientView';
import Appointments from './pages/Appointments';
import AppointmentForm from './pages/AppointmentForm';
import Invoices from './pages/Invoices';
import InvoiceForm from './pages/InvoiceForm';
import InvoiceView from './pages/InvoiceView';
import Prescriptions from './pages/Prescriptions';
import PrescriptionForm from './pages/PrescriptionForm';
import PrescriptionView from './pages/PrescriptionView';
import Medicines from './pages/Medicines';
import MedicineForm from './pages/MedicineForm';
import Reports from './pages/Reports';
import Users from './pages/Users';
import UserForm from './pages/UserForm';
import ActivityLogs from './pages/ActivityLogs';
import LoginHistory from './pages/LoginHistory';
import Settings from './pages/Settings';
import Doctors from './pages/Doctors';
import Receptionists from './pages/Receptionists';
import Subscriptions from './pages/Subscriptions';
import Revenue from './pages/Revenue';
import Profile from './pages/Profile';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
    const title = getDocumentTitle(location.pathname);
    document.title = title === 'DoctorDesk.me' ? title : `${title} – DoctorDesk.me`;
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="doctors" element={<Doctors />} />
        <Route path="receptionists" element={<Receptionists />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="patients" element={<Patients />} />
        <Route path="patients/new" element={<PatientForm />} />
        <Route path="patients/:id/edit" element={<PatientForm />} />
        <Route path="patients/:id" element={<PatientView />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="appointments/new" element={<AppointmentForm />} />
        <Route path="appointments/:id/edit" element={<AppointmentForm />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="invoices/new" element={<InvoiceForm />} />
        <Route path="invoices/:id" element={<InvoiceView />} />
        <Route path="prescriptions" element={<Prescriptions />} />
        <Route path="prescriptions/new" element={<PrescriptionForm />} />
        <Route path="prescriptions/:id" element={<PrescriptionView />} />
        <Route path="prescriptions/:id/edit" element={<PrescriptionForm />} />
        <Route path="medicines" element={<Medicines />} />
        <Route path="medicines/new" element={<MedicineForm />} />
        <Route path="medicines/:id/edit" element={<MedicineForm />} />
        <Route path="reports/detailed" element={<Reports />} />
        <Route path="reports" element={<Reports />} />
        <Route path="revenue" element={<Revenue />} />
        <Route path="users" element={<Users />} />
        <Route path="users/new" element={<UserForm />} />
        <Route path="users/:id/edit" element={<UserForm />} />
        <Route path="activity/logs" element={<ActivityLogs />} />
        <Route path="activity/login-history" element={<LoginHistory />} />
        <Route path="profile" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
