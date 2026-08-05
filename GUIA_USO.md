# 📖 Guía de Uso — PlagasPro

Manual paso a paso para administradores, técnicos y clientes.

---

## 🏠 Inicio de sesión

1. Ingresar a la URL del sistema
2. Introducir email y contraseña
3. Según tu rol, verás diferentes opciones en el menú

---

## 👤 Perfiles de usuario

| Rol | Acceso |
|---|---|
| **Admin** | Todo: clientes, sitios, eventos, cotizaciones, calendario, QR, usuarios, catálogos, cobranza |
| **Técnico** | Dashboard, clientes, sitios, eventos, cotizaciones, calendario, QR scanner |
| **Cliente** | Portal de cliente (dashboard propio, sitios, documentos) |

---

## 📊 Dashboard (Panel de Control)

Al iniciar sesión como admin o técnico, verás:
- **Estadísticas generales**: Clientes activos, sitios, trampas con problemas, incidencias urgentes, visitas recientes
- **Gráfico de eventos por severidad** (pastel)
- **Sitios con más incidencias** (tabla)
- **Eventos recientes** (tabla con últimos 10)

---

## 👥 Gestión de Clientes

### Crear un cliente
1. Ir a **Clientes** en el menú lateral
2. Click en **Nuevo Cliente**
3. Llenar: nombre, contacto, teléfono, email, dirección, tipo de negocio
4. Opcional: asignar `user_id` para acceso al portal de cliente
5. Guardar

### Ver/Editar cliente
1. Click en el nombre del cliente en la lista
2. Ver sus sitios asociados, editar datos, o desactivar

---

## 🏢 Gestión de Sitios

### Crear un sitio
1. Ir a **Sitios** → **Nuevo Sitio**
2. Seleccionar el cliente dueño
3. Nombre del sitio, dirección, frecuencia de servicio (semanal, quincenal, etc.)
4. Asignar técnico(s) responsable(s)

### Crear croquis del sitio
1. Ir al detalle de un sitio
2. Click en **Nuevo Croquis** → se abre el editor

---

## ✏️ Editor de Croquis

### Herramientas disponibles
| Botón | Función |
|---|---|
| ✋ Seleccionar | Mover, redimensionar, seleccionar elementos |
| 🧱 Pared | Dibujar muros (6px = ~15cm). Click inicio → Click fin. Bloqueo a 90° |
| 📐 Área | Dibujar habitaciones. Escribir nombre antes de dibujar |
| 🚪 Puerta | Dibujar puerta sobre muro. Doble click = cambiar lado de apertura |
| 🪟 Ventana | Dibujar ventana sobre muro |
| 📏 Cota | Línea de acotación con medida en metros. Click inicio → Click fin |
| ⬜ Rectángulo | Insertar habitación con medidas exactas (ancho × alto en metros) |
| 📍 Trampa | Colocar puntos de trampa. Seleccionar tipo antes de hacer click |

### Atajos de teclado
| Tecla | Acción |
|---|---|
| `Ctrl + Z` | Deshacer |
| `Ctrl + Shift + Z` | Rehacer |
| `Suprimir` | Eliminar elemento seleccionado |
| `Esc` | Modo selección / Cancelar |
| `Rueda ratón` | Zoom in/out |
| `Ctrl + V` | Pegar imagen como fondo |

### Imagen de fondo
1. Click en **🖼️ Fondo** (esquina superior izquierda)
2. Seleccionar archivo de imagen (JPG, PNG)
3. Ajustar opacidad con el slider en la toolbar
4. También puedes pegar (Ctrl+V) una captura de Google Maps

### Paneles flotantes (esquina inferior derecha)
- **Elementos**: lista de paredes, áreas, puertas, ventanas, cotas. Click para seleccionar, X para eliminar
- **Trampas**: lista de trampas colocadas. Click para editar

### Guardar
1. Click en **Guardar** (esquina superior izquierda)
2. Si es nuevo, te pedirá un nombre

---

## 📋 Registro de Eventos / Visitas

### Crear una visita
1. Ir a **Eventos** → **Nueva Visita**
2. Seleccionar sitio, técnico, fecha
3. Agregar eventos individuales:
   - Seleccionar trampa (del croquis)
   - Tipo de evento (inspección, captura, etc.)
   - Plaga detectada
   - Severidad (bajo, medio, alto, urgente)
   - Descripción y acciones tomadas
   - Foto (opcional)

### Ver eventos
1. Ir a **Eventos**
2. Filtrar por sitio, fecha, tipo
3. Click en un evento para ver detalle completo

---

## 📱 QR Scanner (Registro rápido en terreno)

1. Ir a **QR Scanner** en el menú
2. Apuntar la cámara al código QR de una trampa
3. Automáticamente carga los datos de la trampa
4. Llenar el formulario rápido: tipo de evento, plaga, severidad, descripción
5. Click en **Registrar evento** → listo

También puedes ingresar el código manualmente si no tienes cámara.

---

## 📄 Cotizaciones

### Crear cotización
1. Ir a **Cotizaciones** → **Nueva Cotización**
2. Seleccionar cliente y sitio
3. Agregar items (servicios del catálogo o personalizados)
4. Ajustar cantidades y precios
5. Cambiar estado: borrador → enviada → aceptada/rechazada

---

## 📅 Calendario de Servicios

1. Ir a **Calendario**
2. Ver todas las visitas del mes en vista de calendario
3. **Programar visita**: Click en **Programar visita** → seleccionar sitio, técnico, fecha
4. Filtrar por técnico con el selector superior
5. Colores:
   - 🔵 Azul = Planeada
   - 🟡 Amarillo = En progreso
   - 🟢 Verde = Completada
   - ⚫ Gris = Cancelada

---

## 💰 Gestión de Cobranza (Admin)

1. Ir a **Cobranza**
2. Ver KPIs: total facturado, pendiente, pagado, vencido
3. **Nueva Factura**: Click en el botón → llenar datos (cliente, monto, IVA, fechas)
4. **Cambiar estado**: Click en Pagar / Reabrir / Cancelar según corresponda
5. Filtrar por cliente o estado

---

## 🔧 Catálogos (Admin)

Accesible solo para administradores. Permite gestionar:
- **Plagas**: Tipos de plagas (cucarachas, roedores, etc.)
- **Tipos de trampa**: Trampas de feromonas, pegamento, etc.
- **Tipos de evento**: Inspección, captura, fumigación, etc.
- **Tipos de acción**: Acciones correctivas
- **Catálogo de servicios**: Para cotizaciones

---

## 👤 Gestión de Usuarios (Admin)

1. Ir a **Usuarios**
2. **Nuevo Usuario**: nombre, email, contraseña, rol (admin, tecnico, cliente)
3. Los usuarios con rol `cliente` pueden acceder al portal de cliente

---

## 🌐 Portal de Clientes

Los clientes acceden a `/portal` y ven:
- **Dashboard**: Sus sitios, trampas activas, incidencias, visitas recientes
- **Mis Sitios**: Lista con acceso al detalle de cada uno
- **Detalle de sitio**: Trampas, visitas, eventos, gráfico de tendencias mensual
- **Descargar informes**: Botón "Descargar Informe" genera PDF con eventos del período
- **Descargar certificados**: Icono 📄 junto a cada visita completada

---

## 📑 Generación de Documentos

### Certificado de servicio
1. Ir al detalle de un sitio (o desde portal de cliente)
2. En la lista de visitas, click en el icono 📄 de una visita completada
3. Se descarga un PDF profesional con: datos del cliente, sitio, técnico, eventos registrados, código de validación

### Informe periódico
1. En el detalle de sitio, click en **Descargar Informe**
2. Se genera PDF con todos los eventos del período, resumen, tabla de detalle

---

## 🔔 Notificaciones y alertas

- **Trampas dañadas**: Aparecen en el Dashboard como "Trampas con problemas"
- **Incidencias urgentes**: Eventos con severidad "alto" o "urgente" se muestran en el dashboard
- **Umbrales**: Si configuraste umbrales para trampas, el sistema compara los conteos recientes

---

## 📊 Reportes (Looker Studio — futuro)

Para conectar con Google Looker Studio:
1. Usar los endpoints JSON del backend
2. Crear fuente de datos en Looker Studio
3. Diseñar dashboards personalizados

---

## ❓ Preguntas frecuentes

**¿Cómo agrego una foto al croquis?**
En el editor, click en 🖼️ Fondo y selecciona una imagen. También puedes pegar (Ctrl+V).

**¿Cómo cambio el lado de apertura de una puerta?**
Selecciona la puerta y haz doble click, o usa el panel flotante de edición.

**¿Por qué las paredes pequeñas se ven verticales?**
Asegúrate de que el bloqueo a 90° esté activado (botón 90 ON en la toolbar).

**¿Cómo genero códigos QR para las trampas?**
Desde el QR Scanner, al buscar una trampa sin QR asignado, aparecerá el botón "Generar QR".

**¿Puedo usar el sistema sin internet?**
Como PWA, algunas funciones funcionan offline. Las operaciones que requieren backend necesitan conexión.