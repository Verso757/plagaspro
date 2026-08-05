# 🚀 Guía de Implementación — PlagasPro

## Requisitos del sistema

| Componente | Requisito |
|---|---|
| **Node.js** | v18+ |
| **npm** | v9+ |
| **Espacio en disco** | ~500 MB |
| **Memoria RAM** | Mínimo 1 GB libre |
| **Sistema operativo** | Windows, macOS, Linux |

---

## 📦 Estructura del proyecto

```
Plagas/
├── client/                  # Frontend React + Vite + PWA
│   ├── public/              # Archivos estáticos (manifest.json, iconos)
│   ├── src/
│   │   ├── components/      # Layout, PortalLayout
│   │   ├── context/         # AuthContext (login/logout)
│   │   ├── pages/           # Todas las páginas (Dashboard, Clientes, etc.)
│   │   ├── api.js           # Cliente axios con interceptors
│   │   ├── App.jsx          # React Router (todas las rutas)
│   │   ├── main.jsx         # Entry point
│   │   └── index.css        # CSS global (responsive, temas)
│   ├── index.html           # HTML base con meta tags PWA
│   ├── package.json
│   └── vite.config.js       # Config Vite (proxy, PWA plugin)
├── server/                  # Backend Express + SQLite
│   ├── middleware/           # auth.js (JWT, roles)
│   ├── routes/              # Todas las rutas API (16 módulos)
│   ├── uploads/              # Archivos subidos (imágenes, PDFs)
│   ├── database.js          # Esquema SQLite
│   ├── index.js             # Servidor Express
│   ├── seed.js              # Datos iniciales
│   └── package.json
├── IMPLEMENTACION.md         # Este archivo
├── GUIA_USO.md              # Manual de usuario paso a paso
└── package.json             # Workspace root (opcional)
```

---

## 🔧 Instalación local (desarrollo)

### 1. Clonar el repositorio
```bash
git clone https://github.com/verso757/plagaspro.git
cd plagaspro
```

### 2. Instalar dependencias

**Backend:**
```bash
cd server
npm install
```

**Frontend:**
```bash
cd ../client
npm install
```

### 3. Inicializar la base de datos
```bash
cd ../server
node seed.js
```
Esto crea la BD `plagas.db` con datos de prueba (usuarios, catálogos, etc.)

### 4. Iniciar servidores

**Terminal 1 — Backend (puerto 3001):**
```bash
cd server
npm run dev
```

**Terminal 2 — Frontend (puerto 5173):**
```bash
cd client
npm run dev
```

### 5. Acceder al sistema
Abrir navegador en `http://localhost:5173`

**Credenciales de prueba:**
| Rol | Email | Contraseña |
|---|---|---|
| Admin | `admin@plagas.com` | `admin123` |
| Técnico | `tecnico1@plagas.com` | `tecnico123` |
| Cliente | `cliente1@plagas.com` | `cliente123` |

---

## 🌐 Despliegue en producción

### Backend (Render.com / Railway.app — gratuito)

1. Crear cuenta en [Render.com](https://render.com)
2. Conectar con repositorio GitHub
3. Crear "New Web Service":
   - **Root Directory**: `server`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
   - **Environment Variables**: `JWT_SECRET=tu-secreto-unico`
4. Apuntar el dominio público a tu frontend

### Frontend (Hostinger Shared Hosting)

1. **Build de producción:**
   ```bash
   cd client
   npm run build
   ```
   Esto genera la carpeta `client/dist/`

2. **Subir por FTP a Hostinger:**
   - Conectar con FileZilla o similar a tu hosting
   - Subir TODO el contenido de `client/dist/` a `public_html/`

3. **Configurar `.htaccess`** en Hostinger:
   ```
   RewriteEngine On
   RewriteBase /
   RewriteRule ^index\.html$ - [L]
   RewriteCond %{REQUEST_FILENAME} !-f
   RewriteCond %{REQUEST_FILENAME} !-d
   RewriteRule . /index.html [L]
   ```

4. **Actualizar `api.js`** antes del build para apuntar al backend:
   ```js
   // En client/src/api.js, asegurar que BASE_URL apunte a Render
   const BASE_URL = 'https://tu-backend.onrender.com/api';
   ```

---

## 📱 Instalación como PWA

Al abrir el sitio en Chrome/Edge en Android o iOS:
1. Aparecerá un banner "Agregar a pantalla de inicio"
2. O ir a Menú → "Instalar aplicación"
3. Se instalará como app nativa con icono y pantalla completa

---

## 🔄 Actualizar el proyecto

```bash
git pull origin main
cd server && npm install
cd ../client && npm install && npm run build
# Subir carpeta dist/ actualizada por FTP
```

---

## 📊 Estructura de la base de datos

```
users ──── clients ──── sites ──── sketches ──── trap_points
  │                       │                        │
  │                       ├── site_technicians      ├── thresholds
  │                       ├── visits                └── qr_code
  │                       │     └── events
  │                       │           └── event_photos
  │                       └── invoices
  │
  ├── quotations ──── quotation_items
  ├── document_templates
  └── catálogos:
      ├── plagues
      ├── trap_types
      ├── event_types
      ├── action_types
      └── service_catalog
```

---

## 🛠️ Scripts disponibles

### Backend (`server/`)
| Script | Descripción |
|---|---|
| `npm run dev` | Iniciar servidor con watch (recarga automática) |
| `npm start` | Iniciar servidor en producción |
| `npm run seed` | Poblar BD con datos de prueba |

### Frontend (`client/`)
| Script | Descripción |
|---|---|
| `npm run dev` | Iniciar Vite dev server (HMR) |
| `npm run build` | Compilar para producción |
| `npm run preview` | Previsualizar build de producción |