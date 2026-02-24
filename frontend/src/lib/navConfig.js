import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  CreditCard,
  BarChart3,
  Settings,
  Stethoscope,
  Activity,
  History,
  CircleDollarSign,
  UserPlus,
} from 'lucide-react';

// Role IDs: 1 = Super Admin, 2 = Admin, 3 = Doctor, 4 = Receptionist, 5 = Assistant doctor
const ROLE = { SUPER_ADMIN: 1, ADMIN: 2, DOCTOR: 3, RECEPTIONIST: 4, ASSISTANT_DOCTOR: 5 };

const SECTIONS = { main: 'Main', management: 'Management', analytics: 'Analytics', account: 'Account' };

const allNavItems = [
  { to: '/', label: 'Dashboard', icon: 'LayoutDashboard', end: true, roles: [1, 2, 3, 4, 5], section: 'main' },
  { to: '/doctors', label: 'Doctors', icon: 'Stethoscope', end: true, roles: [1], section: 'management' },
  { to: '/receptionists', label: 'Receptionists', icon: 'Users', end: true, roles: [1], section: 'management' },
  { to: '/subscriptions', label: 'Subscriptions', icon: 'CircleDollarSign', end: true, roles: [1], section: 'management' },
  { to: '/patients', label: 'Patients', icon: 'Users', end: false, roles: [2, 4, 5], section: 'management' },
  { to: '/walk-ins', label: 'Walk-ins', icon: 'UserPlus', end: true, roles: [2, 3, 4, 5], section: 'management' },
  { to: '/appointments', label: 'Appointments', icon: 'Calendar', end: false, roles: [2, 3, 4, 5], section: 'management' },
  { to: '/prescriptions', label: 'Prescriptions', icon: 'FileText', end: false, roles: [2, 3], section: 'management' },
  { to: '/invoices', label: 'Billing', icon: 'CreditCard', end: false, roles: [2], section: 'management' },
  { to: '/users', label: 'Users', icon: 'Stethoscope', end: false, roles: [1], section: 'management' },
  { to: '/reports', label: 'AI Insights', icon: 'BarChart3', end: false, roles: [2], section: 'analytics' },
  { to: '/reports/detailed', label: 'Reports', icon: 'FileSpreadsheet', end: true, roles: [2, 4, 5], section: 'analytics' },
  { to: '/revenue', label: 'Revenue', icon: 'CircleDollarSign', end: true, roles: [1], section: 'analytics' },
  { to: '/activity/logs', label: 'Activity Logs', icon: 'Activity', end: false, roles: [1], section: 'analytics' },
  { to: '/activity/login-history', label: 'Login History', icon: 'History', end: false, roles: [1], section: 'analytics' },
  { to: '/profile', label: 'Profile', icon: 'UserCircle', end: true, roles: [1, 3, 4, 5], section: 'account' },
  { to: '/settings', label: 'Settings', icon: 'Settings', end: true, roles: [1, 2], section: 'account' },
];

export function getNavItemsForRole(roleId) {
  if (!roleId) return [];
  return allNavItems
    .filter((item) => item.roles.includes(roleId))
    .map(({ to, label, icon, end, section }) => ({ to, label, icon, end, section }));
}

export { SECTIONS };

export function getRoleDisplayName(roleId) {
  const names = {
    [ROLE.SUPER_ADMIN]: 'Super Admin',
    [ROLE.ADMIN]: 'Admin',
    [ROLE.DOCTOR]: 'Doctor',
    [ROLE.RECEPTIONIST]: 'Receptionist',
    [ROLE.ASSISTANT_DOCTOR]: 'Assistant doctor',
  };
  return names[roleId] || 'User';
}
