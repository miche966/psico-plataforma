# Riesgos aceptados y pendientes de seguridad

Este documento registra las decisiones de seguridad que se tomaron **conscientemente** de no implementar,
con el motivo y las condiciones que obligarían a revisarlas. La idea es que quien lea esto dentro de unos
meses entienda que no fue un olvido.

---

## 1. Cifrado de datos sensibles a nivel de aplicación — RIESGO ACEPTADO

- **Decisión**: no se cifran a nivel de aplicación los datos personales ni los resultados de los candidatos.
- **Fecha**: 2026-10-01
- **Decidió**: Michel Ochoa (responsable de la plataforma)
- **Origen**: punto 5 del checklist de seguridad revisado en esa fecha ("Cifra datos sensibles"), que quedó
  como parcial: hoy solo hay cifrado de infraestructura.

### Qué existe hoy

- Cifrado en reposo del disco y en tránsito (TLS) a cargo de Supabase y Vercel. Según la documentación de
  Supabase, los datos en reposo se cifran con AES-256; esto no está verificado de forma independiente desde el
  repositorio.
- Ningún campo se cifra a nivel de aplicación.

### Datos que quedan sin cifrado de aplicación

| Tabla | Columnas |
|---|---|
| `candidatos` | `email`, `documento`, `edad`, `sexo`, `formacion`, `profesion` |
| `sesiones` | `puntaje_bruto`, `puntaje_t`, `percentiles` (incluye resultados de DASS-21) |
| `respuestas` | `valor` |
| `respuestas_video` | `url_video`, `transcripcion`, `analisis` |
| `informes_psicometricos` | `contenido` |
| `recordatorios_evaluacion` | `email` |

### Por qué se aceptó

1. **El cifrado de aplicación solo agrega protección contra un escenario puntual**: alguien con acceso directo a
   la base de datos (la clave `service_role` o el Dashboard de Supabase). Contra el resto de las amenazas
   (robo del disco, acceso anónimo, otro usuario de la plataforma) ya hay otras capas.
2. **`email` y `documento` se usan en búsquedas** (`.eq`, `.ilike`, `.in`) en `unirse`, `admin/candidatos`,
   `admin/procesos` y `admin/videos-candidato`, y tienen restricción `UNIQUE`. Cifrarlos rompe esas
   búsquedas y la unicidad, salvo que se agregue una columna hash determinística (HMAC del valor normalizado)
   y se migren los ~420 candidatos reales existentes.
3. **Costo y riesgo operativo**: una clave de cifrado perdida o rotada mal deja datos ilegibles de forma
   irrecuperable. Es un riesgo nuevo que hoy no existe.

### Controles compensatorios vigentes

- RLS activo en las 15 tablas, sin políticas para `anon` ni `authenticated` (solo el servidor accede).
- La clave `service_role` vive solo del lado del servidor; el navegador usa únicamente la clave pública.
- Autenticación de administrador en cada endpoint admin; las cuentas `viewer` ven solo los procesos asignados.
- **Registro de accesos** (`registro_accesos`): queda anotado quién abrió el informe, los videos o las
  respuestas de un candidato, y cuándo (desde 2026-10-01).
- **Videos de entrevista en buckets privados** (desde 2026-10-01): el acceso público está desactivado en Cloudflare R2
  (subdominio `r2.dev`) y en Supabase Storage (`videos-entrevista`). Los administradores reciben URLs firmadas de
  lectura que vencen a las 2 horas; `analizar-video` lee el video con las credenciales del servidor. Quien copie una
  URL firmada ve ese video hasta que venza (no es control de acceso por usuario). Para revertir basta reactivar el
  acceso público en Cloudflare y marcar el bucket de Supabase como público; la base no se modificó.
- **Verificación en dos pasos en el panel** (desde 2026-10-02): el servidor exige una sesión con el código de la app
  autenticadora (`aal2`) en todas las rutas de administración. Ver `docs/DOBLE_FACTOR.md`.
- Rate limiting en los endpoints públicos y de IA; bloqueo de intentos de login; Turnstile en `/unirse`.
- Cabeceras de seguridad HTTP (CSP, HSTS, etc.), validación de entradas con zod y auditoría de dependencias en CI.

### Cuándo hay que reabrir esta decisión

- Aparece un **requisito legal o de la organización** (normativa de protección de datos personales, auditoría
  externa, requisito de un cliente). A tener en cuenta: los resultados de DASS-21 (estrés, ansiedad,
  depresión) pueden considerarse datos sensibles relacionados con la salud; conviene que la organización lo
  evalúe con quien corresponda.
- Un **incidente de seguridad** que involucre acceso a la base de datos o filtración de la clave `service_role`.
- Se cambia de proveedor de base de datos o de hosting.
- Sugerencia: revisarla al menos una vez al año aunque nada de lo anterior ocurra.

### Si se decide implementar más adelante

Alcance recomendado, de menor a mayor costo:

1. **Primero**, el contenido libre que nunca se usa para buscar: `informes_psicometricos.contenido` y
   `respuestas_video.transcripcion`. Cifrado AES-GCM en la aplicación, con la clave en una variable de entorno
   del servidor. No afecta ninguna búsqueda.
2. **Solo si hace falta**: `email` y `documento`, con columna hash (HMAC) para las búsquedas y migración de los
   datos existentes.

---

## Pendientes conocidos (abiertos, sin decisión tomada)

Estos puntos **no** están aceptados: son pendientes que se conocen y que nadie decidió todavía.

| Pendiente | Detalle |
|---|---|
| **Claves del proyecto Supabase viejo en el historial público de git** | **Prioridad alta.** El repositorio es público y entre 2026-05-07 y 2026-10-01 tuvo en `scratch/` una clave `service_role` (acceso total) y una `anon` del proyecto viejo (`hgoumdjvusixbjkiexjd`), válidas hasta 2036. El 2026-10-01 se sacó `scratch/` de `master` y el validador del repositorio pasó a escanear todo lo rastreado, pero **las claves siguen en el historial de git**. El proyecto viejo responde como uno activo. Lo que cierra el riesgo es dar de baja el proyecto o rotar su secreto JWT en el Dashboard de Supabase; borrar el historial (reescribirlo y forzar un push) es opcional y no reemplaza a lo anterior. Las claves del proyecto actual no estuvieron expuestas. |
| ~~Vulnerabilidades en `nodemailer` y `xlsx`~~ | **Cerrado el 2026-10-01**: `nodemailer` 10.0.13 y `xlsx` 0.20.3 (versión corregida, publicada solo en el CDN oficial de SheetJS, con hash de integridad en `package-lock.json`). `npm audit` da 0 vulnerabilidades y el CI pasó de `--audit-level=critical` a `high`. |
| `puntaje_bruto` calculado en el navegador | El puntaje de cada test lo calcula el navegador del candidato y el servidor lo guarda tal cual (solo se acota el tamaño). Un candidato con su link válido podría enviar puntajes arbitrarios. Corregirlo de raíz implica recalcular cada puntaje en el servidor a partir de las respuestas (~20 tests distintos). |
| ~~`forgot-password` / `reset-password`~~ | **Cerrado el 2026-10-01**: el pedido de recuperación pasa por `/api/forgot-password`, con límite por IP (5 por minuto) y por email (3 por hora), y responde igual exista o no la cuenta. `reset-password` no necesita límite propio: solo funciona con la sesión de recuperación que emite Supabase desde el enlace del correo. |
| Bloqueo del firewall SMTP | El servidor de correo corporativo bloquea las IPs dinámicas de Vercel para el envío de recordatorios. |
| Candidatos históricos del bug de `/unirse` | 128 candidatos con sesión "pendiente" anterior al 2026-08-03 que nunca recibieron un link válido; el listado se entregó y falta una decisión de negocio. |
| ~~2FA del panel~~ | **Activado el 2026-10-02** (`MFA_OBLIGATORIO=true` en Producción): el panel exige código de app autenticadora (admin y cuentas de solo lectura). Guía, recuperación y marcha atrás en `docs/DOBLE_FACTOR.md`. |
| Sesión del panel en `localStorage` | El token de sesión de administrador vive en `localStorage` del navegador (lo lee cualquier script que se ejecute en la página). Pasarla a cookies httpOnly es un cambio grande (login, pantallas, rutas, protección CSRF) que se decide aparte; la CSP y los demás encabezados reducen el riesgo de XSS. |
