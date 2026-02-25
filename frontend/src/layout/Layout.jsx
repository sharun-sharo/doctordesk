import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getNavItemsForRole, getRoleDisplayName } from '../lib/navConfig';
import Sidebar from '../components/ui/Sidebar';
import Header from '../components/ui/Header';

export default function Layout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (location.pathname === '/patients') {
      const q = searchParams.get('search') || '';
      setHeaderSearch((prev) => (prev !== q ? q : prev));
    }
  }, [location.pathname, searchParams]);

  const menuItems = getNavItemsForRole(user?.roleId).map((item) => ({
    ...item,
    onClick: () => setMobileSidebarOpen(false),
  }));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sticky desktop sidebar */}
      <div className="hidden lg:block sticky top-0 h-screen z-30">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
          menuItems={menuItems}
          onLogout={handleLogout}
          userRoleName={getRoleDisplayName(user?.roleId)}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] max-w-[18rem] lg:hidden pl-[env(safe-area-inset-left,0)]" style={{ maxHeight: '100dvh' }}>
            <Sidebar
              collapsed={false}
              onToggle={() => setMobileSidebarOpen(false)}
              menuItems={menuItems}
              onLogout={() => {
                handleLogout();
                setMobileSidebarOpen(false);
              }}
              userRoleName={getRoleDisplayName(user?.roleId)}
            />
          </div>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          onMenuClick={() => setMobileSidebarOpen(true)}
          searchValue={headerSearch}
          onSearchChange={setHeaderSearch}
          user={user}
        />
        <main className="flex-1 bg-gray-50 p-4 sm:p-6 lg:p-8 transition-[padding] duration-200 min-w-0">
          <div className="page-enter mx-auto max-w-[1600px] w-full min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
