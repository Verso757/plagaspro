import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Users, Building2, MapPin, ClipboardList, FileText, Bug, Tags, LogOut, Calendar, DollarSign, QrCode } from 'lucide-react';

export default function Layout() {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { to: '/field-visit', icon: MapPin, label: '📱 Visita en Campo' },
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/clients', icon: Users, label: 'Clientes' },
    { to: '/sites', icon: Building2, label: 'Sitios' },
    { to: '/events', icon: ClipboardList, label: 'Eventos' },
    { to: '/quotations', icon: FileText, label: 'Cotizaciones' },
    { to: '/calendar', icon: Calendar, label: 'Calendario' },
    { to: '/qr-scanner', icon: QrCode, label: 'QR Scanner' },
  ];

  const adminItems = [
    { to: '/users', icon: Users, label: 'Usuarios' },
    { to: '/catalogs', icon: Tags, label: 'Catálogos' },
    { to: '/invoices', icon: DollarSign, label: 'Cobranza' },
  ];

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Bug size={28} color="#06b6d4" />
          <span>Plagas</span><span style={{ color: '#fff', WebkitTextFillColor: '#fff', background: 'none' }}>Pro</span>
        </div>
        <nav className="sidebar-nav">
          <div className="sidebar-section">Principal</div>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          {isAdmin && (
            <>
              <div className="sidebar-section" style={{ marginTop: 8 }}>Administración</div>
              {adminItems.map(item => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </>
          )}
        </nav>
        <div className="sidebar-footer">
          <div style={{ color: '#fff', fontSize: 13, marginBottom: 6, fontWeight: 600 }}>{user?.full_name}</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 10, fontWeight: 500, letterSpacing: 0.5 }}>
            {isAdmin ? 'Administrador' : 'Técnico'}
          </div>
          <button className="btn btn-outline btn-sm" onClick={handleLogout}
            style={{ width: '100%', color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)', fontSize: 12, padding: '7px 12px' }}>
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="main-area">
        <header className="header">
          <h2>Sistema de Control de Plagas</h2>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}