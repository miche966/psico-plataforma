# Plan: panel para supervisores

Guía de ejecución para implementar, por etapas, un área donde los supervisores de la empresa entran con su propia cuenta y ven **solo los evaluados que el administrador les habilita**: sus videoentrevistas y un informe psicolaboral sencillo, que pueden descargar en PDF.

Escrita el 2026-10-08 para que la ejecute otra sesión (Sonnet). Está pensada para leerse completa antes de empezar cada etapa.

---

## 0. Contexto que necesitás saber antes de tocar nada

- **Proyecto real:** `C:\Users\mochoa\.antigravity\psico-plataforma-master` (no el directorio de la sesión). Next.js 16 (App Router, Turbopack), React 19, TypeScript, Supabase (servidor con `createSupabaseAdmin()`), Vercel.
- **Usuario:** Michel Ochoa. Escribe en español rioplatense (voseo); respondé igual. Crea y fusiona los PR en GitHub él mismo.
- **Flujo por cada etapa (obligatorio):**
  1. Rama nueva desde `master` actualizado (`git checkout master && git pull origin master && git checkout -b <rama>`).
  2. Implementar. Correr `npx tsc --noEmit` y `npm test`.
  3. Resumir al usuario qué cambió, cómo se verificó y qué no se pudo verificar. **Preguntar** "¿Hago el commit y subo la rama?".
  4. Solo con un "Sí" explícito: `git add` **de los archivos de la etapa uno por uno**, commit, `git push -u origin <rama>` (los hooks corren tests, build y validación).
  5. Darle el link `https://github.com/miche966/psico-plataforma/pull/new/<rama>`, un título y una descripción (terminada en `🤖 Generated with [Claude Code](https://claude.com/claude-code)`).
  6. Cuando diga "Listo, verifica": `git fetch`, confirmar que el commit está en `origin/master`, esperar el despliegue (`npx -y vercel@62.7.0 ls --prod`) hasta Ready, y probar rutas con `curl` (200 en páginas, 401 en APIs sin sesión).
- **Nunca** incluir en un commit `docs/AUDITORIA_RLS_Y_MIGRACION_SEGURA.md` (está modificado en el working tree a propósito) ni archivos sin seguimiento ajenos a la etapa.
- **Migraciones:** no se ejecutan desde acá. Se escribe el `.sql` en `supabase/migrations/` (ver su `README.md`), el usuario lo corre en el SQL Editor de Supabase, y después se verifica con una consulta de **solo lectura**.
- **Base de datos:** el servidor local (`localhost:3000`) usa la base de **producción**. Pruebas con datos descartables con nombre "ZZ …", creados y borrados en el mismo script; nunca tocar datos reales. El clasificador puede bloquear escrituras directas a producción: en ese caso pedile al usuario que lo apruebe en el momento.
- **Scripts temporales** que usan `@supabase/supabase-js` tienen que vivir dentro de la carpeta del proyecto para resolver paquetes (`tmp-*.mts`, correr con `node --experimental-strip-types`), y se borran al terminar. Las credenciales salen de `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SECRET_KEY`); nunca se imprimen.
- **Ediciones de archivos:** preferí la herramienta Edit. Si hacés reemplazos con un script de Node, que cada reemplazo verifique que el texto buscado aparece **exactamente una vez** y respete CRLF. No uses heredocs de bash con comillas simples anidadas: fallan.
- **Texto visible:** profesional, claro, sin jerga ni tono alarmista, en español neutro con voseo donde corresponda. Sin MAYÚSCULAS en etiquetas.

## 1. Decisiones ya tomadas por el usuario (no volver a preguntar)

1. Los supervisores son **de la propia empresa**. Una sola empresa: no hace falta agrupar por cliente.
2. Ven en pantalla y **pueden descargar el informe en PDF**.
3. **No ven el dictamen** (recomendado / con reservas / no recomendado), ni en pantalla ni en el PDF.
4. El informe para supervisores **se publica solo después de que el administrador lo aprueba** (borrador → publicado). El supervisor ve únicamente la versión publicada.
5. Quedan **fuera** del informe del supervisor: datos de salud (DASS-21, depresión, ansiedad, bienestar, burnout, estrés clínico), alertas de irregularidad, puntajes, percentiles, factores, siglas y nombres de tests.
6. La habilitación es **por evaluado y proceso**: el supervisor ve la videoentrevista y el informe de esa selección, no los de otras postulaciones de la misma persona.

Pendiente no bloqueante: el usuario va a revisar si el texto de consentimiento que aceptan los postulantes cubre que su video e informe los vea la jefatura que participa en la selección.

## 2. Arquitectura

### Por qué no se reutiliza el rol "viewer"
El rol de solo lectura (`admin_roles` + `admin_role_procesos`, `requireAdminSession` → `role: 'viewer'`) se habilita **por proceso** y entra al **panel técnico completo** (`/api/admin/*`). Si se agregara "supervisor" a `admin_roles`, `buscarRolViewer` lo devolvería como viewer y podría llamar rutas de administración. Por eso el supervisor es un **rol separado, con tablas, autorización, rutas y pantallas propias**.

### Reglas de seguridad que no se negocian
- `requireAdminSession` **nunca** devuelve una sesión para un supervisor (no está en `ADMIN_EMAILS` ni en `admin_roles`, así que recibe 403). No modificar esa función para incluirlos.
- Las rutas del supervisor viven en `app/api/supervisor/*` y usan **solo** `requireSupervisorSession`. Cada una vuelve a comprobar la habilitación (supervisor + candidato + proceso) en el servidor; el navegador nunca decide qué puede ver.
- Esas rutas **jamás** devuelven `sesiones`, `puntaje_bruto`, `respuestas`, `informes_psicometricos` ni el dictamen. Solo: datos básicos del evaluado (nombre, apellido), nombre y cargo del proceso, videos firmados, y el informe **publicado** de `informes_supervisor`.
- 2FA obligatorio igual que el resto (`cumpleMfa`), y el mismo cierre por inactividad.
- Un email no puede ser a la vez administrador o viewer y supervisor: el alta lo rechaza.
- Todo acceso queda en `registro_accesos`.

### Mapa de piezas

| Pieza | Archivo | Etapa |
|---|---|---|
| Migración | `supabase/migrations/agregar_supervisores.sql` | 1 |
| Autorización | `lib/server/supervisorAuth.ts` | 1 |
| Alcance (qué ve) | `lib/server/supervisorAlcance.ts` | 1 |
| Rol en pantalla | `app/api/admin/whoami/route.ts`, `lib/useAdminRole.ts`, `components/AppLayout.tsx`, `app/login/page.tsx`, `app/login/2fa/page.tsx` | 1 |
| Registro de accesos | `lib/server/registroAccesos.ts` | 1 |
| Borrado de candidato | `lib/server/eliminarCandidato.ts` | 1 |
| Test de rutas | `tests/rutas-api.test.ts` | 1 |
| Gestión de supervisores | `app/api/admin/supervisores/route.ts`, `app/accesos/page.tsx` | 2 |
| Habilitaciones | `app/api/admin/supervisor-evaluados/route.ts`, ficha del evaluado | 2 |
| Informe para supervisores | `lib/informeSupervisor.ts`, `app/api/admin/informe-supervisor/route.ts`, `components/InformeSupervisorPDF.tsx`, editor en `app/informe/page.tsx` | 3 |
| Panel del supervisor | `app/supervisor/page.tsx`, `app/supervisor/[...]`, `app/api/supervisor/*` | 4 |

---

## 3. Etapa 1 — Base de datos y acceso

**Rama:** `feature/supervisores-base`. **Objetivo:** que exista el rol supervisor, que pueda iniciar sesión con 2FA y aterrice en `/supervisor` (una página mínima que diga "Todavía no tenés evaluados habilitados"), y que no pueda entrar a nada de administración. No hay pantallas de gestión todavía.

### 3.1 Migración `supabase/migrations/agregar_supervisores.sql`

Escribila así (idempotente, transaccional, aditiva). **No la ejecutes**: se la das al usuario.

```sql
-- Supervisores de la empresa: ven solo los evaluados (candidato + proceso) que el administrador les habilita,
-- con sus videoentrevistas y un informe sencillo publicado por el administrador. Aditivo: no toca filas existentes.
-- Ejecutar a mano en el SQL Editor de Supabase. Reversion: supabase/migrations/revertir_supervisores.sql
BEGIN;

create table if not exists public.supervisores (
  email text primary key,
  nombre text not null default '',
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  invitado_por text
);

create table if not exists public.supervisor_evaluados (
  supervisor_email text not null references public.supervisores(email) on delete cascade,
  candidato_id uuid not null references public.candidatos(id) on delete cascade,
  proceso_id uuid not null references public.procesos(id) on delete cascade,
  habilitado_por text,
  habilitado_en timestamptz not null default now(),
  primary key (supervisor_email, candidato_id, proceso_id)
);
create index if not exists supervisor_evaluados_candidato_idx on public.supervisor_evaluados (candidato_id, proceso_id);

create table if not exists public.informes_supervisor (
  candidato_id uuid not null references public.candidatos(id) on delete cascade,
  proceso_id uuid not null references public.procesos(id) on delete cascade,
  borrador jsonb,
  publicado jsonb,
  actualizado_en timestamptz not null default now(),
  publicado_en timestamptz,
  publicado_por text,
  primary key (candidato_id, proceso_id)
);

-- El registro de accesos tambien anota a los supervisores (antes solo admitia admin y viewer)
alter table public.registro_accesos drop constraint if exists registro_accesos_rol_check;
alter table public.registro_accesos add constraint registro_accesos_rol_check check (rol in ('admin', 'viewer', 'supervisor'));

-- Sin acceso publico: solo el servidor (service role). RLS activo y ninguna politica, igual que el resto.
alter table public.supervisores enable row level security;
alter table public.supervisor_evaluados enable row level security;
alter table public.informes_supervisor enable row level security;

COMMIT;
```

Y `supabase/migrations/revertir_supervisores.sql`:

```sql
-- Revierte agregar_supervisores.sql. Borra las tablas de supervisores (y sus datos) y deja el registro de accesos como antes.
-- Antes de correrlo, si hay filas de rol 'supervisor' en registro_accesos, decidir que hacer con ellas (la restriccion vieja las rechaza).
BEGIN;
drop table if exists public.informes_supervisor;
drop table if exists public.supervisor_evaluados;
drop table if exists public.supervisores;
alter table public.registro_accesos drop constraint if exists registro_accesos_rol_check;
alter table public.registro_accesos add constraint registro_accesos_rol_check check (rol in ('admin', 'viewer'));
COMMIT;
```

**Antes de entregarla, verificá con una consulta de solo lectura** el nombre real de la restricción de `registro_accesos.rol` (puede no llamarse `registro_accesos_rol_check`). Si no podés consultar el catálogo con el cliente de Supabase, avisale al usuario y pedile que corra en el SQL Editor:

```sql
select conname from pg_constraint where conrelid = 'public.registro_accesos'::regclass and contype = 'c';
```

Después de que el usuario la ejecute, verificá (solo lectura) que las tres tablas existen y están vacías.

### 3.2 Autorización `lib/server/supervisorAuth.ts`

- Tipo: `SupervisorSession = { response: NextResponse } | { user: any; role: 'supervisor'; email: string }`.
- `requireSupervisorSession(req, { permitirAal1?: boolean })`: mismo patrón que `requireAdminSession` (`lib/server/adminAuth.ts`): valida el Bearer contra `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user` con `clavePublica()`, exige `cumpleMfa` salvo `permitirAal1`, normaliza el email, y lo busca en `supervisores` **con `activo = true`**. Si el email está en `ADMIN_EMAILS` o en `admin_roles`, **rechaza** (403): una cuenta no puede tener dos roles.
- Extraé a una función pura y testeable la decisión (`decidirRolSupervisor({ email, esAdmin, esViewer, filaSupervisor })`) para cubrirla con tests sin red.

### 3.3 Alcance `lib/server/supervisorAlcance.ts`

- `evaluadosHabilitados(db, email)`: filas de `supervisor_evaluados` del supervisor.
- `estaHabilitado(db, email, candidatoId, procesoId)`: `true` solo si existe la fila exacta. Valida que los ids sean uuid (`z.guid()`, como en `resumenesIa.ts`) antes de consultar.
- Puras donde se pueda, con tests de forma (`tests/supervisores.test.ts`) usando un `db` falso, como hacen `tests/resumenes-ia.test.ts` y `tests/dictamen.test.ts`.

### 3.4 Rol en pantalla e ingreso

- **`app/api/admin/whoami/route.ts`:** hoy llama a `requireAdminSession(request, { permitirAal1: true })`. Si esa respuesta es **403**, probá `requireSupervisorSession(request, { permitirAal1: true })`; si da sesión, respondé `{ role: 'supervisor', allowedProcesoIds: null, mfaRequerido }`. Si no, devolvé la respuesta original. No cambies nada del camino del admin ni del viewer.
- **`lib/useAdminRole.ts`:** `AdminRole = 'admin' | 'viewer' | 'supervisor'` y aceptar `'supervisor'` en la validación de la respuesta.
- **`components/AppLayout.tsx`** (layout del panel de administración): si `role === 'supervisor'`, `router.replace('/supervisor')` y no renderizar el panel. Ojo: hoy llama a `/api/admin/novedades` al montar; para un supervisor va a dar 403, que ya se ignora en silencio. Está bien, pero no le muestres nada del menú.
- **`app/login/page.tsx` (línea ~40) y `app/login/2fa/page.tsx` (líneas ~31 y ~79):** hoy mandan siempre a `/panel`. Dejalo así: `/panel` usa `AppLayout`, que redirige al supervisor a `/supervisor`. Así no se duplica la lógica. Verificá que no haya un parpadeo con datos del panel antes de redirigir (el panel no debería pedir `panel-data` si el rol es supervisor; si lo pide, recibe 403 y no muestra nada, que es aceptable, pero revisalo).
- **`app/supervisor/page.tsx`** (mínima en esta etapa): layout propio y simple (no `AppLayout`), con `useAdminRole` + `useGateMfa`, que si el rol no es `supervisor` mande a `/panel`, y que muestre el nombre de la marca, "Hola" y "Todavía no tenés evaluados habilitados", más "Cerrar sesión" (`supabase.auth.signOut()` → `/login`).

### 3.5 Registro de accesos, borrado y test de rutas

- **`lib/server/registroAccesos.ts`:** sumá a `AccionRegistrada` las acciones del supervisor (`supervisor_ver_evaluados`, `supervisor_ver_evaluado`, `supervisor_ver_videos`, `supervisor_descargar_informe`) y las del admin (`habilitar_supervisor`, `quitar_supervisor`, `publicar_informe_supervisor`). La columna se llama `admin_email` aunque guarde el email del supervisor: no la renombres.
- **`lib/server/eliminarCandidato.ts`:** agregá `supervisor_evaluados` e `informes_supervisor` a `TABLAS_DEL_CANDIDATO` (las claves foráneas ya borran en cascada, pero así el borrado es explícito y tolera que la tabla no exista). Revisá que `tests/eliminar-candidato.test.ts` siga pasando o ajustalo.
- **`tests/rutas-api.test.ts`** (línea ~31): hoy exige que toda ruta no pública contenga `requireAdminSession`. Cambialo a: las rutas bajo `/api/supervisor/` deben contener `requireSupervisorSession` y **no** `requireAdminSession`; el resto, como hasta ahora. Agregá la aserción de que ninguna ruta `/api/supervisor` es pública. El proxy (`proxy.ts`, `lib/server/rutasApi.ts`) no necesita cambios: el supervisor manda un JWT autenticado y el 2FA se exige igual.

### 3.6 Tests de la etapa (`tests/supervisores.test.ts`, sumarlo al script `test` de `package.json`)

- Un email en `ADMIN_EMAILS` o en `admin_roles` nunca obtiene sesión de supervisor.
- Un supervisor inactivo o inexistente recibe 403.
- `estaHabilitado` solo es verdadero con la fila exacta; ids que no son uuid dan falso sin consultar.
- Las rutas `/api/supervisor/*` (cuando existan) usan solo `requireSupervisorSession`.

### 3.7 Verificación de la etapa
- `npx tsc --noEmit`, `npm test`.
- Con el usuario: correr la migración, verificar tablas (solo lectura).
- **Prueba de punta a punta** (requiere que el usuario cree la cuenta, porque la invitación y el 2FA son de él): el usuario da de alta un supervisor de prueba insertando una fila en `supervisores` desde el Table Editor, se invita/crea el usuario en Supabase Auth, enrola el 2FA y entra. Debe terminar en `/supervisor`, y `curl` con su token a `/api/admin/panel-data` debe dar 403. Si no se puede hacer en esta etapa, decilo claramente y dejalo para la etapa 2 (que trae el alta desde la pantalla).

---

## 4. Etapa 2 — Gestión desde el panel del administrador

**Rama:** `feature/supervisores-gestion`.

- **`app/api/admin/supervisores/route.ts`** (solo `requireFullAdmin`):
  - `GET`: lista de supervisores con sus habilitaciones (nombre del evaluado y del proceso).
  - `POST { email, nombre }`: invita con `db.auth.admin.inviteUserByEmail` (copiar el manejo de "already registered" de `app/api/admin/usuarios/route.ts`), y hace upsert en `supervisores`. Rechaza si el email es admin o viewer.
  - `POST { accion: 'desactivar' | 'activar', email }`.
  - `POST { accion: 'restablecer_2fa', email }`: igual que el de las cuentas de solo lectura, pero solo para emails de `supervisores`.
  - Y del lado de cuentas de solo lectura: el alta de viewer debe rechazar un email que ya es supervisor.
- **`app/api/admin/supervisor-evaluados/route.ts`** (solo `requireFullAdmin`):
  - `POST { email, candidato_id, proceso_id }` habilita (valida que el candidato tenga relación con ese proceso: sesiones o `candidatos_procesos`).
  - `DELETE` (o `POST { accion: 'quitar' }`) quita.
  - `GET ?candidato_id=` devuelve quién tiene acceso a ese evaluado.
  - Cada cambio queda en `registro_accesos` (`habilitar_supervisor` / `quitar_supervisor`).
- **`app/accesos/page.tsx`:** sección "Supervisores" con alta (email + nombre), lista (estado, evaluados habilitados), activar/desactivar y restablecer 2FA. Seguí el estilo de la sección de cuentas de solo lectura de esa misma página.
- **Ficha del evaluado:** en `app/informe/page.tsx` (solo admin, no viewer), un apartado "Compartir con supervisores": elegir supervisor (lista de activos) y proceso (los del evaluado), ver la lista actual y quitar. Texto de ayuda: "El supervisor verá la videoentrevista de este proceso y el informe para supervisores, cuando lo publiques."
- **Tests:** validaciones de entrada, rechazo de emails con doble rol, y que un viewer no pueda llamar a estas rutas.
- **Verificación:** con un supervisor y un evaluado "ZZ" descartables (crear y borrar en el mismo script), comprobar alta, habilitación y baja.

---

## 5. Etapa 3 — Informe para supervisores

**Rama:** `feature/informe-supervisor`.

### 5.1 Contenido (`lib/informeSupervisor.ts`)

```ts
export type InformeSupervisor = {
  version: 1
  comoTrabaja: string          // estilo de trabajo, organización, ritmo
  queAporta: string            // qué puede aportar al equipo
  comoAcompanarlo: string      // sugerencias concretas para su incorporación
  aTenerEnCuenta: string       // aspectos a cuidar, en tono constructivo
  entrevista: string | null    // lo que surgió en la videoentrevista (null si no hay)
}
```

- `normalizarInformeSupervisor(valor)`: acepta solo strings, recorta largos (por ejemplo 1.500 caracteres por sección), descarta lo demás.
- `revisarTerminos(informe)`: devuelve `{ bloqueantes: string[], advertencias: string[] }`.
  - **Bloqueantes** (no se puede publicar): el dictamen (`recomendad[oa]`, `no recomendad[oa]`, `con reservas`, `dictamen`, `apto`, `no apto`), salud (`depresi`, `ansiedad`, `DASS`, `burnout`, `salud mental`, `diagn[oó]stic`), números de evaluación (`\d+\s*%`, `percentil`, `puntaje`, `/100`, `/5`), nombres de tests y siglas (`Big Five`, `HEXACO`, `ICAR`, `SJT`, `MBTI`, `neuroticismo`, `test`).
  - **Advertencias** (se puede publicar, pero se muestran): `estrés`, `factor`, `escala`, `dimensión`.
  - Usá expresiones con límites de palabra y sin distinguir mayúsculas. "Se recomienda acompañar…" **no** debe bloquear (no es "recomendado"): cubrilo con un test.
- Tests en `tests/informe-supervisor.test.ts`: normalización, cada bloqueante, el falso positivo "se recomienda", y que un informe limpio pase.

### 5.2 Generación con IA (`app/api/admin/informe-supervisor/route.ts`)

- Solo `requireFullAdmin`. Límite con `rlAdmin` (ver `app/api/ia-summary/route.ts`, que es el patrón a copiar: `GEMINI_MODEL`, 3 intentos con espera, `maxOutputTokens` con margen para el "thinking").
- **Entrada:** el informe psicolaboral **ya guardado y aprobado** (`informes_psicometricos.contenido`) del candidato, más el cargo del proceso. Si no hay informe guardado, 409 con "Primero guardá el informe psicolaboral de esta persona".
- **Solo se le pasan a la IA** estos campos: `resumenEjecutivo`, `fortalezas`, `oportunidadesMejora`, `analisisEntrevista`, `ajusteCargo.analisis`. **Nunca**: `recomendacion`, `ajusteCargo.score`, `confianza`, alertas, `interpretacionPorFactor`, meta-competencias numéricas, ni nada de bienestar.
- **Instrucciones clave del prompt:** lector = jefe directo sin formación en psicología; lenguaje llano, frases cortas, segunda o tercera persona respetuosa; sin números, porcentajes, nombres de tests, siglas ni términos clínicos; sin dictamen ni recomendación de contratar; sin datos de salud; foco en cómo trabaja y cómo acompañarlo; devolver **solo** el JSON con las cinco claves.
- **Después de generar:** `normalizarInformeSupervisor` + `revisarTerminos`. Se guarda como `borrador` en `informes_supervisor` (upsert por candidato + proceso), **sin tocar `publicado`**. La respuesta incluye el borrador y la revisión de términos.
- `GET ?candidato_id=&proceso_id=`: borrador, publicado y fechas.
- `POST { accion: 'guardar_borrador', ... }`: guarda las ediciones del administrador.
- `POST { accion: 'publicar', ... }`: corre `revisarTerminos` en el servidor; si hay bloqueantes, 422 con la lista; si no, copia el borrador a `publicado`, pone `publicado_en` y `publicado_por`, y registra `publicar_informe_supervisor`.
- `POST { accion: 'despublicar' }`: pone `publicado = null` (el supervisor deja de verlo).

### 5.3 Editor (en `app/informe/page.tsx`, solo admin)
- Apartado "Informe para supervisores", con selector de proceso si el evaluado tiene más de uno.
- Botones: "Generar con IA", "Guardar borrador", "Publicar", "Despublicar". Las cinco secciones como áreas de texto.
- Muestra las advertencias y bloqueantes debajo de cada sección, el estado ("Borrador sin publicar", "Publicado el dd/mm/aaaa", "Hay cambios sin publicar") y quién tiene acceso (de la etapa 2).

### 5.4 PDF (`components/InformeSupervisorPDF.tsx`)
- Reutilizá `components/MarcaPDF.tsx` (logo y pie en todas las carillas), con el mismo estilo de `components/InformePDF.tsx`, pero solo con: nombre del evaluado, cargo y proceso, fecha de publicación, las cinco secciones, y una nota al pie: "Informe orientativo para la incorporación. Confidencial: no compartir fuera de la empresa."
- Sin dictamen, sin números, sin controles del proceso, sin datos de salud.
- Para verlo con datos reales sin sesión: bundle con esbuild + `renderToFile` + `pdftoppm` (scripts temporales que se borran), como se hizo con el PDF del informe técnico.

---

## 6. Etapa 4 — Panel del supervisor

**Rama:** `feature/panel-supervisor`.

- **Rutas (`app/api/supervisor/`)**, todas con `requireSupervisorSession` y registrando el acceso:
  - `evaluados/route.ts` `GET`: lista de habilitaciones con nombre y apellido del evaluado, nombre (con `nombreDeProcesoLegible`) y cargo del proceso, fecha de habilitación, y si hay informe publicado y videos. Nada más.
  - `evaluado/route.ts` `GET ?candidato_id=&proceso_id=`: comprueba `estaHabilitado`; si no, **404** (no 403, para no confirmar que existe). Devuelve datos básicos + informe **publicado** (o `null`).
  - `videos/route.ts` `GET ?candidato_id=&proceso_id=`: comprueba la habilitación y devuelve solo los videos de las entrevistas **de ese proceso** (usá la relación de `lib/server/procesoScope.ts`, `entrevistaIdsEnProcesos`), firmados con `firmarVideos` (vencen a las 2 horas), con el texto de cada pregunta. Mirá cómo lo hace `app/api/admin/videos-candidato/route.ts`, pero **sin** su búsqueda por email de otros candidatos.
- **Pantallas:**
  - `/supervisor`: lista de evaluados (tarjetas o tabla simple), con estado "Informe disponible" / "Informe en preparación".
  - `/supervisor/evaluado?candidato=&proceso=`: nombre y puesto, reproductor de videoentrevistas (pregunta + video), informe publicado en pantalla y botón "Descargar PDF" (`PDFDownloadLink` de `@react-pdf/renderer` con `InformeSupervisorPDF`). Antes de generar el PDF, llamar a una ruta que registre `supervisor_descargar_informe` (puede ser un `POST` en `evaluado/route.ts`).
  - Sin informe publicado: "El informe todavía no está disponible." Sin videos: "Esta persona no tiene videoentrevistas en este proceso."
  - Layout propio, sin el menú del panel; con cierre de sesión y el 2FA de siempre (`useGateMfa`).
- **Tests:** las rutas rechazan a admin y viewer (no son supervisores), devuelven 404 para un evaluado no habilitado, y nunca incluyen campos prohibidos (comprobar que la respuesta no tiene `recomendacion`, `puntaje_bruto`, `sesiones`).

---

## 7. Etapa 5 — Pruebas y piloto

- Script de prueba con supervisor y evaluado "ZZ" (crear y borrar en el mismo script) que verifique, contra el servidor local:
  1. Solo ve lo habilitado; un evaluado no habilitado da 404.
  2. `/api/admin/*` da 403 con el token del supervisor.
  3. Al quitar la habilitación, el siguiente pedido ya da 404.
  4. El informe publicado no contiene términos bloqueantes ni el dictamen.
  5. El PDF se genera y no contiene esos términos (extraer el texto con `pdftotext`).
- La creación del usuario de Auth y el 2FA del supervisor de prueba los hace el usuario. Acordá con él antes.
- **Piloto:** un supervisor real con uno o dos evaluados. Recogé comentarios y ajustá textos.

## 8. Etapa 6 — Documentación y cierre

- `docs/SUPERVISORES.md`: qué ve un supervisor, cómo se da de alta, cómo se habilita y revoca, cómo se genera y publica el informe, y qué queda registrado.
- `docs/RIESGOS_ACEPTADOS.md`: nueva sección con "el PDF descargado sale de la plataforma y no se puede revocar; queda registrado quién lo descargó y cuándo".
- Actualizar la memoria del proyecto (`project_psicoplataforma_supervisores.md`).

---

## 9. Trampas conocidas (leer antes de cada etapa)

1. **`registro_accesos.rol`** tiene un `check (rol in ('admin', 'viewer'))`. Sin la migración, los registros del supervisor fallan **en silencio** (la función no lanza). Por eso la migración ajusta la restricción.
2. **`tests/rutas-api.test.ts`** exige `requireAdminSession` en toda ruta no pública. Las rutas del supervisor necesitan el ajuste de la etapa 1, o el pre-commit falla.
3. **El login y el 2FA mandan siempre a `/panel`.** La redirección del supervisor se hace en `AppLayout`, no en el login.
4. **`whoami` está permitido con 2FA a medias (`aal1`)** porque la pantalla lo usa para decidir a dónde mandar. Mantené eso para el supervisor.
5. **`videos-candidato` del admin busca videos de otros candidatos con el mismo email.** El supervisor **no** debe heredar eso: solo videos del candidato y del proceso habilitados.
6. **`informes_psicometricos` es uno por candidato** (no por proceso). El informe del supervisor sí es por candidato + proceso.
7. **Los informes guardados de julio tienen redacción vieja.** Si el informe técnico guardado es viejo, el del supervisor saldrá de ese texto: sugerile al usuario regenerar y guardar el técnico antes.
8. **El servidor local usa la base de producción.** Nada de datos de prueba sin "ZZ" y sin borrarlos al final.
9. **Doble rol:** un email no puede ser supervisor y admin/viewer a la vez. Validarlo en las dos altas.

## 10. Estimación

| Etapa | Sesiones aprox. |
|---|---|
| 1. Base y acceso | 1 |
| 2. Gestión | 1 |
| 3. Informe para supervisores | 1,5 |
| 4. Panel del supervisor | 1 |
| 5. Pruebas y piloto | 1 |
| 6. Documentación | 0,5 |

Un PR por etapa. Este archivo va en el commit de la etapa 1.
