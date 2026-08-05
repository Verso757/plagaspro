const express = require('express');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Ensure uploads directory exists for generated PDFs
const pdfDir = path.join(__dirname, '..', 'uploads', 'documents');
if (!fs.existsSync(pdfDir)) {
  fs.mkdirSync(pdfDir, { recursive: true });
}

// GET /api/documents/certificate/:visitId - Generate service certificate PDF
router.get('/certificate/:visitId', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const visitId = req.params.visitId;

    const visit = db.prepare(`
      SELECT v.*, s.name as site_name, s.address as site_address,
             c.name as client_name, c.contact_person, c.phone as client_phone,
             u.full_name as technician_name
      FROM visits v
      JOIN sites s ON s.id = v.site_id
      JOIN clients c ON c.id = s.client_id
      JOIN users u ON u.id = v.technician_id
      WHERE v.id = ?
    `).get(visitId);

    if (!visit) {
      return res.status(404).json({ error: 'Visita no encontrada' });
    }

    // Events from this visit
    const events = db.prepare(`
      SELECT e.*, et.name as event_type_name, p.name as plague_name,
             tp.code as trap_code, tt.name as trap_type_name
      FROM events e
      LEFT JOIN event_types et ON et.id = e.event_type_id
      LEFT JOIN plagues p ON p.id = e.plague_id
      LEFT JOIN trap_points tp ON tp.id = e.trap_point_id
      LEFT JOIN trap_types tt ON tt.id = tp.trap_type_id
      WHERE e.visit_id = ?
      ORDER BY e.created_at
    `).all(visitId);

    // Get active template
    const template = db.prepare(`
      SELECT * FROM document_templates
      WHERE type = 'certificate' AND active = 1
      ORDER BY id DESC LIMIT 1
    `).get() || {};

    // Generate PDF using pdfmake
    const pdfMake = require('pdfmake/build/pdfmake');
    const pdfFonts = require('pdfmake/build/vfs_fonts');
    pdfMake.vfs = pdfFonts.vfs;
    pdfMake.fonts = {
      Roboto: {
        normal: 'Roboto-Regular.ttf',
        bold: 'Roboto-Medium.ttf',
        italics: 'Roboto-Italic.ttf',
        bolditalics: 'Roboto-MediumItalic.ttf'
      }
    };

    const docDefinition = {
      pageSize: 'LETTER',
      pageMargins: [50, 50, 50, 50],
      content: [
        // Logo and header
        ...(template.logo_path ? [{ image: path.join(__dirname, '..', template.logo_path), width: 150, alignment: 'center', margin: [0, 0, 0, 10] }] : []),
        { text: template.header_text || 'CERTIFICADO DE SERVICIO', style: 'header', alignment: 'center' },
        { text: 'Control de Plagas', fontSize: 12, alignment: 'center', margin: [0, 0, 0, 20], color: template.primary_color || '#003043' },

        // Horizontal line
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2, lineColor: template.primary_color || '#003043' }] },
        { text: ' ', margin: [0, 5, 0, 0] },

        // Client info
        { text: 'DATOS DEL CLIENTE', style: 'sectionHeader', color: template.primary_color || '#003043' },
        { text: `Cliente: ${visit.client_name}`, style: 'info' },
        { text: `Contacto: ${visit.contact_person || 'N/A'}`, style: 'info' },
        { text: `Teléfono: ${visit.client_phone || 'N/A'}`, style: 'info' },
        { text: ' ', margin: [0, 5, 0, 0] },

        // Site info
        { text: 'DATOS DEL SITIO', style: 'sectionHeader', color: template.primary_color || '#003043' },
        { text: `Sitio: ${visit.site_name}`, style: 'info' },
        { text: `Dirección: ${visit.site_address || 'N/A'}`, style: 'info' },
        { text: ' ', margin: [0, 5, 0, 0] },

        // Service info
        { text: 'DETALLES DEL SERVICIO', style: 'sectionHeader', color: template.primary_color || '#003043' },
        { text: `Fecha: ${new Date(visit.visit_date).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`, style: 'info' },
        { text: `Técnico responsable: ${visit.technician_name}`, style: 'info' },
        { text: `Estado del servicio: ${visit.status === 'completed' ? 'Completado' : visit.status === 'in_progress' ? 'En progreso' : 'Planeado'}`, style: 'info' },
        ...(visit.notes ? [{ text: `Notas: ${visit.notes}`, style: 'info' }] : []),
        { text: ' ', margin: [0, 5, 0, 0] },

        // Events
        ...(events.length > 0 ? [
          { text: 'REGISTRO DE EVENTOS', style: 'sectionHeader', color: template.primary_color || '#003043' },
          {
            table: {
              headerRows: 1,
              widths: ['auto', 'auto', 'auto', '*'],
              body: [
                [{ text: 'Trampa', style: 'tableHeader' }, { text: 'Tipo', style: 'tableHeader' }, { text: 'Plaga', style: 'tableHeader' }, { text: 'Observaciones', style: 'tableHeader' }],
                ...events.map(e => [
                  e.trap_code || 'N/A',
                  e.event_type_name || 'General',
                  e.plague_name || 'N/A',
                  e.description || ''
                ])
              ]
            },
            layout: 'lightHorizontalLines'
          }
        ] : [
          { text: 'No se registraron eventos en esta visita.', style: 'info', italics: true }
        ]),

        { text: ' ', margin: [0, 20, 0, 0] },

        // Validation QR code text (simplified - in production generate real QR)
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1, lineColor: '#ccc' }] },
        { text: ' ', margin: [0, 5, 0, 0] },
        { text: `Código de validación: VISIT-${visit.id}-${new Date(visit.visit_date).getTime()}`, fontSize: 8, alignment: 'center', color: '#999' },
        { text: 'Documento generado automáticamente - Válido como comprobante de servicio', fontSize: 8, alignment: 'center', color: '#999' },

        ...(template.footer_text ? [{ text: template.footer_text, fontSize: 8, alignment: 'center', margin: [0, 15, 0, 0], color: '#666' }] : [])
      ],
      styles: {
        header: { fontSize: 22, bold: true, margin: [0, 0, 0, 5] },
        sectionHeader: { fontSize: 13, bold: true, margin: [0, 10, 0, 5] },
        info: { fontSize: 11, margin: [0, 1, 0, 1] },
        tableHeader: { fontSize: 10, bold: true, fillColor: '#e8eaed' }
      },
      defaultStyle: { fontSize: 10 }
    };

    const pdfDoc = pdfMake.createPdfKitDocument(docDefinition);
    const fileName = `certificado_visita_${visitId}_${Date.now()}.pdf`;
    const filePath = path.join(pdfDir, fileName);

    const writeStream = fs.createWriteStream(filePath);
    pdfDoc.pipe(writeStream);
    pdfDoc.end();

    writeStream.on('finish', () => {
      res.download(filePath, `Certificado_Servicio_${visit.site_name.replace(/\s+/g, '_')}.pdf`, (err) => {
        if (err) console.error('Download error:', err);
        // Clean up after download (optional: schedule deletion)
        setTimeout(() => {
          try { fs.unlinkSync(filePath); } catch {}
        }, 60000);
      });
    });

  } catch (err) {
    console.error('Certificate generation error:', err);
    res.status(500).json({ error: 'Error al generar certificado' });
  }
});

// GET /api/documents/report/:siteId - Generate periodic site report
router.get('/report/:siteId', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const siteId = req.params.siteId;
    const { from, to } = req.query;

    const site = db.prepare(`
      SELECT s.*, c.name as client_name, c.contact_person
      FROM sites s
      JOIN clients c ON c.id = s.client_id
      WHERE s.id = ?
    `).get(siteId);

    if (!site) {
      return res.status(404).json({ error: 'Sitio no encontrado' });
    }

    const dateFrom = from || db.prepare("SELECT date('now', '-3 months') as d").get().d;
    const dateTo = to || db.prepare("SELECT date('now') as d").get().d;

    const events = db.prepare(`
      SELECT e.*, et.name as event_type_name, p.name as plague_name,
             tp.code as trap_code, tt.name as trap_type_name,
             v.visit_date, u.full_name as technician_name
      FROM events e
      LEFT JOIN event_types et ON et.id = e.event_type_id
      LEFT JOIN plagues p ON p.id = e.plague_id
      LEFT JOIN trap_points tp ON tp.id = e.trap_point_id
      LEFT JOIN trap_types tt ON tt.id = tp.trap_type_id
      JOIN visits v ON v.id = e.visit_id
      JOIN users u ON u.id = v.technician_id
      WHERE v.site_id = ? AND e.created_at >= ? AND e.created_at <= ?
      ORDER BY e.created_at DESC
    `).all(siteId, dateFrom, dateTo + ' 23:59:59');

    const totalEvents = events.length;
    const highSeverity = events.filter(e => e.severity === 'alto' || e.severity === 'urgente').length;
    const visitsInPeriod = db.prepare(`
      SELECT COUNT(*) as count FROM visits
      WHERE site_id = ? AND visit_date >= ? AND visit_date <= ?
    `).get(siteId, dateFrom, dateTo + ' 23:59:59').count;

    const pdfMake = require('pdfmake/build/pdfmake');
    const pdfFonts = require('pdfmake/build/vfs_fonts');
    pdfMake.vfs = pdfFonts.vfs;

    const docDefinition = {
      pageSize: 'LETTER',
      pageMargins: [50, 50, 50, 50],
      content: [
        { text: 'INFORME DE CONTROL DE PLAGAS', style: 'header', alignment: 'center' },
        { text: `Período: ${new Date(dateFrom).toLocaleDateString('es-MX')} - ${new Date(dateTo).toLocaleDateString('es-MX')}`, fontSize: 11, alignment: 'center', margin: [0, 0, 0, 20] },

        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 2, lineColor: '#003043' }] },
        { text: ' ', margin: [0, 5, 0, 0] },

        { text: 'DATOS GENERALES', style: 'sectionHeader', color: '#003043' },
        { text: `Cliente: ${site.client_name}`, style: 'info' },
        { text: `Sitio: ${site.name}`, style: 'info' },
        { text: `Dirección: ${site.address || 'N/A'}`, style: 'info' },
        { text: ' ', margin: [0, 5, 0, 0] },

        { text: 'RESUMEN DEL PERÍODO', style: 'sectionHeader', color: '#003043' },
        { text: `Total de visitas: ${visitsInPeriod}`, style: 'info' },
        { text: `Total de eventos registrados: ${totalEvents}`, style: 'info' },
        { text: `Eventos de severidad alta/urgente: ${highSeverity}`, style: 'info' },
        { text: ' ', margin: [0, 10, 0, 0] },

        ...(events.length > 0 ? [
          { text: 'DETALLE DE EVENTOS', style: 'sectionHeader', color: '#003043' },
          {
            table: {
              headerRows: 1,
              widths: [60, 'auto', 'auto', 'auto', 'auto', '*'],
              body: [
                [
                  { text: 'Fecha', style: 'tableHeader' },
                  { text: 'Trampa', style: 'tableHeader' },
                  { text: 'Tipo Evento', style: 'tableHeader' },
                  { text: 'Plaga', style: 'tableHeader' },
                  { text: 'Severidad', style: 'tableHeader' },
                  { text: 'Descripción', style: 'tableHeader' }
                ],
                ...events.map(e => [
                  new Date(e.visit_date).toLocaleDateString('es-MX'),
                  e.trap_code || 'N/A',
                  e.event_type_name || 'General',
                  e.plague_name || 'N/A',
                  e.severity.charAt(0).toUpperCase() + e.severity.slice(1),
                  e.description || ''
                ])
              ]
            },
            layout: 'lightHorizontalLines'
          }
        ] : [
          { text: 'No se registraron eventos en este período.', style: 'info', italics: true }
        ]),

        { text: ' ', margin: [0, 30, 0, 0] },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1, lineColor: '#ccc' }] },
        { text: 'Documento generado automáticamente', fontSize: 8, alignment: 'center', color: '#999', margin: [0, 10, 0, 0] }
      ],
      styles: {
        header: { fontSize: 22, bold: true },
        sectionHeader: { fontSize: 13, bold: true, margin: [0, 10, 0, 5] },
        info: { fontSize: 11, margin: [0, 1, 0, 1] },
        tableHeader: { fontSize: 9, bold: true, fillColor: '#e8eaed' }
      },
      defaultStyle: { fontSize: 9 }
    };

    const pdfDoc = pdfMake.createPdfKitDocument(docDefinition);
    const fileName = `informe_sitio_${siteId}_${Date.now()}.pdf`;
    const filePath = path.join(pdfDir, fileName);
    const writeStream = fs.createWriteStream(filePath);
    pdfDoc.pipe(writeStream);
    pdfDoc.end();

    writeStream.on('finish', () => {
      res.download(filePath, `Informe_${site.name.replace(/\s+/g, '_')}_${dateFrom}_${dateTo}.pdf`, (err) => {
        if (err) console.error('Download error:', err);
        setTimeout(() => {
          try { fs.unlinkSync(filePath); } catch {}
        }, 60000);
      });
    });

  } catch (err) {
    console.error('Report generation error:', err);
    res.status(500).json({ error: 'Error al generar informe' });
  }
});

// GET /api/documents/templates - List templates
router.get('/templates', authenticateToken, (req, res) => {
  const db = getDb();
  const templates = db.prepare('SELECT * FROM document_templates ORDER BY id DESC').all();
  res.json(templates);
});

// POST /api/documents/templates - Create template
router.post('/templates', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    const { name, type, logo_path, header_text, footer_text, primary_color, template_config } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: 'Nombre y tipo son requeridos' });
    }

    const result = db.prepare(`
      INSERT INTO document_templates (name, type, logo_path, header_text, footer_text, primary_color, template_config)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, type, logo_path || null, header_text || null, footer_text || null, primary_color || '#003043', template_config ? JSON.stringify(template_config) : null);

    res.status(201).json({ id: result.lastInsertRowid, name, type });
  } catch (err) {
    console.error('Template creation error:', err);
    res.status(500).json({ error: 'Error al crear plantilla' });
  }
});

module.exports = router;