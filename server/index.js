const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database');

// Initialize database
initializeDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const clientsRoutes = require('./routes/clients');
const sitesRoutes = require('./routes/sites');
const sketchesRoutes = require('./routes/sketches');
const trapsRoutes = require('./routes/traps');
const eventsRoutes = require('./routes/events');
const catalogsRoutes = require('./routes/catalogs');
const quotationsRoutes = require('./routes/quotations');
const dashboardRoutes = require('./routes/dashboard');
const portalRoutes = require('./routes/portal');
const documentsRoutes = require('./routes/documents');
const calendarRoutes = require('./routes/calendar');
const invoicesRoutes = require('./routes/invoices');
const qrRoutes = require('./routes/qr');
const thresholdsRoutes = require('./routes/thresholds');

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/sketches', sketchesRoutes);
app.use('/api/traps', trapsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/catalogs', catalogsRoutes);
app.use('/api/quotations', quotationsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/portal', portalRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/thresholds', thresholdsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor Plagas API corriendo en http://0.0.0.0:${PORT}`);
});

module.exports = app;