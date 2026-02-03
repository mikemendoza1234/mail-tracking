## 📋 RESUMEN DEL BACKEND ACTUAL

### 🔗 URL de Producción

No desplegado aún (Local: <http://localhost:3000>)

### 🏗️ Arquitectura

- **Framework:** Fastify (Node.js)
- **Base de datos:** PostgreSQL con esquemas multi-tenant y UUIDs.
- **Autenticación:** JWT (Bearer Token).
- **Colas:** Redis/Bull (Configurado pero no totalmente utilizado en endpoints).

### ✅ ENDPOINTS FUNCIONALES

1. `POST /api/auth/register` - Registro de organizaciones y admins.
2. `POST /api/auth/login` - Login y obtención de token.
3. `POST /api/contacts` - Gestión de contactos segura por organización.
4. `GET /o/:orgId/:emailId.png` - Pixel de rastreo funcional.
5. `GET /c/:orgId/:emailId/:data` - Redirección y rastreo de clicks.

### 🎯 WORKFLOWS

- **Estado:** Parcialmente implementado.
- **Endpoints:** Creación y disparo manual (`trigger`) funcionan.
- **Ejecución:** El worker (`src/worker.js`) necesita ser ampliado para procesar tipos de nodos reales.

### 📊 TRACKING

- **Pixel:** Implementado.
- **Clicks:** Implementado.
- **Base de datos:** Tablas `events` y `click_events` registran la actividad.

### 🧪 TESTS

- **Integration:** Tests completos para Auth y Segregación de datos.
- **Load:** Pruebas de carga (Artillery) configuradas para Registro y Tracking.
- **Unit:** Setup básico listo.

### 🔧 PRÓXIMOS PASOS RECOMENDADOS

1. **Completar worker.js:** Implementar la lógica de transición entre nodos de workflow.
2. **Integrar envío de emails:** Conectar AWS SES / Resend / SMTP.
3. **Dashboard:** Crear endpoints de métricas agregadas.
