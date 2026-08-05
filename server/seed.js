const bcrypt = require('bcryptjs');
const { getDb, initializeDatabase } = require('./database');

function seed() {
  initializeDatabase();
  const db = getDb();

  console.log('Seeding database...');

  // Create admin user (password: admin123)
  const adminHash = bcrypt.hashSync('admin123', 10);
  db.prepare(`INSERT OR IGNORE INTO users (email, password_hash, full_name, role, phone) VALUES (?, ?, ?, ?, ?)`)
    .run('admin@plagas.com', adminHash, 'Administrador Principal', 'admin', '555-0001');

  // Create technician users
  const techHash = bcrypt.hashSync('tecnico123', 10);
  db.prepare(`INSERT OR IGNORE INTO users (email, password_hash, full_name, role, phone) VALUES (?, ?, ?, ?, ?)`)
    .run('tecnico1@plagas.com', techHash, 'Juan Pérez', 'tecnico', '555-0002');
  db.prepare(`INSERT OR IGNORE INTO users (email, password_hash, full_name, role, phone) VALUES (?, ?, ?, ?, ?)`)
    .run('tecnico2@plagas.com', techHash, 'María López', 'tecnico', '555-0003');

  // Trap types
  db.prepare(`INSERT OR IGNORE INTO trap_types (name, description, icon) VALUES (?, ?, ?)`)
    .run('Estación cebo rodenticida', 'Estación para cebo contra roedores (ratas/ratones)', '🐀');
  db.prepare(`INSERT OR IGNORE INTO trap_types (name, description, icon) VALUES (?, ?, ?)`)
    .run('Trampa de pegamento', 'Trampa adhesiva para insectos rastreros y roedores pequeños', '🪤');
  db.prepare(`INSERT OR IGNORE INTO trap_types (name, description, icon) VALUES (?, ?, ?)`)
    .run('Trampa luz UV', 'Trampa de luz ultravioleta para insectos voladores', '🪰');
  db.prepare(`INSERT OR IGNORE INTO trap_types (name, description, icon) VALUES (?, ?, ?)`)
    .run('Trampa de feromonas', 'Trampa con atrayente de feromonas para insectos específicos', '🦋');
  db.prepare(`INSERT OR IGNORE INTO trap_types (name, description, icon) VALUES (?, ?, ?)`)
    .run('Nebulización/aspersión', 'Zona de tratamiento por nebulización o aspersión', '💨');

  // Plagues catalog
  db.prepare(`INSERT OR IGNORE INTO plagues (name, description) VALUES (?, ?)`)
    .run('Ratas', 'Roedores de gran tamaño (Rattus norvegicus, Rattus rattus)');
  db.prepare(`INSERT OR IGNORE INTO plagues (name, description) VALUES (?, ?)`)
    .run('Ratones', 'Roedores pequeños (Mus musculus)');
  db.prepare(`INSERT OR IGNORE INTO plagues (name, description) VALUES (?, ?)`)
    .run('Cucarachas', 'Cucarachas (Blattella germanica, Periplaneta americana)');
  db.prepare(`INSERT OR IGNORE INTO plagues (name, description) VALUES (?, ?)`)
    .run('Hormigas', 'Diversas especies de hormigas');
  db.prepare(`INSERT OR IGNORE INTO plagues (name, description) VALUES (?, ?)`)
    .run('Moscas', 'Moscas y otros dípteros voladores');
  db.prepare(`INSERT OR IGNORE INTO plagues (name, description) VALUES (?, ?)`)
    .run('Mosquitos', 'Mosquitos y zancudos');
  db.prepare(`INSERT OR IGNORE INTO plagues (name, description) VALUES (?, ?)`)
    .run('Termitas', 'Termitas y otros insectos de madera');
  db.prepare(`INSERT OR IGNORE INTO plagues (name, description) VALUES (?, ?)`)
    .run('Chinches', 'Chinches de cama');
  db.prepare(`INSERT OR IGNORE INTO plagues (name, description) VALUES (?, ?)`)
    .run('Arañas', 'Arañas y arácnidos');
  db.prepare(`INSERT OR IGNORE INTO plagues (name, description) VALUES (?, ?)`)
    .run('Pulgas', 'Pulgas y otros parásitos');

  // Event types
  db.prepare(`INSERT OR IGNORE INTO event_types (name, description) VALUES (?, ?)`)
    .run('Revisión rutinaria', 'Inspección programada sin novedades');
  db.prepare(`INSERT OR IGNORE INTO event_types (name, description) VALUES (?, ?)`)
    .run('Hallazgo de plaga', 'Se detectó presencia de plaga');
  db.prepare(`INSERT OR IGNORE INTO event_types (name, description) VALUES (?, ?)`)
    .run('Trampa activada', 'Trampa con captura o evidencia de actividad');
  db.prepare(`INSERT OR IGNORE INTO event_types (name, description) VALUES (?, ?)`)
    .run('Trampa dañada/faltante', 'Trampa en mal estado o desaparecida');
  db.prepare(`INSERT OR IGNORE INTO event_types (name, description) VALUES (?, ?)`)
    .run('Cambio de cebo', 'Se reemplazó el cebo de la estación');
  db.prepare(`INSERT OR IGNORE INTO event_types (name, description) VALUES (?, ?)`)
    .run('Recomendación', 'Recomendación emitida al cliente');
  db.prepare(`INSERT OR IGNORE INTO event_types (name, description) VALUES (?, ?)`)
    .run('Incidencia reportada', 'Incidencia reportada por el cliente');
  db.prepare(`INSERT OR IGNORE INTO event_types (name, description) VALUES (?, ?)`)
    .run('Tratamiento aplicado', 'Se aplicó tratamiento químico/biológico');

  // Action types
  db.prepare(`INSERT OR IGNORE INTO action_types (name, description) VALUES (?, ?)`)
    .run('Cebo repuesto', 'Se reemplazó el cebo rodenticida');
  db.prepare(`INSERT OR IGNORE INTO action_types (name, description) VALUES (?, ?)`)
    .run('Trampa reemplazada', 'Se instaló una trampa nueva en reemplazo');
  db.prepare(`INSERT OR IGNORE INTO action_types (name, description) VALUES (?, ?)`)
    .run('Tratamiento aplicado', 'Se aplicó insecticida/rodenticida');
  db.prepare(`INSERT OR IGNORE INTO action_types (name, description) VALUES (?, ?)`)
    .run('Limpieza realizada', 'Se limpió el área afectada');
  db.prepare(`INSERT OR IGNORE INTO action_types (name, description) VALUES (?, ?)`)
    .run('Barrera física instalada', 'Se instaló barrera física de exclusión');
  db.prepare(`INSERT OR IGNORE INTO action_types (name, description) VALUES (?, ?)`)
    .run('Monitoreo', 'Se realizó monitoreo sin acción adicional');

  // Service catalog
  db.prepare(`INSERT OR IGNORE INTO service_catalog (name, description, default_price, unit) VALUES (?, ?, ?, ?)`)
    .run('Control de roedores básico', 'Instalación y mantenimiento de estaciones de cebo', 1200, 'mensual');
  db.prepare(`INSERT OR IGNORE INTO service_catalog (name, description, default_price, unit) VALUES (?, ?, ?, ?)`)
    .run('Control de insectos rastreros', 'Tratamiento para cucarachas, hormigas, etc.', 1500, 'mensual');
  db.prepare(`INSERT OR IGNORE INTO service_catalog (name, description, default_price, unit) VALUES (?, ?, ?, ?)`)
    .run('Control de insectos voladores', 'Instalación de trampas UV y monitoreo', 1800, 'mensual');
  db.prepare(`INSERT OR IGNORE INTO service_catalog (name, description, default_price, unit) VALUES (?, ?, ?, ?)`)
    .run('Control integral', 'Paquete completo: roedores + insectos + monitoreo', 3500, 'mensual');
  db.prepare(`INSERT OR IGNORE INTO service_catalog (name, description, default_price, unit) VALUES (?, ?, ?, ?)`)
    .run('Fumigación única', 'Servicio de fumigación puntual', 2500, 'servicio');
  db.prepare(`INSERT OR IGNORE INTO service_catalog (name, description, default_price, unit) VALUES (?, ?, ?, ?)`)
    .run('Levantamiento/Diagnóstico', 'Visita de evaluación y diagnóstico inicial', 800, 'servicio');

  console.log('Seed data inserted successfully!');
  console.log('');
  console.log('Default credentials:');
  console.log('  Admin:  admin@plagas.com / admin123');
  console.log('  Tecnico: tecnico1@plagas.com / tecnico123');
  console.log('  Tecnico: tecnico2@plagas.com / tecnico123');
}

seed();