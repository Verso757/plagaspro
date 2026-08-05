import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Building2, FileText, LogOut, Bug, Download, ClipboardList } from 'lucide-react';

export default function PortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/portal', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/portal/sites', icon: Building2, label: 'Mis Sitios' },
    { to: '/portal/documents', icon: FileText, label: 'Documentos' },
  ];

  return (
    <div className="app-layout portal-layout">
      <aside className="sidebar" style={{ background: 'linear-gradient(180deg, #06211a 0%, #0a3a2e 100%)' }}>
        <div className="sidebar-logo">
          <Bug size={28} color="#06bf79" />
          <span style={{ color: '#06bf79' }}>Portal</span><span style={{ color: '#fff' }}> Cliente</span>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-section" style={{ color: '#06bf7999' }}>Menú</div>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              style={({ isActive }) => isActive ? { background: '#06bf7930', color: '#06bf79' } : {}}>
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div style={{ color: '#fff', fontSize: 13, marginBottom: 4 }}>{user?.full_name}</div>
          <div style={{ color: '#06bf79', fontSize: 12, marginBottom: 8 }}>Cliente</div>
          <button className="btn btn-sm btn-outline" onClick={handleLogout}
            style={{ width: '100%', color: '#fff', borderColor: 'rgba(255,255,255,0.2)', background: 'transparent' }}>
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="header" style={{ background: '#fff', borderBottom: '2px solid #06bf79' }}>
          <h2 style={{ color: '#0a3a2e' }}>Portal de Clientes</h2>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}