const express = require('express');
const { getDb } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// All portal routes require authentication as 'cliente' role
router.use(authenticateToken);
router.use(requireRole('cliente'));

// GET /api/portal/stats - Dashboard for client user
router.get('/stats', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;

    // Find clients linked to this user
    const clientRecords = db.prepare('SELECT * FROM clients WHERE user_id = ? AND active = 1').all(userId);
    if (clientRecords.length === 0) {
      return res.json({
        clients_count: 0,
        sites_count: 0,
        open_incidents: 0,
        recent_visits: 0,
        traps_active: 0,
        recent_events: [],
        sites: []
      });
    }

    const clientIds = clientRecords.map(c => c.id);
    const placeholders = clientIds.map(() => '?').join(',');

    // Sites count
    const sites = db.prepare(`
      SELECT id, name, address, service_frequency FROM sites
      WHERE client_id IN (${placeholders}) AND active = 1
      ORDER BY name
    `).all(...clientIds);

    const siteIds = sites.map(s => s.id);
    const sitePlaceholders = siteIds.map(() => '?').join(',') || '0';

    // Open incidents
    const openIncidents = db.prepare(`
      SELECT COUNT(*) as count FROM events e
      JOIN visits v ON v.id = e.visit_id
      WHERE v.site_id IN (${sitePlaceholders}) AND e.severity IN ('alto', 'urgente')
    `).get(...siteIds).count;

    // Recent visits (30 days)
    const recentVisits = db.prepare(`
      SELECT COUNT(*) as count FROM visits
      WHERE site_id IN (${sitePlaceholders})
        AND visit_date >= datetime('now', '-30 days')
    `).get(...siteIds).count;

    // Active traps
    const trapsActive = db.prepare(`
      SELECT COUNT(*) as count FROM trap_points tp
      JOIN sketches sk ON sk.id = tp.sketch_id AND sk.is_active = 1
      WHERE sk.site_id IN (${sitePlaceholders}) AND tp.is_active = 1 AND tp.status = 'activa'
    `).get(...siteIds).count;

    // Recent events
    const recentEvents = db.prepare(`
      SELECT e.*, et.name as event_type_name, p.name as plague_name,
             s.name as site_name, u.full_name as technician_name,
             tp.code as trap_code
      FROM events e
      LEFT JOIN event_types et ON et.id = e.event_type_id
      LEFT JOIN plagues p ON p.id = e.plague_id
      JOIN visits v ON v.id = e.visit_id
      JOIN sites s ON s.id = v.site_id
      JOIN users u ON u.id = v.technician_id
      LEFT JOIN trap_points tp ON tp.id = e.trap_point_id
      WHERE v.site_id IN (${sitePlaceholders})
      ORDER BY e.created_at DESC
      LIMIT 10
    `).all(...siteIds);

    res.json({
      clients_count: clientRecords.length,
      sites_count: sites.length,
      open_incidents: openIncidents,
      recent_visits: recentVisits,
      traps_active: trapsActive,
      clients: clientRecords,
      sites,
      recent_events: recentEvents
    });
  } catch (err) {
    console.error('Portal stats error:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas del portal' });
  }
});

// GET /api/portal/sites/:id - Detail of a specific site for client
router.get('/sites/:id', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const siteId = req.params.id;

    // Verify the site belongs to this client user
    const site = db.prepare(`
      SELECT s.*, c.name as client_name
      FROM sites s
      JOIN clients c ON c.id = s.client_id
      WHERE s.id = ? AND c.user_id = ? AND s.active = 1
    `).get(siteId, userId);

    if (!site) {
      return res.status(404).json({ error: 'Sitio no encontrado o sin acceso' });
    }

    // Traps in this site
    const traps = db.prepare(`
      SELECT tp.*, tt.name as trap_type_name, tt.icon as trap_type_icon
      FROM trap_points tp
      JOIN sketches sk ON sk.id = tp.sketch_id AND sk.is_active = 1
      LEFT JOIN trap_types tt ON tt.id = tp.trap_type_id
      WHERE sk.site_id = ? AND tp.is_active = 1
      ORDER BY tp.code
    `).all(siteId);

    // Recent visits
    const visits = db.prepare(`
      SELECT v.*, u.full_name as technician_name
      FROM visits v
      JOIN users u ON u.id = v.technician_id
      WHERE v.site_id = ?
      ORDER BY v.visit_date DESC
      LIMIT 20
    `).all(siteId);

    // Recent events
    const events = db.prepare(`
      SELECT e.*, et.name as event_type_name, p.name as plague_name,
             u.full_name as technician_name, tp.code as trap_code
      FROM events e
      LEFT JOIN event_types et ON et.id = e.event_type_id
      LEFT JOIN plagues p ON p.id = e.plague_id
      JOIN visits v ON v.id = e.visit_id
      JOIN users u ON u.id = v.technician_id
      LEFT JOIN trap_points tp ON tp.id = e.trap_point_id
      WHERE v.site_id = ?
      ORDER BY e.created_at DESC
      LIMIT 30
    `).all(siteId);

    // Sketches for this site
    const sketches = db.prepare(`
      SELECT id, name, version, background_image, created_at, updated_at
      FROM sketches
      WHERE site_id = ? AND is_active = 1
      ORDER BY version DESC
    `).all(siteId);

    res.json({ site, traps, visits, events, sketches });
  } catch (err) {
    console.error('Portal site detail error:', err);
    res.status(500).json({ error: 'Error al obtener detalle del sitio' });
  }
});

// GET /api/portal/sites/:id/monthly-events - Monthly event data for charts
router.get('/sites/:id/monthly-events', (req, res) => {
  try {
    const db = getDb();
    const userId = req.user.id;
    const siteId = req.params.id;

    // Verify access
    const site = db.prepare(`
      SELECT s.id FROM sites s
      JOIN clients c ON c.id = s.client_id
      WHERE s.id = ? AND c.user_id = ?
    `).get(siteId, userId);

    if (!site) {
      return res.status(404).json({ error: 'Sin acceso' });
    }

    const data = db.prepare(`
      SELECT strftime('%Y-%m', e.created_at) as month,
             COUNT(*) as count,
             SUM(CASE WHEN e.severity IN ('alto','urgente') THEN 1 ELSE 0 END) as high_severity
      FROM events e
      JOIN visits v ON v.id = e.visit_id
      WHERE v.site_id = ? AND e.created_at >= datetime('now', '-12 months')
      GROUP BY month
      ORDER BY month
    `).all(siteId);

    res.json(data);
  } catch (err) {
    console.error('Portal monthly events error:', err);
    res.status(500).json({ error: 'Error al obtener datos mensuales' });
  }
});

module.exports = router;