# Respaldos y protección de las cuentas (punto 20)

Lo que **sí** se puede dejar resuelto desde el código ya está: Next y las dependencias al día, `npm audit` en el CI
(bloquea desde nivel `high`) y Dependabot (`.github/dependabot.yml`). Lo que sigue son configuraciones de cada servicio
que solo puede hacer quien es dueño de la cuenta. Marcá cada una cuando la hagas.

## 1. Verificación en dos pasos de las cuentas que administran la plataforma
Quien entra a cualquiera de estas cuentas puede borrar datos, ver datos personales o publicar código.

| Servicio | Qué protege | Dónde se activa |
|---|---|---|
| **GitHub** | El código (el repositorio es público: cualquiera lo ve, pero solo vos lo modificás) | Settings → Password and authentication → Two-factor authentication |
| **Vercel** | El despliegue y las variables secretas de producción | Account Settings → Security → Two-Factor Authentication (o el proveedor con el que iniciás sesión) |
| **Supabase** | La base de datos con los datos de los postulantes | Account → Security (tu cuenta de Supabase, no la de la plataforma) |
| **Cloudflare** | Los videos de las entrevistas (R2) | My Profile → Authentication → Two-Factor Authentication |
| **Google (Gemini)** | La clave de la IA (consumo y facturación) | Cuenta de Google → Seguridad → Verificación en 2 pasos |
| **Upstash** | El límite de intentos (rate limiting) | Account → Security, si lo ofrece |
| **Correo del administrador** | Recuperar la contraseña de todo lo anterior pasa por el correo | Verificación en 2 pasos del proveedor |

- Preferí app autenticadora o llave de seguridad antes que SMS.
- Guardá los **códigos de recuperación** de cada servicio en un lugar seguro y separado del teléfono.
- Si alguna cuenta usa "Iniciar sesión con Google/GitHub", el 2FA se activa en esa cuenta de origen.

## 2. Respaldos: qué hay hoy y qué falta

| Qué | Respaldo | Estado |
|---|---|---|
| **Código** | GitHub (historial completo) | Cubierto |
| **Base de datos** (candidatos, sesiones, respuestas, informes) | Supabase, plan **Pro**: copia diaria automática, retención de 7 días. La recuperación a un punto exacto (PITR) es un complemento de pago | Revisar (ver abajo) |
| **Videos de entrevista** (Cloudflare R2, ~1550) | **Ninguno**: R2 no versiona los objetos ni guarda copias; lo que se borra, se pierde | **Sin cubrir** |
| **Variables secretas** (claves, tokens) | Solo están en Vercel y en tu `.env.local` | Guardarlas en un gestor de contraseñas |

### Base de datos (Supabase) — verificar
1. Supabase → Database → **Backups**: comprobá que aparezcan copias diarias recientes.
2. Probá una restauración **en un proyecto nuevo** (no sobre el de producción) al menos una vez, para saber cuánto tarda y
   qué pasa con los usuarios y las políticas de acceso. Un respaldo que nunca se restauró no es una garantía.
3. Decidí si alcanza con 7 días o querés PITR (Database → Backups → Point in Time).

### Videos (R2) — decisión pendiente
Hoy una baja accidental o una clave filtrada con permiso de borrado destruye los videos sin vuelta atrás. Opciones, de
menor a mayor esfuerzo:
- **Aceptar el riesgo** y dejarlo anotado (los videos se pueden volver a pedir a los postulantes, con costo humano).
- **Token de R2 acotado**: que la clave que usa la plataforma tenga permiso solo sobre este bucket (Cloudflare → R2 →
  Manage API tokens), sin acceso a nada más.
- **Copia periódica** a otro bucket o a un disco (por ejemplo con `rclone sync`, o la migración a pedido de R2). Ocupa
  tanto espacio como los videos (varios GB) y hay que programarla.
- No usar "Bucket Lock" tal cual: la plataforma borra a propósito los videos que no pasan la validación de tamaño, y un
  bloqueo lo impediría (ese borrado fallaría en silencio y el video inválido se aceptaría).

### Secretos
Guardá en un gestor de contraseñas (1Password, Bitwarden, etc.): claves de Supabase, Gemini, R2, Upstash, Turnstile,
`EVALUACION_LINK_SECRET` y el acceso SMTP. Si se pierde `EVALUACION_LINK_SECRET`, dejan de funcionar todos los enlaces
de evaluación ya enviados.

## 3. Mantener todo actualizado
- **Dependabot** abre un pull request semanal con las actualizaciones menores y de parche, y uno aparte por cada mayor.
  Revisalos y fusionalos si el CI (tests, build, `npm audit`) pasa. En GitHub: Settings → Code security → activar
  *Dependabot alerts* y *Dependabot security updates*, *Secret scanning* y *Push protection*.
- `xlsx` se actualiza a mano (versión del CDN de SheetJS); revisar su versión cada tanto.
- Cada cierto tiempo: `npm run audit:dependencias` y revisar los avisos de Next.js.
