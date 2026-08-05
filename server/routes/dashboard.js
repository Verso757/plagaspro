const express = require('express');
const { getDb } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard/stats - Main KPI dashboard
router.get('/stats', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const isAdmin = req.user.role === 'admin';
    const userId = req.user.id;

    // Base filters for technicians
    const siteFilter = isAdmin ? '' : `
      AND s.id IN (SELECT site_id FROM site_technicians WHERE user_id = ${userId})
    `;

    // Active clients count
    const clientsCount = isAdmin
      ? db.prepare('SELECT COUNT(*) as count FROM clients WHERE active = 1').get().count
      : db.prepare(`
          SELECT COUNT(DISTINCT c.id) as count
          FROM clients c
          JOIN sites s ON s.client_id = c.id
          JOIN site_technicians st ON st.site_id = s.id
          WHERE st.user_id = ? AND c.active = 1 AND s.active = 1
        `).get(userId).count;

    // Active sites count
    const sitesCount = isAdmin
      ? db.prepare('SELECT COUNT(*) as count FROM sites WHERE active = 1').get().count
      : db.prepare(`
          SELECT COUNT(*) as count FROM site_technicians WHERE user_id = ?
        `).get(userId).count;

    // Traps with issues (dañada or requiere_reemplazo)
    const trapsWithIssues = isAdmin
      ? db.prepare(`
          SELECT COUNT(*) as count FROM trap_points tp
          JOIN sketches sk ON sk.id = tp.sketch_id AND sk.is_active = 1
          WHERE tp.is_active = 1 AND tp.status IN ('dañada', 'requiere_reemplazo')
        `).get().count
      : db.prepare(`
          SELECT COUNT(*) as count FROM trap_points tp
          JOIN sketches sk ON sk.id = tp.sketch_id AND sk.is_active = 1
          JOIN sites s ON s.id = sk.site_id
          JOIN site_technicians st ON st.site_id = s.id
          WHERE st.user_id = ? AND tp.is_active = 1 AND tp.status IN ('dañada', 'requiere_reemplazo')
        `).get(userId).count;

    // Open incidents (high/urgente severity)
    const openIncidents = isAdmin
      ? db.prepare(`
          SELECT COUNT(*) as count FROM events e
          JOIN visits v ON v.id = e.visit_id
          WHERE e.severity IN ('alto', 'urgente')
        `).get().count
      : db.prepare(`
          SELECT COUNT(*) as count FROM events e
          JOIN visits v ON v.id = e.visit_id
          JOIN sites s ON s.id = v.site_id
          JOIN site_technicians st ON st.site_id = s.id
          WHERE st.user_id = ? AND e.severity IN ('alto', 'urgente')
        `).get(userId).count;

    // Recent visits (last 30 days)
    const recentVisits = isAdmin
      ? db.prepare(`
          SELECT COUNT(*) as count FROM visits
          WHERE visit_date >= datetime('now', '-30 days')
        `).get().count
      : db.prepare(`
          SELECT COUNT(*) as count FROM visits
          WHERE technician_id = ? AND visit_date >= datetime('now', '-30 days')
        `).get(userId).count;

    // Quotations pending
    const pendingQuotations = isAdmin
      ? db.prepare("SELECT COUNT(*) as count FROM quotations WHERE status IN ('borrador', 'enviada')").get().count
      : db.prepare("SELECT COUNT(*) as count FROM quotations WHERE created_by = ? AND status IN ('borrador', 'enviada')")
          .get(userId).count;

    // Events by severity
    const eventsBySeverity = isAdmin
      ? db.prepare(`
          SELECT severity, COUNT(*) as count FROM events
          GROUP BY severity ORDER BY count DESC
        `).all()
      : db.prepare(`
          SELECT e.severity, COUNT(*) as count
          FROM events e
          JOIN visits v ON v.id = e.visit_id
          JOIN sites s ON s.id = v.site_id
          JOIN site_technicians st ON st.site_id = s.id
          WHERE st.user_id = ?
          GROUP BY e.severity
          ORDER BY count DESC
        `).all(userId);

    // Top sites with most incidents
    const topSites = isAdmin
      ? db.prepare(`
          SELECT s.id, s.name, c.name as client_name, COUNT(e.id) as incidents_count
          FROM events e
          JOIN visits v ON v.id = e.visit_id
          JOIN sites s ON s.id = v.site_id
          JOIN clients c ON c.id = s.client_id
          GROUP BY s.id
          ORDER BY incidents_count DESC
          LIMIT 5
        `).all()
      : db.prepare(`
          SELECT s.id, s.name, c.name as client_name, COUNT(e.id) as incidents_count
          FROM events e
          JOIN visits v ON v.id = e.visit_id
          JOIN sites s ON s.id = v.site_id
          JOIN clients c ON c.id = s.client_id
          JOIN site_technicians st ON st.site_id = s.id
          WHERE st.user_id = ?
          GROUP BY s.id
          ORDER BY incidents_count DESC
          LIMIT 5
        `).all(userId);

    // Recent events (last 10)
    const recentEvents = isAdmin
      ? db.prepare(`
          SELECT e.*, et.name as event_type_name, c.name as client_name,
                 s.name as site_name, u.full_name as technician_name
          FROM events e
          LEFT JOIN event_types et ON et.id = e.event_type_id
          JOIN visits v ON v.id = e.visit_id
          JOIN sites s ON s.id = v.site_id
          JOIN clients c ON c.id = s.client_id
          JOIN users u ON u.id = v.technician_id
          ORDER BY e.created_at DESC
          LIMIT 10
        `).all()
      : db.prepare(`
          SELECT e.*, et.name as event_type_name, c.name as client_name,
                 s.name as site_name, u.full_name as technician_name
          FROM events e
          LEFT JOIN event_types et ON et.id = e.event_type_id
          JOIN visits v ON v.id = e.visit_id
          JOIN sites s ON s.id = v.site_id
          JOIN clients c ON c.id = s.client_id
          JOIN users u ON u.id = v.technician_id
          WHERE v.technician_id = ?
          ORDER BY e.created_at DESC
          LIMIT 10
        `).all(userId);

    res.json({
      clients_count: clientsCount,
      sites_count: sitesCount,
      traps_with_issues: trapsWithIssues,
      open_incidents: openIncidents,
      recent_visits: recentVisits,
      pending_quotations: pendingQuotations,
      events_by_severity: eventsBySeverity,
      top_sites: topSites,
      recent_events: recentEvents
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// GET /api/dashboard/site/:id - Detailed report for a specific site
router.get('/site/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const siteId = req.params.id;

    // Event count over time (last 12 months)
    const monthlyEvents = db.prepare(`
      SELECT strftime('%Y-%m', e.created_at) as month,
             COUNT(*) as count,
             SUM(CASE WHEN e.severity IN ('alto','urgente') THEN 1 ELSE 0 END) as high_severity
      FROM events e
      JOIN visits v ON v.id = e.visit_id
      WHERE v.site_id = ?
        AND e.created_at >= datetime('now', '-12 months')
      GROUP BY month
      ORDER BY month
    `).all(siteId);

    // Events by trap
    const eventsByTrap = db.prepare(`
      SELECT tp.code, tp.status, tt.name as trap_type_name, COUNT(e.id) as events_count
      FROM trap_points tp
      LEFT JOIN trap_types tt ON tt.id = tp.trap_type_id
      JOIN sketches sk ON sk.id = tp.sketch_id AND sk.is_active = 1
      LEFT JOIN events e ON e.trap_point_id = tp.id
      WHERE sk.site_id = ? AND tp.is_active = 1
      GROUP BY tp.id
      ORDER BY events_count DESC
    `).all(siteId);

    // Events by plague
    const eventsByPlague = db.prepare(`
      SELECT p.name as plague_name, COUNT(e.id) as count
      FROM events e
      JOIN visits v ON v.id = e.visit_id
      LEFT JOIN plagues p ON p.id = e.plague_id
      WHERE v.site_id = ?
      GROUP BY e.plague_id
      ORDER BY count DESC
    `).all(siteId);

    res.json({
      monthly_events: monthlyEvents,
      events_by_trap: eventsByTrap,
      events_by_plague: eventsByPlague
    });
  } catch (err) {
    console.error('Site report error:', err);
    res.status(500).json({ error: 'Error al obtener reporte del sitio' });
  }
});

// GET /api/dashboard/heatmap/:siteId - Heatmap data for a site's traps
router.get('/heatmap/:siteId', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const siteId = req.params.siteId;
    const { plague_id, from, to } = req.query;

    const dateFrom = from || db.prepare("SELECT date('now', '-3 months') as d").get().d;
    const dateTo = to || db.prepare("SELECT date('now') as d").get().d;

    let query = `
      SELECT tp.id, tp.code, tp.x, tp.y, tp.status,
             tt.name as trap_type_name, tt.icon as trap_type_icon,
             COUNT(e.id) as events_count
      FROM trap_points tp
      JOIN sketches sk ON sk.id = tp.sketch_id AND sk.is_active = 1
      LEFT JOIN trap_types tt ON tt.id = tp.trap_type_id
      LEFT JOIN events e ON e.trap_point_id = tp.id
        AND e.created_at >= ? AND e.created_at <= ?
        ${plague_id ? 'AND e.plague_id = ?' : ''}
      WHERE sk.site_id = ? AND tp.is_active = 1
      GROUP BY tp.id
      ORDER BY events_count DESC
    `;

    const params = [dateFrom, dateTo + ' 23:59:59'];
    if (plague_id) params.push(plague_id);
    params.push(siteId);

    const traps = db.prepare(query).all(...params);

    // Normalize intensity (0-1 scale)
    const maxCount = Math.max(...traps.map(t => t.events_count), 1);
    const heatmapData = traps.map(t => ({
      ...t,
      intensity: t.events_count / maxCount
    }));

    res.json(heatmapData);
  } catch (err) {
    console.error('Heatmap error:', err);
    res.status(500).json({ error: 'Error al obtener datos de calor' });
  }
});

module.exports = router;
