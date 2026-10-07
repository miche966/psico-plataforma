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
- **Claves nuevas de Supabase** (desde 2026-10-02): producción usa `publishable` y `secret` (se pueden rotar y revocar de a
  una); las claves clásicas se quitaron de Vercel y el 2026-10-02 se deshabilitaron las claves clásicas y se revocó el secreto JWT legado (Legacy HS256): `anon` y `service_role` clásicas verificadas inválidas (401, también en Storage). Ver `docs/CLAVES_SUPABASE.md`.
- **Proyecto de Vercel duplicado eliminado** (2026-10-02): `psico-plataforma-master`, un proyecto viejo conectado al mismo
  repositorio, seguía público con una versión antigua sin las protecciones (rutas de IA y de R2 sin sesión) y con los
  secretos de la plataforma. Se borró y se rotó la clave de Gemini (la anterior estuvo en ese proyecto). Sin señales de
  abuso en R2. Los despliegues antiguos del proyecto vivo están protegidos por la autenticación de Vercel.
- **`braces` sin parche, solo en herramientas de desarrollo** (2026-10-06): `npm audit` marca 5 avisos altos en la cadena
  `eslint-config-next` → `fast-glob` → `micromatch` → `braces` (agotamiento de pila con patrones de archivo anidados,
  GHSA-vfj7-8cjw-p6xm). No existe versión corregida de `braces`, es código que solo corre al analizar el estilo del código en
  desarrollo y necesitaría un patrón malicioso que aquí nunca se recibe. El control de CI (`npm run audit:dependencias`)
  audita solo las dependencias de producción (`--omit=dev`) y falla ante cualquier aviso alto; `npm audit` completo sigue
  disponible para revisarlo. Reabrir si aparece versión corregida (Dependabot lo avisará) o si `braces` pasa a procesar
  entradas externas.
- **Vida acotada de las sesiones del panel** (2026-10-06): en Supabase (Authentication → Sessions) se fijaron la duración
  máxima de la sesión en 7 días y el vencimiento por inactividad en 8 horas, con una sola sesión por usuario desactivada.
  Limita cuánto serviría un token robado. La sesión sigue guardándose en `localStorage` (cookies httpOnly queda como
  proyecto futuro) y la CSP conserva `script-src 'unsafe-inline'` (pendiente: CSP con nonce, primero en modo informe;
  la superficie de XSS es baja: sin `dangerouslySetInnerHTML`, `innerHTML`, `eval` ni iframes).
- **TLS del correo de recordatorios** (2026-10-06): la conexión al servidor de correo (Zimbra propio, `EMAIL_HOST`, puerto 587
  con STARTTLS) ya no usa `rejectUnauthorized: false`. Ese servidor presenta el certificado autogenerado por la CA de
  Zimbra (válido hasta 2029-01-29), que Node no reconoce. Ahora la validación es estricta y se confía solo en esa CA:
  variable `EMAIL_TLS_CA` (certificado PEM de la CA, que entrega quien administra Zimbra: `/opt/zimbra/ssl/zimbra/ca/ca.pem`).
  Mientras no esté cargada, `EMAIL_TLS_INSEGURO=true` mantiene el comportamiento anterior (se avisa en el log); sin ninguna
  de las dos el envío falla con el mensaje "El certificado del servidor de correo no es de confianza". Ver
  `lib/server/smtpTls.ts`. Aparte, el firewall de IT sigue pendiente para el envío desde Vercel.
- **CSP estricta con nonce, ACTIVA** (2026-10-06): en Producción `CSP_MODO=estricta` (`lib/server/csp.ts`, `proxy.ts`): `script-src`
  usa un nonce por visita + `'strict-dynamic'` y **ya no permite `'unsafe-inline'`** (tampoco manejadores en línea ni
  `javascript:`); permite compilar WebAssembly (`'wasm-unsafe-eval'`, la librería de PDF) y `data:` en `connect-src`. Se activó tras
  observar en local, con sesión de administrador y con un candidato descartable, que no bloquea nada de la plataforma
  (panel, informe/PDF, videos, tests, entrevista). `style-src` conserva `'unsafe-inline'` (atributos `style={...}`). Las
  páginas se renderizan en cada visita. Las violaciones que reporten los navegadores quedan como líneas `[CSP]` en los
  logs de Vercel (`/api/csp-report`). Marcha atrás: quitar la variable `CSP_MODO` y redesplegar (vuelve la política con
  `'unsafe-inline'`; la variable se lee al compilar). Nota: `'strict-dynamic'` permite que un script ya autorizado cree otros
  dinámicamente; lo que bloquea es el HTML inyectado (scripts y manejadores en línea).
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

## 2. Videos de entrevista sin respaldo (Cloudflare R2) — RIESGO ACEPTADO

- **Decisión**: no se hace copia de respaldo de los videos de las entrevistas. Tampoco se acota la clave de R2 a un
  bucket por ahora: la cuenta de Cloudflare tiene un único bucket (el de los videos), así que no habría nada más que
  proteger (ver "Mitigación").
- **Fecha**: 2026-10-02
- **Decidió**: Michel Ochoa (responsable de la plataforma)
- **Origen**: punto 20 del checklist ("Actualizar, backups y 2FA"). Opciones evaluadas: aceptar, acotar la clave, o
  copia periódica (`docs/RESPALDOS_Y_CUENTAS.md`).

### Qué significa
- R2 no versiona ni copia los objetos: un borrado accidental o una clave filtrada con permiso de borrado destruye los
  videos sin recuperación posible. A 2026-10-02 son **1640 videos, 12,8 GB**.
- Lo que **sí** está respaldado (base de datos, copia diaria de Supabase Pro): la transcripción, el análisis de la IA y
  todos los resultados de los tests. Lo que se perdería es solo la imagen y el audio originales.
- Recuperar un video perdido implicaría pedirle de nuevo la grabación al postulante.

### Mitigación vigente
- Los videos ya no son públicos (URLs firmadas de 2 horas, desde 2026-10-01): no se pueden bajar ni borrar desde afuera.
- La clave de R2 que usa la plataforma tiene permisos de objetos solamente (verificado el 2026-10-02: no puede listar
  buckets ni cambiar la configuración). Vale para todos los buckets de la cuenta, que hoy es uno solo: **si se crea otro
  bucket, hay que reemplazarla por una clave acotada al bucket de los videos.**
- El borrado de videos solo ocurre desde el código al rechazar una subida inválida (`validarVideoR2`).

### Cuándo hay que reabrir esta decisión
- Los videos pasan a ser evidencia que hay que conservar (auditoría, reclamo, requisito legal u organizacional).
- Se pierde o se borra por error un video que se necesitaba.
- Un incidente con la clave de R2 o con la cuenta de Cloudflare, o si se crea otro bucket en la cuenta.
- Sugerencia: revisarla una vez al año, o si el volumen de videos crece mucho.

---

## 3. Intentos del código de 2FA sin bloqueo por cuenta — RIESGO ACEPTADO

- **Decisión**: no se agrega un bloqueo propio por cuenta a los intentos del código de 6 dígitos del segundo factor. Se
  confía en el límite de Supabase (por IP) y en que hace falta la contraseña antes de poder probar códigos.
- **Fecha**: 2026-10-07
- **Decidió**: Michel Ochoa (responsable de la plataforma)
- **Origen**: revisión de los límites de intentos de MFA en Supabase, pendiente desde el cierre del checklist de seguridad.
  Opciones evaluadas: aceptar, un endpoint propio que verifique el código con bloqueo por cuenta, o reforzar solo las
  contraseñas.

### Qué significa
- La verificación del código la hace el navegador directo contra Supabase (`supabase.auth.mfa.challengeAndVerify` en
  `app/login/2fa/page.tsx`). El servidor de la plataforma no ve esos intentos, así que no puede contarlos ni bloquearlos.
- Según la documentación de Supabase (https://supabase.com/docs/guides/auth/rate-limits, consultada el 2026-10-07), los
  pedidos `/auth/v1/factors/:id/challenge` y `/verify` tienen un límite de **15 por minuto por IP, con ráfagas de hasta 30**.
  Ese límite figura como **no configurable** en el panel (Authentication → Rate Limits no lo ajusta), y la documentación
  no menciona ningún bloqueo por usuario tras varios códigos incorrectos. No se pudo comprobar la configuración real del
  proyecto: son los valores documentados.
- Cuenta aproximada: cada intento usa dos pedidos (challenge y verify), unos 7 intentos por minuto por IP, unos 10.000 por
  día. Un código de 6 dígitos tiene 3 valores válidos a la vez (tolerancia de un intervalo de 30 s), o sea 3 en un millón
  por intento: cerca de **3 % de probabilidad de acertar por día desde una IP**, y más de 75 % por día con 50 IPs.

### Por qué se aceptó
- Para probar códigos hace falta antes una sesión de primer paso, es decir, **conocer la contraseña de un administrador**,
  y el login de la plataforma ya limita los intentos de contraseña (`/api/login`: por IP y 5 por 15 minutos por email,
  en `lib/server/rateLimit.ts`). El 2FA es la segunda barrera, no la primera.
- Hay pocas cuentas de administrador y de solo lectura.
- La alternativa (verificar el código desde un endpoint propio con bloqueo por cuenta, usando el Upstash que ya se usa
  para el login) toca la puerta de entrada de todos los administradores: un error puede dejarlos sin acceso, y solo se
  puede probar de punta a punta con un autenticador real. Cuesta bastante más que el riesgo que cubre.

### Controles compensatorios vigentes
- 2FA obligatorio en el panel (`MFA_OBLIGATORIO=true`, desde 2026-10-02; ver `docs/DOBLE_FACTOR.md`).
- Límites de contraseña en `/api/login` y límite por IP de Supabase para el código.
- Recomendado (sin código): contraseñas únicas y largas, con administrador de contraseñas, y activar en Supabase la
  protección contra contraseñas filtradas (Authentication → Attack Protection) si el plan lo incluye. No se confirmó que
  esté disponible ni activada.

### Cuándo hay que reabrir esta decisión
- Se suman muchas cuentas de administrador o de solo lectura, o el panel pasa a guardar datos mucho más sensibles.
- Aparecen muchos intentos de acceso fallidos o una sesión de primer paso sospechosa en el registro.
- Se filtra o se sospecha filtrada la contraseña de una cuenta de administrador.
- Supabase publica un límite por usuario para MFA, o cambia el límite por IP (en ese caso, volver a hacer la cuenta).
- Sugerencia: revisarla una vez al año.

### Si se decide implementar más adelante
Endpoint propio que reciba el código con la sesión del usuario, aplique un límite por usuario (por ejemplo 5 fallos cada
15 minutos con `Ratelimit` de Upstash) y llame a `mfa.verify` en el servidor, devolviendo la sesión `aal2` al navegador.
Hay que dejar abierta una vía de recuperación para el administrador bloqueado (ver `docs/DOBLE_FACTOR.md`) y probarlo con un
autenticador real antes de desplegarlo.

---

## Pendientes conocidos (abiertos, sin decisión tomada)

Estos puntos **no** están aceptados: son pendientes que se conocen y que nadie decidió todavía.

| Pendiente | Detalle |
|---|---|
| ~~Claves del proyecto Supabase viejo en el historial público de git~~ | **Cerrado el 2026-10-02.** Las claves clásicas (`anon` y `service_role`) del proyecto viejo (`hgoumdjvusixbjkiexjd`) estuvieron en el historial público del repositorio desde 2026-05-02 (primer commit que las incluyó; GitHub abrió la alerta de *secret scanning* el 2026-05-04, ya cerrada como revocada) y, hasta el cierre, la `anon` permitía **leer** `candidatos`, `sesiones` y `respuestas_video` (el proyecto no tenía seguridad por filas). Se deshabilitaron las claves clásicas (*Disable JWT-based API keys*) y se verificó que la `anon` filtrada y la clave de la migración responden 401. Los datos útiles se migraron al proyecto actual (`docs/MIGRACION_PROYECTO_VIEJO.md`). **Quedan en el historial de git** los valores, ya inservibles. Pendiente: evaluar con quien corresponda si la exposición (2026-05-02 a 2026-10-02, datos de unos 322 candidatos) obliga a algún aviso, y borrar el proyecto viejo cuando se decida (antes, exportar si se quiere conservar lo que solo vive allí: 689 resultados de tests retirados, 10 conflictos y el texto de 2 preguntas). |
| ~~Vulnerabilidades en `nodemailer` y `xlsx`~~ | **Cerrado el 2026-10-01**: `nodemailer` 10.0.13 y `xlsx` 0.20.3 (versión corregida, publicada solo en el CDN oficial de SheetJS, con hash de integridad en `package-lock.json`). `npm audit` da 0 vulnerabilidades y el CI pasó de `--audit-level=critical` a `high`. |
| `puntaje_bruto` calculado en el navegador | **Mitigado y cerrado el 2026-10-07 (Fase G)**: en los 19 tests que el servidor puntúa (18 desde el 2026-10-06 e ICAR desde el 2026-10-07), el navegador manda solo la elección y el servidor calcula y guarda el puntaje; el GET nunca entrega la clave de corrección y el modo estricto es permanente (ya no depende de una variable). Queda fuera Frases Incompletas (texto libre, sin respuestas correctas). Seguimiento: correr `npm run audit:puntajes` alrededor del 2026-10-14. Estado, controles y verificación en `docs/PUNTAJE_EN_SERVIDOR.md`. |
| ~~`forgot-password` / `reset-password`~~ | **Cerrado el 2026-10-01**: el pedido de recuperación pasa por `/api/forgot-password`, con límite por IP (5 por minuto) y por email (3 por hora), y responde igual exista o no la cuenta. `reset-password` no necesita límite propio: solo funciona con la sesión de recuperación que emite Supabase desde el enlace del correo. |
| Bloqueo del firewall SMTP | El servidor de correo corporativo bloquea las IPs dinámicas de Vercel para el envío de recordatorios. |
| Candidatos históricos del bug de `/unirse` | 128 candidatos con sesión "pendiente" anterior al 2026-08-03 que nunca recibieron un link válido; el listado se entregó y falta una decisión de negocio. |
| ~~2FA del panel~~ | **Activado el 2026-10-02** (`MFA_OBLIGATORIO=true` en Producción): el panel exige código de app autenticadora (admin y cuentas de solo lectura). Guía, recuperación y marcha atrás en `docs/DOBLE_FACTOR.md`. |
| Sesión del panel en `localStorage` | El token de sesión de administrador vive en `localStorage` del navegador (lo lee cualquier script que se ejecute en la página). Pasarla a cookies httpOnly es un cambio grande (login, pantallas, rutas, protección CSRF) que se decide aparte; la CSP y los demás encabezados reducen el riesgo de XSS. |
| 2FA de las cuentas de los servicios y prueba de restauración de la base | Activar la verificación en dos pasos en GitHub, Vercel, Supabase, Cloudflare, Google y el correo; comprobar los respaldos diarios de Supabase y probar una restauración en un proyecto nuevo. Son acciones del dueño de las cuentas: lista en `docs/RESPALDOS_Y_CUENTAS.md`. |
