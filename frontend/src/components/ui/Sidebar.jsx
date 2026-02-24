import { Link, NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserCircle,
  Calendar,
  FileText,
  FileSpreadsheet,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Stethoscope,
  Activity,
  History,
  Building2,
  CircleDollarSign,
} from 'lucide-react';
import { SECTIONS } from '../../lib/navConfig';
import Logo from './Logo';

const iconMap = {
  LayoutDashboard,
  Users,
  UserCircle,
  Calendar,
  FileText,
  FileSpreadsheet,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Stethoscope,
  Activity,
  History,
  Building2,
  CircleDollarSign,
};

function NavItem({ to, icon, label, end = false, onClick, collapsed }) {
  const Icon = iconMap[icon] || LayoutDashboard;
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-all duration-200 ease-in-out ${
          collapsed ? 'justify-center px-2' : ''
        } ${
          isActive
            ? 'bg-emerald-50 text-emerald-700 font-semibold'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
      {!collapsed && <span className="truncate leading-[1.5]">{label}</span>}
    </NavLink>
  );
}

export default function Sidebar({
  collapsed,
  onToggle,
  menuItems,
  onLogout,
  userRoleName,
}) {
  const bySection = menuItems.reduce((acc, item) => {
    const sec = item.section || 'main';
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(item);
    return acc;
  }, {});
  const sectionOrder = ['main', 'management', 'analytics', 'account'];

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-slate-200/80 bg-gradient-to-b from-teal-50/90 to-slate-50/80 transition-[width] duration-250 ${
        collapsed ? 'w-[4.25rem]' : 'w-64'
      }`}
    >
      <div className="flex h-16 items-center justify-between gap-2 border-b border-slate-200/60 px-3">
        <Link
          to="/"
          className="flex min-w-0 items-center rounded-lg transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          aria-label="DoctorDesk.me – Home"
        >
          <Logo compact={collapsed} className="py-1" />
        </Link>
        <button
          type="button"
          onClick={onToggle}
          className="rounded-xl p-2 text-content-muted transition-colors hover:bg-white/70 hover:text-content focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelLeft className="h-5 w-5" />
          ) : (
            <PanelLeftClose className="h-5 w-5" />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto overflow-x-hidden p-3" style={{ WebkitOverflowScrolling: 'touch' }}>
        {sectionOrder.map((sectionKey) => {
          const items = bySection[sectionKey];
          if (!items?.length) return null;
          const sectionLabel = SECTIONS[sectionKey];
          return (
            <div key={sectionKey}>
              {!collapsed && sectionLabel && (
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-content-muted">
                  {sectionLabel}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map((item) => (
                  <NavItem
                    key={item.to}
                    to={item.to}
                    icon={item.icon}
                    label={item.label}
                    end={item.end}
                    onClick={item.onClick}
                    collapsed={collapsed}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-200/60 p-3">
        {!collapsed && userRoleName && (
          <p className="mb-2 px-3 text-caption text-content-muted">{userRoleName}</p>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-3 rounded-xl px-3 py-2.5 text-body font-medium text-content-muted transition-colors hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:ring-offset-2"
        >
          <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.75} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
}
