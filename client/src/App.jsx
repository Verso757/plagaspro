import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import PortalLayout from './components/PortalLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Sites from './pages/Sites';
import SiteDetail from './pages/SiteDetail';
import SketchEditor from './pages/SketchEditor';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Quotations from './pages/Quotations';
import QuotationDetail from './pages/QuotationDetail';
import Users from './pages/Users';
import Catalogs from './pages/Catalogs';
import Calendar from './pages/Calendar';
import Invoices from './pages/Invoices';
import PortalDashboard from './pages/PortalDashboard';
import PortalSitesList from './pages/PortalSitesList';
import PortalSiteDetail from './pages/PortalSiteDetail';
import QRScanner from './pages/QRScanner';
import FieldVisit from './pages/FieldVisit';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  return children;
}

function ClientRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'cliente') return <Navigate to="/dashboard" />;
  return children;
}

function AdminRoute({ children }) {
  const { user, isAdmin } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (!isAdmin) return <Navigate to="/dashboard" />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="sites" element={<Sites />} />
        <Route path="sites/:id" element={<SiteDetail />} />
        <Route path="sites/:siteId/sketch/:sketchId" element={<SketchEditor />} />
        <Route path="sites/:siteId/sketch/new" element={<SketchEditor />} />
        <Route path="events" element={<Events />} />
        <Route path="events/:id" element={<EventDetail />} />
        <Route path="quotations" element={<Quotations />} />
        <Route path="quotations/:id" element={<QuotationDetail />} />
        <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
        <Route path="catalogs" element={<AdminRoute><Catalogs /></AdminRoute>} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="qr-scanner" element={<QRScanner />} />
        <Route path="field-visit" element={<FieldVisit />} />
        <Route path="invoices" element={<AdminRoute><Invoices /></AdminRoute>} />
      </Route>
      <Route path="/portal" element={<ClientRoute><PortalLayout /></ClientRoute>}>
        <Route index element={<PortalDashboard />} />
        <Route path="sites" element={<PortalSitesList />} />
        <Route path="sites/:id" element={<PortalSiteDetail />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}